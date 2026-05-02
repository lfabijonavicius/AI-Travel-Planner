import json
import logging
from datetime import date, timedelta
from typing import AsyncIterator

from agent.graph import graph
from models import ChatRequest

logger = logging.getLogger(__name__)

# Pricing per 1M tokens (USD) for the main agent model (gpt-4.1-mini)
_INPUT_COST_PER_1M = 0.40
_OUTPUT_COST_PER_1M = 1.60


# ---------------------------------------------------------------------------
# Result helpers
# ---------------------------------------------------------------------------

def _clean_result_list(value):
    if not isinstance(value, list):
        return []
    return [item for item in value if isinstance(item, dict) and not item.get("error")]


def _has_valid_itinerary(output: object) -> bool:
    return (
        isinstance(output, dict)
        and isinstance(output.get("days"), list)
        and len(output["days"]) > 0
    )


# ---------------------------------------------------------------------------
# Itinerary arg builders (shared between streaming fallback and /itinerary/build)
# ---------------------------------------------------------------------------

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

    return {
        "destination": destination,
        "start_date": start_date,
        "end_date": end_date,
        "hotel": selected_hotel if isinstance(selected_hotel, dict) else (hotels_found[0] if hotels_found else None),
        "flights": selected_flight if isinstance(selected_flight, dict) else (flights_found[0] if flights_found else None),
        "places": _clean_result_list(snapshot.get("places_found")),
        "weather": _clean_result_list(snapshot.get("weather_data")),
    }


# ---------------------------------------------------------------------------
# Snapshot → enriched user message
# ---------------------------------------------------------------------------

def _build_context_message(request: ChatRequest) -> str:
    user_message = request.message
    if not request.snapshot:
        return user_message

    lines = []
    snap = request.snapshot

    if "flights_found" in snap:
        summaries = [
            f"{f['airline']} {f['flight_number']} {f['route']} {f['departure_date']} £{f['price_gbp']}/person ({f['stops']} stop{'s' if f['stops'] != 1 else ''})"
            for f in snap["flights_found"]
        ]
        lines.append("Flights already shown to user: " + " | ".join(summaries))
    if "hotels_found" in snap:
        summaries = [
            f"{h['name']} ({h['city']}) £{h['price_per_night_gbp']}/night £{h['total_price_gbp']} total"
            for h in snap["hotels_found"]
        ]
        lines.append("Hotels already shown to user: " + " | ".join(summaries))
    if "places_found" in snap:
        places = snap["places_found"]
        if places and isinstance(places[0], dict):
            lines.append("Places already shown to user (use these directly for generate_itinerary): " + json.dumps(places))
        elif places:
            lines.append("Places already shown to user: " + ", ".join(str(p) for p in places if p))
    if "pinned_places" in snap:
        pins = [str(n) for n in snap["pinned_places"] if n]
        if pins:
            lines.append("Places user added to itinerary: " + ", ".join(pins))
    if "selected_flight" in snap:
        f = snap["selected_flight"]
        lines.append(f"User selected flight: {f['airline']} {f['flight_number']} {f['route']} {f['departure_date']} £{f['price_gbp']}/person")
    if "selected_hotel" in snap:
        h = snap["selected_hotel"]
        lines.append(f"User selected hotel: {h['name']} ({h['city']}) £{h['price_per_night_gbp']}/night")
    if "itinerary_built" in snap:
        it = snap["itinerary_built"]
        lines.append(f"Itinerary already built: {it['days']} days in {it['destination']} ({it['start']} to {it['end']})")
    if "weather_data" in snap:
        lines.append("Weather forecast (use directly for generate_itinerary): " + json.dumps(snap["weather_data"]))
    if "currency_fetched" in snap:
        c = snap["currency_fetched"]
        lines.append(f"Exchange rate already fetched: 1 {c['base']} = {c['rate']} {c['target']}")

    if lines:
        context_block = "\n".join(f"- {l}" for l in lines)
        user_message = f"[What has already been done this session:\n{context_block}]\n\n{request.message}"

    return user_message


# ---------------------------------------------------------------------------
# Public interface
# ---------------------------------------------------------------------------

async def stream_agent_response(request: ChatRequest) -> AsyncIterator[str]:
    """Yield SSE lines for a single chat turn.

    Event types:
    - {type: "token", content: "..."}
    - {type: "tool_start", tool: "...", inputs: {...}}
    - {type: "tool_result", tool: "...", output: {...}}
    - {type: "usage", input_tokens: N, output_tokens: N, cost_usd: N}
    - {type: "error", content: "..."}
    - [DONE]
    """
    try:
        result_buffer: list[str] = []
        itinerary_buffered = False
        itinerary_started = False
        any_tool_called = False
        pre_narrative_tokens: list[str] = []
        post_tool_tokens: list[str] = []
        latest_tool_inputs: dict[str, dict] = {}
        latest_tool_outputs: dict[str, object] = {}

        user_message = _build_context_message(request)
        today = date.today().isoformat()
        dated_message = f"[Today's date: {today}]\n\n{user_message}"

        history_msgs = [
            (h["role"], h["content"])
            for h in request.history
            if h.get("content", "").strip()
        ]
        messages = history_msgs + [("user", dated_message)]
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
                    # Buffer tokens until first tool fires to discard JSON argument leakage.
                    # After tools run, only the final post-tool prose should reach the client.
                    if not any_tool_called:
                        pre_narrative_tokens.append(chunk)
                    else:
                        post_tool_tokens.append(chunk)

            elif kind == "on_chat_model_end":
                output = event["data"].get("output")
                usage = getattr(output, "usage_metadata", None) if output else None
                if usage:
                    in_tok = usage.get("input_tokens", 0) or 0
                    out_tok = usage.get("output_tokens", 0) or 0
                    total_input_tokens += in_tok
                    total_output_tokens += out_tok
                    cost_usd = (
                        total_input_tokens * _INPUT_COST_PER_1M / 1_000_000
                        + total_output_tokens * _OUTPUT_COST_PER_1M / 1_000_000
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
                # Discard intermediate model segments between tool calls
                post_tool_tokens.clear()
                any_tool_called = True
                if tool_name == "generate_itinerary":
                    if itinerary_started:
                        continue
                    itinerary_started = True
                yield f"data: {json.dumps({'type': 'tool_start', 'tool': tool_name, 'inputs': inputs})}\n\n"

            elif kind == "on_tool_end":
                tool_name = event.get("name", "")
                raw_output = event["data"].get("output", {})
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
                if tool_name == "generate_itinerary":
                    if itinerary_buffered:
                        continue
                    has_days = _has_valid_itinerary(output)
                    if has_days:
                        itinerary_buffered = True
                        logger.info(f"generate_itinerary succeeded with {len(output['days'])} days")
                    else:
                        logger.warning(f"generate_itinerary returned no days: {str(output)[:300]}")
                result_buffer.append(
                    f"data: {json.dumps({'type': 'tool_result', 'tool': tool_name, 'output': output})}\n\n"
                )

        if not any_tool_called and pre_narrative_tokens:
            for chunk in pre_narrative_tokens:
                yield f"data: {json.dumps({'type': 'token', 'content': chunk})}\n\n"
        elif any_tool_called and post_tool_tokens:
            for chunk in post_tool_tokens:
                yield f"data: {json.dumps({'type': 'token', 'content': chunk})}\n\n"

        for line in result_buffer:
            yield line

    except Exception as e:
        logger.error(f"Stream error: {e}")
        yield f"data: {json.dumps({'type': 'error', 'content': str(e)})}\n\n"
    finally:
        yield "data: [DONE]\n\n"
