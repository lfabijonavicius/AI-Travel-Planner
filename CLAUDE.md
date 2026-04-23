# CLAUDE.md — Voyager Travel Planning Agent

> This file is the source of truth for Claude Code working on this project.
> Read it fully before writing any code, creating any files, or making any architectural decisions.

---

## Project overview

**Voyager** is an AI-powered full-trip travel planning agent. The user describes a trip in natural language and the agent autonomously calls multiple travel APIs, stitches the results together, and returns structured flight options, hotel options, a day-by-day itinerary, weather forecast, budget breakdown, and country information — all rendered as interactive cards **inline in the chat**, similar to Mindtrip.

This is a portfolio project built for a course assessment. It should be production-quality in structure and polish, not just a working prototype.

---

## Current build status

**Phase 1 is complete.** The backend skeleton is working:
- FastAPI app with `/health` endpoint ✅
- LangGraph ReAct agent with `get_country_info` tool ✅
- SSE streaming endpoint `/api/chat/stream` working ✅
- Python venv created at `backend/venv/` ✅
- REST Countries API confirmed working ✅

**Next step: Phase 2** — add `search_flights`, `search_hotels`, `get_weather_forecast`, `get_currency_exchange` tools and test each individually.

**OpenAI key:** needs to be added to `backend/.env` before running the server.

**To start the backend:**
```bash
cd backend
source venv/bin/activate
uvicorn main:app --reload
```

**To test the stream:**
```bash
curl -X POST http://localhost:8000/api/chat/stream \
  -H "Content-Type: application/json" \
  -d '{"message": "Tell me about Japan as a travel destination"}' \
  --no-buffer
```

---

## Tech stack

| Layer | Technology |
|---|---|
| Backend framework | FastAPI (Python) |
| Agent framework | LangGraph (ReAct agent) |
| LLM | OpenAI GPT-4o |
| Frontend | Next.js 14 (App Router) + TypeScript |
| Styling | Tailwind CSS |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth |
| Streaming | Server-Sent Events (SSE) |
| Map | Leaflet.js (no API key needed) |

---

## APIs and environment variables

All secrets live in `backend/.env` and `frontend/.env.local`. Never hardcode keys.

```
# backend/.env
OPENAI_API_KEY=
TRAVELPAYOUTS_API_KEY=
RAPIDAPI_KEY=
GOOGLE_PLACES_API_KEY=
OPENWEATHER_API_KEY=
EXCHANGERATE_API_KEY=
SUPABASE_URL=
SUPABASE_SERVICE_KEY=

# frontend/.env.local
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### API reference

| Tool | API | Base URL | Notes |
|---|---|---|---|
| `search_flights` | Travelpayouts (Aviasales) | `https://api.travelpayouts.com/v1/prices/cheap` | Free, via Travelpayouts token, booking URL → aviasales.com |
| `search_hotels` | RapidAPI Hotels (Booking.com) | `https://booking-com.p.rapidapi.com` | Free tier |
| `search_places` | Google Places API (New) | `https://places.googleapis.com/v1/places:searchText` | $200/month free credit |
| `get_weather_forecast` | OpenWeatherMap | `https://api.openweathermap.org/data/2.5/forecast` | Free tier, 5-day/3hr |
| `get_currency_exchange` | ExchangeRate-API | `https://v6.exchangerate-api.com/v6/{key}/latest/GBP` | Free tier |
| `get_country_info` | REST Countries | `https://restcountries.com/v3.1/name/{country}` | No key needed — already implemented |
| `calculate_budget` | Internal | — | Pure Python logic |
| `generate_itinerary` | Internal (LLM) | — | Structured JSON output |

---

## Folder structure

```
Travel-Planner/
├── CLAUDE.md
├── backend/
│   ├── main.py                  # FastAPI app, SSE endpoint — DONE
│   ├── config.py                # pydantic-settings — DONE
│   ├── requirements.txt         # DONE
│   ├── .env                     # needs OPENAI_API_KEY filled in
│   ├── venv/                    # Python virtualenv — DONE
│   ├── agent/
│   │   ├── __init__.py          # DONE
│   │   ├── graph.py             # LangGraph ReAct agent — DONE
│   │   ├── state.py             # AgentState TypedDict — DONE
│   │   └── tools/
│   │       ├── __init__.py      # registers all_tools — DONE (country only for now)
│   │       ├── country.py       # get_country_info — DONE
│   │       ├── flights.py       # search_flights — TODO Phase 2
│   │       ├── hotels.py        # search_hotels — TODO Phase 2
│   │       ├── weather.py       # get_weather_forecast — TODO Phase 2
│   │       ├── currency.py      # get_currency_exchange — TODO Phase 2
│   │       ├── places.py        # search_places — TODO Phase 3
│   │       ├── budget.py        # calculate_budget — TODO Phase 3
│   │       └── itinerary.py     # generate_itinerary — TODO Phase 3
│   ├── memory/
│   │   └── store.py             # Supabase persistence — TODO Phase 7
│   └── models/
│       └── schemas.py           # Pydantic models — TODO Phase 3
│
└── frontend/                    # TODO Phase 4
    ├── app/
    │   ├── layout.tsx
    │   ├── page.tsx
    │   └── trip/[id]/page.tsx
    ├── components/
    │   ├── layout/
    │   │   ├── Sidebar.tsx
    │   │   └── RightPanel.tsx
    │   ├── chat/
    │   │   ├── ChatWindow.tsx
    │   │   ├── ChatInput.tsx
    │   │   ├── ChatBubble.tsx
    │   │   ├── ToolCallIndicator.tsx
    │   │   └── InlineCardRenderer.tsx
    │   ├── cards/
    │   │   ├── FlightCard.tsx
    │   │   ├── HotelCard.tsx
    │   │   ├── PlaceCard.tsx
    │   │   ├── WeatherStrip.tsx
    │   │   └── CountryInfoPanel.tsx
    │   ├── itinerary/
    │   │   └── ItineraryTimeline.tsx
    │   ├── map/
    │   │   ├── MapTab.tsx
    │   │   ├── MiniMap.tsx
    │   │   └── mapIcons.ts
    │   └── empty/
    │       └── EmptyState.tsx
    ├── hooks/
    │   ├── useSSE.ts
    │   └── useTripStore.ts
    ├── types/index.ts
    ├── lib/supabase.ts
    └── .env.local
```

---

## Agent architecture

### LangGraph ReAct pattern

```
user message → LangGraph ReAct agent → [think → pick tool → call tool → observe → repeat] → final response
```

### State (`agent/state.py`) — DONE

```python
class AgentState(TypedDict):
    messages: Annotated[list, add_messages]
    trip_context: dict
    tool_results: dict
    itinerary: dict | None
```

### Graph (`agent/graph.py`) — DONE

```python
graph = create_react_agent(
    model=ChatOpenAI(model="gpt-4o", temperature=0.3, streaming=True),
    tools=all_tools,
    prompt=SystemMessage(content=SYSTEM_PROMPT),
)
```

### Tool registration (`agent/tools/__init__.py`)

Currently only `get_country_info`. Add each new tool here as Phase 2/3 progress.

---

## Tool specifications

### 1. `get_country_info` — DONE
Calls REST Countries API. Returns name, capital, region, languages, currencies, flag emoji.

### 2. `search_flights` — TODO Phase 2

```python
@tool
def search_flights(origin: str, destination: str, departure_date: str, return_date: str, adults: int = 2) -> list[dict]:
    """Search for available flights between two airports on given dates.
    Returns a list of flight options with airline, price, duration, stops, and booking URL."""
```

API: Kiwi Tequila `GET https://api.tequila.kiwi.com/v2/search`
Key header: `apikey: KIWI_TEQUILA_API_KEY`
Key params: `fly_from`, `fly_to`, `date_from`, `date_to`, `adults`, `curr=GBP`, `limit=3`
Include `deep_link` from response as `booking_url`.

### 3. `search_hotels` — TODO Phase 2

```python
@tool
def search_hotels(city: str, check_in: str, check_out: str, guests: int = 2, max_results: int = 4) -> list[dict]:
    """Search for available hotels in a city for given dates.
    Returns hotels with name, star rating, price per night, photo URL, and booking URL."""
```

API: RapidAPI Booking.com `booking-com.p.rapidapi.com`
Include `main_photo_url` as `photo_url` and construct `booking_url` from hotel `url` + date params.

### 4. `get_weather_forecast` — TODO Phase 2

```python
@tool
def get_weather_forecast(city: str, start_date: str, end_date: str) -> list[dict]:
    """Get weather forecast for a city over a date range.
    Returns daily forecast with temperature highs/lows, conditions, and precipitation probability."""
```

API: OpenWeatherMap `https://api.openweathermap.org/data/2.5/forecast`

### 5. `get_currency_exchange` — TODO Phase 2

```python
@tool
def get_currency_exchange(base_currency: str = "GBP", target_currency: str = "JPY") -> dict:
    """Get current exchange rate between two currencies."""
```

API: ExchangeRate-API `https://v6.exchangerate-api.com/v6/{key}/latest/{base}`

### 6. `search_places` — TODO Phase 3

```python
@tool
def search_places(city: str, category: str = "attractions") -> list[dict]:
    """Search for points of interest, activities, and restaurants using Google Places.
    Returns places with name, rating, coordinates, and photo URL."""
```

API: Google Places (New) `https://places.googleapis.com/v1/places:searchText`
Photos require a second request — fetch inside the tool, return ready-to-use URL.

```python
def get_place_photo_url(photo_name: str, max_width: int = 400) -> str | None:
    url = f"https://places.googleapis.com/v1/{photo_name}/media"
    params = {"maxWidthPx": max_width, "key": PLACES_API_KEY, "skipHttpRedirect": "false"}
    response = requests.get(url, params=params, allow_redirects=True, timeout=5)
    return response.url
```

### 7. `calculate_budget` — TODO Phase 3

```python
@tool
def calculate_budget(flight_price_per_person: float, hotel_price_per_night: float,
                     num_nights: int, num_people: int, activities_estimate: float = 0,
                     food_per_day_estimate: float = 0, total_budget: float = 0) -> dict:
    """Calculate total trip cost breakdown and compare against budget."""
```

### 8. `generate_itinerary` — TODO Phase 3

```python
@tool
def generate_itinerary(destination: str, start_date: str, end_date: str,
                       hotel: dict, flights: dict, places: list[dict], weather: list[dict]) -> dict:
    """Generate a structured day-by-day itinerary as JSON for the frontend timeline."""
```

Must return JSON matching this schema exactly:
```typescript
interface ItineraryDay {
  day_number: number;
  date: string;
  city: string;
  label: string;
  weather_icon: string;
  weather_high: number;
  weather_low: number;
  events: {
    time: string;
    title: string;
    subtitle: string;
    type: "flight" | "hotel" | "activity" | "poi" | "food" | "transport";
    price_local?: string;
    duration_minutes?: number;
    coordinates?: { lat: number; lng: number };
  }[];
}
```

---

## Streaming SSE architecture — DONE

Backend streams four event types:
- `{type: "token", content: "..."}` — LLM text chunk
- `{type: "tool_start", tool: "...", inputs: {...}}` — tool is running
- `{type: "tool_result", tool: "...", output: {...}}` — tool completed
- `{type: "error", content: "..."}` — error occurred
- `[DONE]` — stream complete

Frontend `InlineCardRenderer` switches on `tool` name from `tool_result` events to render the correct card inline in chat.

---

## UI layout

```
┌──────────────┬───────────────────────────────┬───────────────────┐
│  Saved trips │  [Chat | Itinerary | Map]      │  Budget tracker   │
│  sidebar     │                               ├───────────────────┤
│  220px       │  Chat messages + inline cards  │  MiniMap          │
│              │  scroll here                  │  (clickable →     │
│  + New trip  │                               │   Map tab)        │
│              │  [chat input bar at bottom]   ├───────────────────┤
│              │                               │  Currency         │
│              │                               ├───────────────────┤
│              │                               │  Tokens / cost    │
└──────────────┴───────────────────────────────┴───────────────────┘
```

**3 tabs:** Chat (default, cards inline), Itinerary (timeline), Map (full-width Leaflet)

**First load:** EmptyState — logo, 3 prompt chips, single input. Tabs appear after first response.

**Inline card rendering:** Each `tool_result` SSE event renders a card inline in the chat:
- `search_flights` → FlightCard
- `search_hotels` → HotelCard
- `get_weather_forecast` → WeatherStrip
- `search_places` → PlaceCard
- `get_country_info` → CountryInfoPanel
- `calculate_budget` → right panel only (no inline card)
- `get_currency_exchange` → right panel only (no inline card)
- `generate_itinerary` → Itinerary tab only (no inline card)

---

## Key design decisions

- **Inline cards in chat (Mindtrip-style):** cards appear inline as tools complete, no separate Results tab
- **3 tabs not 4:** Chat + Itinerary + Map — Results tab removed
- **Leaflet not Google Maps:** free, no key, indistinguishable in demos
- **Booking deep links:** "Book now →" on FlightCard (Kiwi deep_link) and HotelCard (Booking.com URL + date params) — no in-app payment
- **generate_itinerary as a tool:** returns structured JSON so frontend timeline always renders correctly
- **Map pins:** plain circle = not on itinerary, blue tick = on itinerary. Shared Zustand state between MiniMap and MapTab
- **MarkerCluster:** only on full MapTab, not MiniMap

---

## Build order

### Phase 1 — backend skeleton ✅ COMPLETE
- FastAPI + `/health` + SSE endpoint
- LangGraph agent with `get_country_info`
- Venv set up, REST Countries API confirmed

### Phase 2 — core tools (next)
- [ ] `search_flights` (Kiwi Tequila) — needs `KIWI_TEQUILA_API_KEY`
- [ ] `search_hotels` (RapidAPI) — needs `RAPIDAPI_KEY`
- [ ] `get_weather_forecast` (OpenWeatherMap) — needs `OPENWEATHER_API_KEY`
- [ ] `get_currency_exchange` (ExchangeRate-API) — needs `EXCHANGERATE_API_KEY`
- [ ] Register all 4 in `agent/tools/__init__.py`
- [ ] Test each individually before adding to agent

### Phase 3 — derived tools
- [ ] `search_places` (Google Places) — needs `GOOGLE_PLACES_API_KEY`
- [ ] `calculate_budget` (internal)
- [ ] `generate_itinerary` (internal LLM)
- [ ] Full agent run: "Plan 7 days in Tokyo" → all 8 tools fire

### Phase 4 — frontend foundation
- [ ] Next.js 14 app with three-column layout
- [ ] Sidebar, EmptyState, ChatInput
- [ ] useSSE hook connecting to backend
- [ ] Tabs appear after first response

### Phase 5 — inline cards in chat
- [ ] InlineCardRenderer switching on tool name
- [ ] FlightCard, HotelCard, WeatherStrip, PlaceCard, CountryInfoPanel
- [ ] ToolCallIndicator between cards
- [ ] calculate_budget + get_currency_exchange update right panel silently

### Phase 6 — itinerary + map + right panel
- [ ] ItineraryTimeline in Itinerary tab
- [ ] Budget tracker updates live
- [ ] MiniMap + MapTab with markercluster and rich popups

### Phase 7 — persistence + auth
- [ ] Supabase schema (trips + messages tables with RLS)
- [ ] Save trips after generate_itinerary
- [ ] Supabase Auth login/signup
- [ ] Saved trips in sidebar

### Phase 8 — polish
- [ ] Collapse older card sets on follow-up message
- [ ] Loading skeletons while tools run
- [ ] Error states per card
- [ ] Mobile responsive
- [ ] Token/cost display in right panel
- [ ] Trip memory (user preferences)

---

## Optional tasks (for max grade)

| Task | Difficulty |
|---|---|
| Token usage + cost display | Medium — right panel |
| Short-term memory via LangGraph state | Medium |
| Long-term memory via Supabase user_preferences | Medium |
| Feedback loop (thumbs up/down) | Medium |
| RAG — user uploads destination PDF | Hard |

---

## Error handling pattern

Every tool must catch and return structured errors — never raise exceptions:

```python
except requests.Timeout:
    return [{"error": "Request timed out. Try again."}]
except requests.HTTPError as e:
    return [{"error": f"API error: {str(e)}"}]
except Exception as e:
    return [{"error": f"Unexpected error: {str(e)}"}]
```

---

## Common mistakes to avoid

- Do not return raw API responses — parse and return only fields the frontend needs
- Do not call `generate_itinerary` before flights and hotels have returned
- Do not hardcode currency as GBP — infer from user origin or ask
- Do not store API keys in frontend — all API calls go through FastAPI backend
- Do not use `any` types in TypeScript — define interfaces in `types/index.ts`
- Do not hide "Book now →" behind selected state — always visible
- Do not construct booking URLs on frontend — backend tool returns `booking_url`
- Do not render `generate_itinerary` inline in chat — Itinerary tab only
- Do not render `calculate_budget` or `get_currency_exchange` as inline cards — right panel only
