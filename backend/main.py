import json
import logging
from datetime import date, timedelta
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from agent.graph import graph, _detect_mode
from agent.tools import generate_itinerary
from agent.tools.places import lookup_place_core, search_places_core
from tripadvisor import has_tripadvisor_key, lookup_location, enrich_location

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
    history: list[dict] = []


class ItineraryBuildRequest(BaseModel):
    context: dict = {}
    snapshot: dict = {}


def _clean_result_list(value):
    if not isinstance(value, list):
        return []
    return [
        item
        for item in value
        if isinstance(item, dict) and not item.get("error")
    ]


def _first_clean_result(value):
    cleaned = _clean_result_list(value)
    return cleaned[0] if cleaned else None


def _merge_place_results(place_outputs):
    merged = []
    seen = set()
    for output in place_outputs:
        for place in _clean_result_list(output):
            key = (
                str(place.get("name", "")).strip().lower(),
                str(place.get("category", "")).strip().lower(),
                place.get("lat"),
                place.get("lng"),
            )
            if key in seen:
                continue
            seen.add(key)
            merged.append(place)
    return merged


def _build_itinerary_fallback_args(request: ChatRequest, tool_inputs: dict, tool_outputs: dict) -> dict | None:
    trip_context = request.context or {}

    fallback_start = (date.today() + timedelta(days=42)).isoformat()
    fallback_end = (date.today() + timedelta(days=48)).isoformat()

    hotel_inputs = tool_inputs.get("search_hotels") or {}
    flight_inputs = tool_inputs.get("search_flights") or {}
    weather_inputs = tool_inputs.get("get_weather_forecast") or {}

    destination = (
        trip_context.get("destination")
        or hotel_inputs.get("city")
        or weather_inputs.get("city")
        or flight_inputs.get("destination")
    )
    start_date = (
        trip_context.get("start_date")
        or hotel_inputs.get("check_in")
        or weather_inputs.get("start_date")
        or flight_inputs.get("departure_date")
        or fallback_start
    )
    end_date = (
        trip_context.get("end_date")
        or hotel_inputs.get("check_out")
        or weather_inputs.get("end_date")
        or flight_inputs.get("return_date")
        or fallback_end
    )

    if not destination:
        return None

    return {
        "destination": destination,
        "start_date": start_date,
        "end_date": end_date,
        "hotel": _first_clean_result(tool_outputs.get("search_hotels")),
        "flights": _first_clean_result(tool_outputs.get("search_flights")),
        "places": _merge_place_results(tool_outputs.get("search_places", [])),
        "weather": _clean_result_list(tool_outputs.get("get_weather_forecast")),
    }


def _has_valid_itinerary(output: object) -> bool:
    return (
        isinstance(output, dict)
        and isinstance(output.get("days"), list)
        and len(output["days"]) > 0
    )


def _build_itinerary_args_from_snapshot(context: dict, snapshot: dict) -> dict | None:
    context = context or {}
    snapshot = snapshot or {}
    fallback_start = (date.today() + timedelta(days=42)).isoformat()
    fallback_end = (date.today() + timedelta(days=48)).isoformat()

    destination = (
        context.get("destination")
        or snapshot.get("selected_hotel", {}).get("city")
        or snapshot.get("selected_flight", {}).get("destination")
        or (snapshot.get("hotels_found") or [{}])[0].get("city")
        or (snapshot.get("flights_found") or [{}])[0].get("destination")
    )
    start_date = (
        context.get("start_date")
        or snapshot.get("selected_flight", {}).get("departure_date")
        or (snapshot.get("flights_found") or [{}])[0].get("departure_date")
        or snapshot.get("itinerary_built", {}).get("start")
        or fallback_start
    )
    end_date = (
        context.get("end_date")
        or snapshot.get("selected_flight", {}).get("return_date")
        or (snapshot.get("flights_found") or [{}])[0].get("return_date")
        or snapshot.get("itinerary_built", {}).get("end")
        or fallback_end
    )

    if not destination:
        return None

    selected_hotel = snapshot.get("selected_hotel")
    selected_flight = snapshot.get("selected_flight")
    hotels_found = _clean_result_list(snapshot.get("hotels_found"))
    flights_found = _clean_result_list(snapshot.get("flights_found"))
    places_found = _clean_result_list(snapshot.get("places_found"))
    weather_data = _clean_result_list(snapshot.get("weather_data"))

    return {
        "destination": destination,
        "start_date": start_date,
        "end_date": end_date,
        "hotel": selected_hotel if isinstance(selected_hotel, dict) else (hotels_found[0] if hotels_found else None),
        "flights": selected_flight if isinstance(selected_flight, dict) else (flights_found[0] if flights_found else None),
        "places": places_found,
        "weather": weather_data,
    }


@app.get("/health")
def health():
    return {"status": "ok", "service": "Voyager API"}


@app.get("/api/places")
def api_places(city: str, category: str = "attractions", max_results: int = 8):
    """Direct place-lookup for the destination detail panel (not agent-mediated).
    Used by the 'Things to do' / 'Restaurants' tabs when a user previews a destination.
    Fetches only 1 photo per place since the grid tiles only render a single hero image."""
    return search_places_core(city, category, max_results=max_results, photos_per_place=1)


@app.get("/api/place-lookup")
def api_place_lookup(q: str, city: str, category: str = "attractions", max_results: int = 5):
    """Targeted place lookup for itinerary events that were generated as text only."""
    return lookup_place_core(q, city, category, max_results=max_results, photos_per_place=3)


@app.get("/api/tripadvisor/status")
def api_tripadvisor_status():
    return {
        "configured": has_tripadvisor_key(),
        "provider": "tripadvisor_content_api",
    }


@app.get("/api/tripadvisor/test")
def api_tripadvisor_test(lat: float, lng: float, q: str, category: str = "attractions"):
    """Test Tripadvisor Content API mapping + detail lookup for a single place.

    Example:
    /api/tripadvisor/test?lat=35.7101&lng=139.8107&q=Tokyo%20Skytree&category=attractions
    """
    return lookup_location(lat=lat, lng=lng, query=q, category=category)


@app.get("/api/tripadvisor/enrich")
def api_tripadvisor_enrich(lat: float, lng: float, q: str, category: str = "attractions"):
    """Strict Tripadvisor enrichment for an existing place card/drawer.

    Returns matched=false when mapper results are too fuzzy, so the UI can avoid
    showing the wrong Tripadvisor listing.
    """
    return enrich_location(lat=lat, lng=lng, query=q, category=category)


@app.post("/api/itinerary/build")
def build_itinerary(request: ItineraryBuildRequest):
    args = _build_itinerary_args_from_snapshot(request.context, request.snapshot)
    if not args:
        return {"error": "Missing destination or trip dates for itinerary build."}

    output = generate_itinerary.invoke(args)
    if _has_valid_itinerary(output):
        return output
    return {"error": "Itinerary build did not return usable days."}


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
            result_buffer: list[str] = []  # buffered tool_result SSE lines
            itinerary_buffered = False       # deduplicate generate_itinerary results
            itinerary_started = False        # deduplicate generate_itinerary tool_start
            any_tool_called = False          # True once first tool fires
            pre_narrative_tokens: list[str] = []  # tokens buffered before narrative phase
            post_tool_tokens: list[str] = []  # only the final post-tool prose should survive
            latest_tool_inputs: dict[str, dict] = {}
            latest_tool_outputs: dict[str, object] = {}

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
                    places = request.snapshot["places_found"]
                    if places and isinstance(places[0], dict):
                        lines.append("Places already shown to user (use these directly for generate_itinerary): " + json.dumps(places))
                    elif places:
                        lines.append("Places already shown to user: " + ", ".join(str(p) for p in places if p))
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
                if "weather_data" in request.snapshot:
                    lines.append("Weather forecast (use directly for generate_itinerary): " + json.dumps(request.snapshot["weather_data"]))
                if "currency_fetched" in request.snapshot:
                    c = request.snapshot["currency_fetched"]
                    lines.append(f"Exchange rate already fetched: 1 {c['base']} = {c['rate']} {c['target']}")

                if lines:
                    context_block = "\n".join(f"- {l}" for l in lines)
                    user_message = f"[What has already been done this session:\n{context_block}]\n\n{request.message}"

            today = date.today().isoformat()
            dated_message = f"[Today's date: {today}]\n\n{user_message}"

            # Build message history: prior turns + current message
            history_msgs = [
                (h["role"], h["content"])
                for h in request.history
                if h.get("content", "").strip()
            ]
            messages = history_msgs + [("user", dated_message)]
            detected_mode = _detect_mode(
                {
                    "messages": messages,
                    "trip_context": request.context,
                }
            )

            # Pricing per 1M tokens (USD) for the main agent model (gpt-4.1-mini)
            INPUT_COST_PER_1M = 0.40
            OUTPUT_COST_PER_1M = 1.60
            total_input_tokens = 0
            total_output_tokens = 0

            async for event in graph.astream_events(
                {
                    "messages": messages,
                    "trip_context": request.context,
                    "tool_results": {},
                    "itinerary": None,
                },
                version="v2",
                config={"recursion_limit": 20},
            ):
                kind = event["event"]

                if kind == "on_chat_model_stream":
                    chunk = event["data"]["chunk"].content
                    if chunk:
                        # Buffer all tokens until the first tool call decision is known.
                        # Tool-calling turns can emit raw JSON / argument-like fragments
                        # here; if a tool starts, we discard the buffered pre-tool text.
                        # After tools begin, keep buffering but do not stream live — only
                        # the final post-tool prose should be emitted at the end.
                        if not any_tool_called:
                            pre_narrative_tokens.append(chunk)
                        else:
                            post_tool_tokens.append(chunk)

                elif kind == "on_chat_model_end":
                    # Extract token usage from the completed LLM call
                    output = event["data"].get("output")
                    usage = getattr(output, "usage_metadata", None) if output else None
                    if usage:
                        in_tok = usage.get("input_tokens", 0) or 0
                        out_tok = usage.get("output_tokens", 0) or 0
                        total_input_tokens += in_tok
                        total_output_tokens += out_tok
                        cost_usd = (
                            total_input_tokens * INPUT_COST_PER_1M / 1_000_000
                            + total_output_tokens * OUTPUT_COST_PER_1M / 1_000_000
                        )
                        yield f"data: {json.dumps({'type': 'usage', 'input_tokens': total_input_tokens, 'output_tokens': total_output_tokens, 'cost_usd': round(cost_usd, 6)})}\n\n"

                elif kind == "on_tool_start":
                    tool_name = event.get("name", "")
                    inputs = event["data"].get("input", {})
                    if isinstance(inputs, dict):
                        latest_tool_inputs[tool_name] = inputs
                    logger.info(f"Tool start: {tool_name} inputs={inputs}")
                    if not any_tool_called:
                        pre_narrative_tokens.clear()
                    # If another tool starts, any buffered post-tool text was only an
                    # intermediate model segment or tool-argument leakage. Discard it.
                    post_tool_tokens.clear()
                    any_tool_called = True
                    # Deduplicate generate_itinerary tool_start indicator
                    if tool_name == "generate_itinerary":
                        if itinerary_started:
                            continue
                        itinerary_started = True
                    # Tool indicators stream live so user sees progress
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
                    if tool_name == "search_places":
                        latest_tool_outputs.setdefault(tool_name, [])
                        if isinstance(latest_tool_outputs[tool_name], list):
                            latest_tool_outputs[tool_name].append(output)
                    else:
                        latest_tool_outputs[tool_name] = output
                    # Deduplicate generate_itinerary — only keep first result with actual days
                    if tool_name == "generate_itinerary":
                        if itinerary_buffered:
                            # Already have a valid itinerary — discard duplicates entirely
                            continue
                        has_days = _has_valid_itinerary(output)
                        if has_days:
                            itinerary_buffered = True
                            logger.info(f"generate_itinerary succeeded with {len(output['days'])} days")
                        else:
                            logger.warning(f"generate_itinerary returned no days: {str(output)[:300]}")
                            # Fall through — still buffer the tool_result so spinner resolves
                    # Buffer card results — flush after narrative is done
                    result_buffer.append(
                        f"data: {json.dumps({'type': 'tool_result', 'tool': tool_name, 'output': output})}\n\n"
                    )

            if detected_mode == "planner" and not itinerary_buffered:
                fallback_args = _build_itinerary_fallback_args(
                    request,
                    latest_tool_inputs,
                    latest_tool_outputs,
                )
                if fallback_args:
                    logger.warning(
                        "Planner completed without a usable itinerary tool result; invoking fallback generate_itinerary for destination=%s",
                        fallback_args["destination"],
                    )
                    fallback_output = generate_itinerary.invoke(fallback_args)
                    if _has_valid_itinerary(fallback_output):
                        itinerary_buffered = True
                        latest_tool_outputs["generate_itinerary"] = fallback_output
                        if not itinerary_started:
                            result_buffer.append(
                                f"data: {json.dumps({'type': 'tool_start', 'tool': 'generate_itinerary', 'inputs': fallback_args})}\n\n"
                            )
                        result_buffer.append(
                            f"data: {json.dumps({'type': 'tool_result', 'tool': 'generate_itinerary', 'output': fallback_output})}\n\n"
                        )
                    else:
                        logger.error("Fallback generate_itinerary also failed: %s", str(fallback_output)[:500])

            # No tool was used — this was a pure text answer, so flush the buffered tokens.
            if not any_tool_called and pre_narrative_tokens:
                for chunk in pre_narrative_tokens:
                    yield f"data: {json.dumps({'type': 'token', 'content': chunk})}\n\n"
            elif any_tool_called and post_tool_tokens:
                for chunk in post_tool_tokens:
                    yield f"data: {json.dumps({'type': 'token', 'content': chunk})}\n\n"

            # Flush all card results after the narrative has streamed
            for line in result_buffer:
                yield line

        except Exception as e:
            logger.error(f"Stream error: {e}")
            yield f"data: {json.dumps({'type': 'error', 'content': str(e)})}\n\n"
        finally:
            yield "data: [DONE]\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")
