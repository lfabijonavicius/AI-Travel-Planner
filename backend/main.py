import json
import logging
from datetime import date
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from agent.graph import graph

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Voyager API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ChatRequest(BaseModel):
    message: str
    context: dict = {}
    snapshot: dict = {}


@app.get("/health")
def health():
    return {"status": "ok", "service": "Voyager API"}


@app.post("/api/chat/stream")
async def stream_chat(request: ChatRequest):
    """Main chat endpoint — streams agent responses via SSE.

    Event types:
    - {type: "token", content: "..."}        → text chunk from LLM
    - {type: "tool_start", tool: "..."}      → tool is running
    - {type: "tool_result", tool: "...", output: {...}} → tool completed
    - {type: "error", content: "..."}        → something went wrong
    - [DONE]                                 → stream complete
    """
    async def event_generator():
        try:
            # Build enriched user message so the agent knows what was already found
            user_message = request.message
            if request.snapshot:
                lines = []
                if "flights_found" in request.snapshot:
                    summaries = [
                        f"{f['airline']} {f['flight_number']} {f['route']} {f['departure_date']} £{f['price_gbp']}/person ({f['stops']} stop{'s' if f['stops'] != 1 else ''})"
                        for f in request.snapshot["flights_found"]
                    ]
                    lines.append("Flights already shown to user: " + " | ".join(summaries))
                if "hotels_found" in request.snapshot:
                    summaries = [
                        f"{h['name']} ({h['city']}) £{h['price_per_night_gbp']}/night £{h['total_price_gbp']} total"
                        for h in request.snapshot["hotels_found"]
                    ]
                    lines.append("Hotels already shown to user: " + " | ".join(summaries))
                if "places_found" in request.snapshot:
                    names = [str(n) for n in request.snapshot["places_found"] if n]
                    if names:
                        lines.append("Places already shown to user: " + ", ".join(names))
                if "pinned_places" in request.snapshot:
                    pins = [str(n) for n in request.snapshot["pinned_places"] if n]
                    if pins:
                        lines.append("Places user added to itinerary: " + ", ".join(pins))
                if "selected_flight" in request.snapshot:
                    f = request.snapshot["selected_flight"]
                    lines.append(f"User selected flight: {f['airline']} {f['flight_number']} {f['route']} {f['departure_date']} £{f['price_gbp']}/person")
                if "selected_hotel" in request.snapshot:
                    h = request.snapshot["selected_hotel"]
                    lines.append(f"User selected hotel: {h['name']} ({h['city']}) £{h['price_per_night_gbp']}/night")
                if "itinerary_built" in request.snapshot:
                    it = request.snapshot["itinerary_built"]
                    lines.append(f"Itinerary already built: {it['days']} days in {it['destination']} ({it['start']} to {it['end']})")
                if "weather_fetched" in request.snapshot:
                    lines.append("Weather forecast already fetched.")
                if "currency_fetched" in request.snapshot:
                    c = request.snapshot["currency_fetched"]
                    lines.append(f"Exchange rate already fetched: 1 {c['base']} = {c['rate']} {c['target']}")

                if lines:
                    context_block = "\n".join(f"- {l}" for l in lines)
                    user_message = f"[What has already been done this session:\n{context_block}]\n\n{request.message}"

            today = date.today().isoformat()
            dated_message = f"[Today's date: {today}]\n\n{user_message}"

            async for event in graph.astream_events(
                {
                    "messages": [("user", dated_message)],
                    "trip_context": request.context,
                    "tool_results": {},
                    "itinerary": None,
                },
                version="v2",
            ):
                kind = event["event"]

                if kind == "on_chat_model_stream":
                    chunk = event["data"]["chunk"].content
                    if chunk:
                        yield f"data: {json.dumps({'type': 'token', 'content': chunk})}\n\n"

                elif kind == "on_tool_start":
                    tool_name = event.get("name", "")
                    inputs = event["data"].get("input", {})
                    logger.info(f"Tool start: {tool_name} inputs={inputs}")
                    yield f"data: {json.dumps({'type': 'tool_start', 'tool': tool_name, 'inputs': inputs})}\n\n"

                elif kind == "on_tool_end":
                    tool_name = event.get("name", "")
                    raw_output = event["data"].get("output", {})
                    # LangGraph wraps tool output in a ToolMessage — extract the content
                    if hasattr(raw_output, "content"):
                        content = raw_output.content
                        try:
                            output = json.loads(content)
                        except (json.JSONDecodeError, TypeError):
                            output = content
                    else:
                        output = raw_output
                    logger.info(f"Tool end: {tool_name}")
                    yield f"data: {json.dumps({'type': 'tool_result', 'tool': tool_name, 'output': output})}\n\n"

        except Exception as e:
            logger.error(f"Stream error: {e}")
            yield f"data: {json.dumps({'type': 'error', 'content': str(e)})}\n\n"
        finally:
            yield "data: [DONE]\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")
