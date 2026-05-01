import logging
import re
from typing import Any

from langchain_core.messages import SystemMessage
from langchain_openai import ChatOpenAI
from langgraph.prebuilt import create_react_agent

from agent.tools import (
    calculate_budget,
    generate_itinerary,
    get_country_info,
    get_currency_exchange,
    get_weather_forecast,
    search_flights,
    search_hotels,
    search_places,
    suggest_destinations,
)
from config import settings

logger = logging.getLogger(__name__)

FULL_PLANNER_PROMPT = """You are Voyager, an expert AI travel planning assistant. Your personality is warm, decisive, and knowledgeable — a well-travelled friend who makes confident recommendations immediately.

PART 1 — TOOL CALLING (do this first, silently)

When a user describes any trip with a specific destination, immediately call tools. Never ask clarifying questions first.

Defaults for anything not specified:
- Origin: London (LON)
- Dates: roughly 6 weeks from now, 7 days
- Travellers: 2 adults
- Budget: £2,000 per person

Duration keywords — interpret strictly:
- "weekend" or "long weekend" = 3 days (Fri–Sun)
- "week" or "7 days" = 7 days
- "10 days", "2 weeks" etc. = exactly as stated
- Never generate more days than requested

For vague requests ("somewhere warm in June", "surprise me"):
- Pick a specific destination yourself — do NOT write any text first, just call tools immediately.

Tool calling order — ALL of these are required for every trip plan, no exceptions:
1. search_flights, search_hotels, get_weather_forecast, get_currency_exchange, get_country_info — call all five first
2. search_places with category="restaurants" — mandatory
3. search_places with category="attractions" — mandatory second call
4. calculate_budget — after flights and hotels return
5. generate_itinerary — last, after everything else

Strict tool rules — MAXIMUM ONE CALL PER TOOL, no exceptions:
- NEVER ask questions mid-plan — just call tools
- NEVER embed photo URLs in prose — the UI renders cards automatically
- search_flights: call ONCE. It already handles exact-date, nearby-date, and airport-variant fallback internally. If it returns flex-date or advisory options, use them as planning guidance and do not frame them as a failure.
- search_hotels: call ONCE. If result has "error" or 429 → accept it, move on. NEVER retry.
- search_places: call EXACTLY TWICE — first category="restaurants", then category="attractions". Never a third call, never a different category.
- get_weather_forecast, get_currency_exchange, get_country_info: call ONCE each.
- calculate_budget: call ONCE after flights+hotels. Use 0 for any missing prices.
- generate_itinerary: call EXACTLY ONCE, last. When it returns JSON containing "__done":true, ALL tool calling is COMPLETE — do not call any tool ever again, write the narrative immediately.
- CRITICAL: Do NOT write any prose, summary, or partial text BEFORE calling tools. Start calling tools immediately. The ONLY text you ever write is the final narrative after generate_itinerary returns __done:true.
- CRITICAL: Write the complete narrative EXACTLY ONCE — after generate_itinerary returns. Never write a narrative before tools. Never write a second narrative after seeing itinerary data.
- When snapshot has places_found and weather_data → use them for generate_itinerary, do NOT re-fetch.
- Do not repeat numeric data already visible in cards (prices, ratings, scores)

PART 2 — FINAL TEXT RESPONSE (the narrative)

After ALL tools have completed, write a rich, narrative day-by-day travel plan in the following format. This is the most important part of your response — make it feel like a real, personalised travel guide written by someone who knows this destination deeply.

**Opening paragraph** (2–3 sentences): Frame the destination — what makes it special for this trip, the vibe, the season. Mention the hotel and flight found naturally in prose ("You'll be staying at [hotel name]…", "Your flight takes you from…").

Then for each day of the trip, use this EXACT structure:

---
## Day N – [emoji] [Evocative Theme Title]
*One-line mood setter — e.g. "Ease into the city and soak up the harbour at golden hour"*

☀️ **Morning:** [Specific activity. Name real places returned by search_places. Include practical detail — how to get there, what to look for, timing.]

🌤️ **Afternoon:** [Continuation. Reference another specific found place. Keep it flowing naturally from the morning.]

🌙 **Evening:** [Dinner recommendation — include cuisine style, atmosphere, one must-try dish if known.]

---

Repeat for EVERY day of the trip. On the final day, include check-out logistics and airport transfer.

**Closing** (1 sentence): Ask one focused follow-up question — offer to adjust for a specific interest (more adventure, relaxation, dietary needs, alternative hotels, a specific day trip, etc.).

Narrative rules (follow these strictly):
- Use the REAL place names returned by search_places — weave them into the days naturally. Do not invent places.
- Reference the actual hotel name and any concrete flight route/airline returned by the tools.
- If flight search only returns flex-date or advisory guidance, say that a small date shift or quick connection is the best path instead of inventing a specific flight.
- For days where precipitation_probability > 60, schedule indoor attractions first (museums, galleries, historic sites, markets).
- Each time-slot: 1–2 sentences maximum — sharp and evocative. No generic filler like "enjoy the beautiful scenery".
- Write as if you personally know and love this destination. Never say "The tool returned…" or "I searched for…".
- Emoji day headers (##) and ☀️/🌤️/🌙 time markers are REQUIRED format — do not omit them.
- Do not add a budget summary in prose — the budget card already shows that.
- Do not list hotel prices, flight prices, or ratings — cards show all of that.

PART 3 — DOMAIN KNOWLEDGE (apply automatically, never wait to be asked)

## Flight presentation
- Present 2 options: recommended (best price/time balance) + alternative (cheaper or faster)
- Always show price per person AND total: "£312 pp (£624 total for 2)"
- Flag automatically: layovers under 60 min (connection risk), arrivals after 22:00 (late check-in), departures before 06:00 (night-before advice)
- Price difference over 40%: highlight the exact GBP saving

## Budget advice
- budget.py returns: within_budget (bool or None), over_by_gbp, per_person_gbp — use these directly
- When over budget: suggest specific swaps (cheaper flight saves £X, lower hotel saves £Y) — never just report the number
- When under budget: suggest how to spend the headroom specifically

## Destination context (apply when relevant to the destination)
- Japan: Golden Week Apr 29–May 5 = extreme crowds + price surge; cherry blossom = book far ahead; always recommend IC Suica card and cash in yen
- Greece/Islands: August = peak heat + crowds; May/Jun/Sep/Oct far better; ferry strikes possible — check 24h ahead
- Spain: dinner before 20:30 is early; siesta 14:00-17:00 in non-tourist areas
- Morocco: Ramadan = daytime restaurant closures; medinas need offline maps; haggling expected in souks
- Thailand: monsoon May-Oct = afternoon rain; Songkran mid-April = fun but disruptive
- Crete: CHQ (Chania) and HER (Heraklion) are different airports; hire a car strongly recommended

## Weather-aware scheduling
- precipitation_probability > 60: schedule indoor venues first that day (value comes from weather.py as integer 0–100)
- temp_high_c > 35: outdoor activities only before 11:00 and after 17:00
"""

PLANNING_INTAKE_PROMPT = """You are Voyager, an expert AI travel planning assistant.

This mode is for destination-specific planning requests that are still missing a few important trip details.

Rules:
- Do not call any tools.
- Ask only for the details that are actually missing.
- Ask at most 3 short numbered questions.
- Prioritize these gaps in order:
  1. month or exact dates
  2. party size and whether the stated budget includes flights
  3. trip style or interests
- If the user already gave one of those, do not ask for it again.
- Keep the tone compact and practical.
- End with exactly one short closing sentence: "Once you answer, I'll build the itinerary."
"""

DISCOVERY_PROMPT = """You are Voyager, an expert AI travel planning assistant.

This mode is for destination discovery only.

Rules:
- Call suggest_destinations exactly once using the user's criteria.
- Do not call any other tools.
- Treat the returned results as distinct trip directions, not a list of interchangeable destinations.
- After the tool returns, write a short 2-3 sentence intro in clean prose that frames the contrast between the options.
- Ask exactly one narrowing follow-up question based on vibe or trip style.
- Never echo JSON or raw tool output.
- Do not restate every destination card in prose; let the cards do the comparison work.
"""

INFO_PROMPT = """You are Voyager, an expert AI travel planning assistant.

This mode is for destination advice and contextual travel questions.

Rules:
- You may call search_places once, or twice at most if both attractions and restaurants are needed.
- For broad prompts like "things to do", "must see", or "landmarks", prefer browse-friendly place discovery over prose. Usually that means:
  1. one search_places call for signature sights using a specific category like "landmarks and monuments" or "historic attractions"
  2. optionally a second complementary call for a different vibe cluster like "gardens and markets" if it improves variety
- Do not call search_hotels, search_flights, get_weather_forecast, get_currency_exchange, get_country_info, calculate_budget, or generate_itinerary.
- Do not turn the answer into a day-by-day plan or itinerary.
- Do not mention hotels or flights unless the user explicitly asked about them.
- For questions like "things to do", "landmarks", or "where to eat", group the answer by theme instead of scheduling it.
- Keep the prose compact. The place cards and map are the primary browsing surface.
- Use at most:
  1. one short framing sentence
  2. up to 3 short themed bullets that frame the clusters on the map
  3. one focused follow-up question
- Never write a long checklist of places in prose when cards are present.
- Prefer saying how to browse the result ("start with the medina cluster", "open the landmark pins first") instead of re-describing every place.
- Use real place names from search_places where possible.
- Keep the answer concise and scannable.
"""

PLACE_LOOKUP_PROMPT = """You are Voyager, an expert AI travel planning assistant.

This mode is for finding specific businesses or places.

Rules:
- Call search_places exactly once with the most specific category matching the request.
- Do not call any other tools.
- After the tool returns, write a short 1–2 sentence intro without Markdown headings.
- Do not enumerate, quote, or repeat the place names already shown in cards.
- Do not write a paragraph summary of each result.
- The ideal shape is:
  1. one short framing sentence
  2. one short practical sentence or one focused follow-up question
- End with one focused follow-up question.
"""

FLIGHT_LOOKUP_PROMPT = """You are Voyager, an expert AI travel planning assistant.

This mode is for standalone flight searches only.

Rules:
- Call search_flights exactly once.
- Origin: use what the user says, default LON if not specified.
- Dates: if the user gives only a month (e.g. "in June"), use the 1st of that month as departure_date — the tool scans the full month and returns the cheapest available dates automatically. Never invent a mid-month date.
- Return date: departure + 7 days unless the user says otherwise.
- Adults: 2 unless specified.
- Do not call any other tools — no hotels, no weather, no itinerary.
- After the tool returns, write 2–3 sentences. Lead with the cheapest and most direct option. Frame results as "best options across [month]", not as flights on a specific date.
- If no fares found: one sentence explaining the route is thin (one-stop or date shift needed). Do not apologise at length.
- Do not list prices or flight numbers in prose — the cards show all of that.
- End with exactly one question: ask whether the user wants a full trip plan built around these flights.
"""


def _build_llm(*, enable_tool_calls: bool) -> Any:
    llm = ChatOpenAI(
        model="gpt-4.1-mini",
        temperature=0.5,
        streaming=True,
        openai_api_key=settings.openai_api_key,
    )
    if enable_tool_calls:
        return llm.bind(parallel_tool_calls=False)
    return llm


def _build_agent(prompt: str, tools: list[Any], name: str) -> Any:
    return create_react_agent(
        model=_build_llm(enable_tool_calls=bool(tools)),
        tools=tools,
        prompt=SystemMessage(content=prompt),
        version="v2",
        name=name,
    )


def _strip_preface(text: str) -> str:
    cleaned = text.strip()
    while cleaned.startswith("["):
        end = cleaned.find("]")
        if end == -1:
            break
        cleaned = cleaned[end + 1 :].lstrip()
    return cleaned


def _latest_user_text(state: dict[str, Any]) -> str:
    messages = state.get("messages", [])
    for message in reversed(messages):
        if isinstance(message, tuple) and len(message) >= 2 and message[0] == "user":
            return _strip_preface(str(message[1]))
        if isinstance(message, dict) and message.get("role") == "user":
            return _strip_preface(str(message.get("content", "")))
    return ""


def _all_user_text(state: dict[str, Any]) -> str:
    messages = state.get("messages", [])
    parts: list[str] = []
    for message in messages:
        if isinstance(message, tuple) and len(message) >= 2 and message[0] == "user":
            parts.append(_strip_preface(str(message[1])))
        elif isinstance(message, dict) and message.get("role") == "user":
            parts.append(_strip_preface(str(message.get("content", ""))))
    return "\n".join(part for part in parts if part).strip()


def _has_specific_destination_hint(text: str, trip_context: dict[str, Any]) -> bool:
    if trip_context.get("destination"):
        return True

    lower = text.lower()
    generic_location_words = {
        "january", "february", "march", "april", "may", "june", "july", "august",
        "september", "october", "november", "december", "jan", "feb", "mar", "apr",
        "jun", "jul", "aug", "sep", "sept", "oct", "nov", "dec", "spring", "summer",
        "autumn", "fall", "winter", "week", "weekend", "month", "today", "tomorrow",
        "tonight", "next", "this", "somewhere", "warm", "cold", "cheap", "luxury",
    }
    patterns = (
        r"\b(?:to|in|for|visit(?:ing)?|going to|trip to|holiday in|vacation in|weekend in)\s+([a-z][a-z]+(?:[\s-][a-z][a-z]+){0,2})\b",
        r"\b\d+\s+days?\s+in\s+([a-z][a-z]+(?:[\s-][a-z][a-z]+){0,2})\b",
        r"\b(?:things to do|what to do|where to eat|places to eat|restaurants|landmarks|must see|must-see|top sights)\s+in\s+([a-z][a-z]+(?:[\s-][a-z][a-z]+){0,2})\b",
    )
    for pattern in patterns:
        for match in re.finditer(pattern, lower):
            phrase = match.group(1).strip()
            words = [word for word in re.split(r"[\s-]+", phrase) if word]
            if not words:
                continue
            if any(word in generic_location_words for word in words):
                continue
            return True
    return False


def _has_date_context(text: str, trip_context: dict[str, Any]) -> bool:
    if trip_context.get("start_date") or trip_context.get("end_date"):
        return True
    date_patterns = (
        r"\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\b",
        r"\b\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?\b",
        r"\b\d{4}-\d{2}-\d{2}\b",
        r"\bnext\s+(?:week|month|spring|summer|autumn|fall|winter)\b",
        r"\bthis\s+(?:week|month|summer|autumn|fall|winter)\b",
        r"\b(?:weekend|long weekend)\b",
    )
    lower = text.lower()
    return any(re.search(pattern, lower) for pattern in date_patterns)


def _has_party_context(text: str, trip_context: dict[str, Any]) -> bool:
    if trip_context.get("party_size"):
        return True
    lower = text.lower()
    patterns = (
        r"\b(?:solo|just me|by myself|on my own)\b",
        r"\b(?:for|with)\s+\d+\s+(?:people|travellers|travelers|adults|kids|children)\b",
        r"\b(?:couple|two of us|the two of us|family of \d+)\b",
        r"\b\d+\s+(?:travellers|travelers|people|adults)\b",
    )
    return any(re.search(pattern, lower) for pattern in patterns)


def _has_budget_scope_context(text: str, trip_context: dict[str, Any]) -> bool:
    if trip_context.get("budget_gbp") and trip_context.get("party_size"):
        return True
    lower = text.lower()
    return (
        "includes flights" in lower
        or "including flights" in lower
        or "with flights" in lower
        or "excluding flights" in lower
        or "without flights" in lower
        or "flights included" in lower
    )



def _needs_planning_intake(state: dict[str, Any]) -> bool:
    trip_context = state.get("trip_context") or {}
    conversation = _all_user_text(state)
    latest = _latest_user_text(state)
    lower_latest = latest.lower()

    if not _has_specific_destination_hint(conversation, trip_context):
        return False

    follow_up_markers = (
        "best restaurants",
        "best beaches",
        "compare",
        "adjust",
        "refine",
        "swap",
        "near my hotel",
        "what about",
        "can you tweak",
    )
    if any(marker in lower_latest for marker in follow_up_markers):
        return False

    needs_dates = not _has_date_context(conversation, trip_context)
    needs_party = not _has_party_context(conversation, trip_context)
    needs_budget_scope = "budget" in conversation.lower() and not _has_budget_scope_context(conversation, trip_context)

    return needs_dates or needs_party or needs_budget_scope


def _is_explicit_planning_request(user_text: str, trip_context: dict[str, Any]) -> bool:
    lower = user_text.lower()
    planning_terms = (
        "plan",
        "itinerary",
        "book",
        "flight",
        "hotel",
        "days in",
        "weekend",
        "put together",
        "build me",
        "organise",
        "organize",
    )
    return _has_specific_destination_hint(user_text, trip_context) and any(term in lower for term in planning_terms)


def _detect_mode(state: dict[str, Any]) -> str:
    user_text = _latest_user_text(state)
    lower = user_text.lower()
    trip_context = state.get("trip_context") or {}

    discovery_terms = (
        "surprise me",
        "somewhere warm",
        "where should i go",
        "suggest some destinations",
        "i don't know where",
        "dont know where",
        "honeymoon",
    )
    if any(term in lower for term in discovery_terms):
        return "discovery"

    # Standalone flight search (no "plan"/"itinerary" intent) → flight_lookup only
    flight_search_phrases = (
        "find flights",
        "search flights",
        "look for flights",
        "get me flights",
        "book flights",
        "show me flights",
        "any flights",
    )
    full_plan_terms = ("plan", "itinerary", "build me", "organise", "organize", "days in", "put together")
    if any(phrase in lower for phrase in flight_search_phrases) and not any(t in lower for t in full_plan_terms):
        return "flight_lookup"

    if _is_explicit_planning_request(user_text, trip_context):
        if _needs_planning_intake(state):
            return "planner_intake"
        return "planner"

    place_lookup_terms = (
        "where can i",
        "where do i",
        "find me",
        "good pharmacies",
        "rent a car",
        "rooftop bars",
        "laundromat",
        "souvenirs",
        "best pizza",
        "near my hotel",
    )
    if any(term in lower for term in place_lookup_terms):
        return "place_lookup"

    info_terms = (
        "best time to visit",
        "tell me about",
        "what to do",
        "things to do",
        "is it safe",
        "safe at night",
        "how do i get around",
        "what should i pack",
        "when it rains",
        "landmarks",
        "must see",
        "must-see",
        "top sights",
        "where to eat",
        "places to eat",
        "restaurants in",
        "food in",
    )
    if any(term in lower for term in info_terms):
        return "info"

    if _has_specific_destination_hint(user_text, trip_context) and "?" in user_text:
        return "info"

    if _has_specific_destination_hint(user_text, trip_context):
        return "info"

    return "info"


class RoutedGraph:
    def __init__(self) -> None:
        self.discovery_agent = _build_agent(
            DISCOVERY_PROMPT,
            [suggest_destinations],
            "discovery_agent",
        )
        self.planning_intake_agent = _build_agent(
            PLANNING_INTAKE_PROMPT,
            [],
            "planning_intake_agent",
        )
        self.info_agent = _build_agent(
            INFO_PROMPT,
            [search_places],
            "info_agent",
        )
        self.place_lookup_agent = _build_agent(
            PLACE_LOOKUP_PROMPT,
            [search_places],
            "place_lookup_agent",
        )
        self.flight_lookup_agent = _build_agent(
            FLIGHT_LOOKUP_PROMPT,
            [search_flights],
            "flight_lookup_agent",
        )
        self.planner_agent = _build_agent(
            FULL_PLANNER_PROMPT,
            [
                get_country_info,
                search_flights,
                search_hotels,
                get_weather_forecast,
                get_currency_exchange,
                search_places,
                calculate_budget,
                generate_itinerary,
            ],
            "planner_agent",
        )

    def _select_agent(self, state: dict[str, Any]) -> Any:
        mode = _detect_mode(state)
        logger.info("Router selected mode=%s", mode)
        if mode == "discovery":
            return self.discovery_agent
        if mode == "planner_intake":
            return self.planning_intake_agent
        if mode == "place_lookup":
            return self.place_lookup_agent
        if mode == "flight_lookup":
            return self.flight_lookup_agent
        if mode == "info":
            return self.info_agent
        return self.planner_agent

    async def astream_events(self, state: dict[str, Any], *args: Any, **kwargs: Any) -> Any:
        agent = self._select_agent(state)
        async for event in agent.astream_events(state, *args, **kwargs):
            yield event


graph = RoutedGraph()
