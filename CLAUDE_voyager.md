# CLAUDE.md — Voyager Travel Planning Agent

> This file is the source of truth for Claude Code working on this project.
> Read it fully before writing any code, creating any files, or making any architectural decisions.

---

## Project overview

**Voyager** is an AI-powered full-trip travel planning agent. The user describes a trip in natural language and the agent autonomously calls multiple travel APIs, stitches the results together, and returns structured flight options, hotel options, a day-by-day itinerary, weather forecast, budget breakdown, and country information — all rendered as interactive cards **inline in the chat**, similar to Mindtrip.

This is a portfolio project built for a course assessment. It should be production-quality in structure and polish, not just a working prototype.

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

This stack mirrors the FinSight project pattern. Do not deviate from it without a strong reason.

---

## APIs and environment variables

All secrets live in `.env` (backend) and `.env.local` (frontend). Never hardcode keys.

```
# Backend .env
OPENAI_API_KEY=
KIWI_TEQUILA_API_KEY=
RAPIDAPI_KEY=
GOOGLE_PLACES_API_KEY=
OPENWEATHER_API_KEY=
EXCHANGERATE_API_KEY=
SUPABASE_URL=
SUPABASE_SERVICE_KEY=

# Frontend .env.local
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### API reference

| Tool | API | Base URL | Notes |
|---|---|---|---|
| `search_flights` | Kiwi.com Tequila | `https://api.tequila.kiwi.com/v2/search` | Free, real prices |
| `search_hotels` | RapidAPI Hotels | `https://booking-com.p.rapidapi.com` | Free tier |
| `search_places` | Google Places API (New) | `https://places.googleapis.com/v1/places:searchText` | $200/month free credit |
| `get_weather_forecast` | OpenWeatherMap | `https://api.openweathermap.org/data/2.5/forecast` | Free tier, 5-day/3hr |
| `get_currency_exchange` | ExchangeRate-API | `https://v6.exchangerate-api.com/v6/{key}/latest/GBP` | Free tier |
| `get_country_info` | REST Countries | `https://restcountries.com/v3.1/name/{country}` | No key needed |
| `calculate_budget` | Internal | — | Pure Python logic |
| `generate_itinerary` | Internal (LLM) | — | Structured JSON output |

---

## Folder structure

```
voyager/
├── backend/
│   ├── main.py                  # FastAPI app, SSE endpoint
│   ├── agent/
│   │   ├── graph.py             # LangGraph ReAct agent definition
│   │   ├── state.py             # AgentState TypedDict
│   │   └── tools/
│   │       ├── __init__.py
│   │       ├── flights.py       # search_flights tool
│   │       ├── hotels.py        # search_hotels tool
│   │       ├── places.py        # search_places tool
│   │       ├── weather.py       # get_weather_forecast tool
│   │       ├── currency.py      # get_currency_exchange tool
│   │       ├── country.py       # get_country_info tool
│   │       ├── budget.py        # calculate_budget tool
│   │       └── itinerary.py     # generate_itinerary tool
│   ├── memory/
│   │   └── store.py             # Supabase conversation + trip persistence
│   ├── models/
│   │   └── schemas.py           # Pydantic models for tool inputs/outputs
│   ├── requirements.txt
│   └── .env
│
└── frontend/
    ├── app/
    │   ├── layout.tsx
    │   ├── page.tsx             # Entry: empty state / onboarding
    │   └── trip/
    │       └── [id]/
    │           └── page.tsx     # Active trip view
    ├── components/
    │   ├── layout/
    │   │   ├── Sidebar.tsx      # Saved trips list + new trip button
    │   │   └── RightPanel.tsx   # Budget tracker, mini-map, currency, tokens
    │   ├── chat/
    │   │   ├── ChatWindow.tsx   # Scrolling chat + inline card renderer
    │   │   ├── ChatInput.tsx
    │   │   ├── ChatBubble.tsx   # Text message bubble (user + assistant)
    │   │   ├── ToolCallIndicator.tsx
    │   │   └── InlineCardRenderer.tsx  # Switches on tool name → renders correct card
    │   ├── cards/
    │   │   ├── FlightCard.tsx
    │   │   ├── HotelCard.tsx
    │   │   ├── PlaceCard.tsx
    │   │   ├── WeatherStrip.tsx
    │   │   └── CountryInfoPanel.tsx
    │   ├── itinerary/
    │   │   └── ItineraryTimeline.tsx
    │   ├── map/
    │   │   ├── MapTab.tsx           # Full-width map tab view
    │   │   ├── MiniMap.tsx          # Right sidebar preview, clickable
    │   │   └── mapIcons.ts          # Plain + tick DivIcon definitions
    │   └── empty/
    │       └── EmptyState.tsx       # Welcome screen with suggested prompts
    ├── hooks/
    │   ├── useSSE.ts            # SSE streaming hook
    │   └── useTripStore.ts      # Zustand store for trip state
    ├── types/
    │   └── index.ts             # Shared TypeScript types
    ├── lib/
    │   └── supabase.ts
    ├── .env.local
    └── package.json
```

---

## Agent architecture

### LangGraph ReAct pattern

The agent follows the same ReAct (Reason + Act) loop used in FinSight:

```
user message
    ↓
LangGraph ReAct agent
    ↓
[think → pick tool → call tool → observe result → repeat]
    ↓
final response with structured data
```

### State definition (`agent/state.py`)

```python
from typing import TypedDict, Annotated
from langgraph.graph.message import add_messages

class AgentState(TypedDict):
    messages: Annotated[list, add_messages]
    trip_context: dict          # destination, dates, budget, party size
    tool_results: dict          # accumulated results from all tool calls
    itinerary: dict | None      # structured itinerary JSON once generated
```

### Graph definition (`agent/graph.py`)

```python
from langgraph.prebuilt import create_react_agent
from langchain_openai import ChatOpenAI
from .tools import all_tools

llm = ChatOpenAI(model="gpt-4o", temperature=0.3, streaming=True)

graph = create_react_agent(
    model=llm,
    tools=all_tools,
    state_schema=AgentState,
)
```

### Tool registration (`agent/tools/__init__.py`)

```python
from .flights import search_flights
from .hotels import search_hotels
from .places import search_places
from .weather import get_weather_forecast
from .currency import get_currency_exchange
from .country import get_country_info
from .budget import calculate_budget
from .itinerary import generate_itinerary

all_tools = [
    search_flights,
    search_hotels,
    search_places,
    get_weather_forecast,
    get_currency_exchange,
    get_country_info,
    calculate_budget,
    generate_itinerary,
]
```

---

## Tool specifications

Each tool is decorated with `@tool` from `langchain_core.tools`. Every tool must have a clear docstring — LangGraph uses the docstring to decide when to call it.

### 1. `search_flights`

```python
@tool
def search_flights(
    origin: str,          # IATA code e.g. "LHR"
    destination: str,     # IATA code e.g. "HND"
    departure_date: str,  # "YYYY-MM-DD"
    return_date: str,     # "YYYY-MM-DD"
    adults: int = 2
) -> list[dict]:
    """Search for available flights between two airports on given dates.
    Returns a list of flight options with airline, price, duration, stops."""
```

Returns list of:
```json
{
  "airline": "Japan Airlines",
  "flight_number": "JL 41",
  "origin": "LHR",
  "destination": "HND",
  "departure_time": "09:10",
  "arrival_time": "07:00+1",
  "duration_minutes": 770,
  "stops": 0,
  "price_gbp": 742,
  "cabin": "economy",
  "booking_url": "https://kiwi.com/deep?..."
}
```

### 2. `search_hotels`

```python
@tool
def search_hotels(
    city: str,
    check_in: str,        # "YYYY-MM-DD"
    check_out: str,       # "YYYY-MM-DD"
    guests: int = 2,
    max_results: int = 4
) -> list[dict]:
    """Search for available hotels in a city for given dates.
    Returns hotels with name, star rating, price per night, location,
    photo URL, and booking deep link."""
```

```python
# In search_hotels tool, include:
{
  ...hotel fields...,
  "photo_url": hotel.get("main_photo_url"),  # direct from RapidAPI response
  "booking_url": f"{hotel['url']}?checkin={check_in}&checkout={check_out}&group_adults={guests}"
}
```

### 3. `search_places`

```python
@tool
def search_places(
    city: str,
    category: str = "attractions"  # "attractions" | "restaurants" | "activities"
) -> list[dict]:
    """Search for points of interest, activities, and restaurants in a city
    using Google Places. Returns places with name, rating, price level,
    coordinates, opening hours, and a photo URL."""
```

Returns list including `lat` and `lng` fields — these are passed to the map component.

**Photo fetching — important implementation detail:**

Google Places (New) API returns photo references, not direct URLs. Fetching a photo requires a second request. Do this inside the tool so the frontend receives a ready-to-use URL.

```python
PLACES_API_KEY = os.getenv("GOOGLE_PLACES_API_KEY")

def get_place_photo_url(photo_name: str, max_width: int = 400) -> str | None:
    """Convert a Google Places photo reference into a usable image URL."""
    if not photo_name:
        return None
    url = f"https://places.googleapis.com/v1/{photo_name}/media"
    params = {
        "maxWidthPx": max_width,
        "key": PLACES_API_KEY,
        "skipHttpRedirect": "false"
    }
    try:
        response = requests.get(url, params=params, allow_redirects=True, timeout=5)
        return response.url
    except Exception:
        return None

@tool
def search_places(city: str, category: str = "attractions") -> list[dict]:
    """..."""
    search_response = requests.post(
        "https://places.googleapis.com/v1/places:searchText",
        headers={
            "X-Goog-Api-Key": PLACES_API_KEY,
            "X-Goog-FieldMask": "places.displayName,places.rating,places.priceLevel,"
                                 "places.location,places.regularOpeningHours,"
                                 "places.photos,places.editorialSummary"
        },
        json={"textQuery": f"{category} in {city}", "maxResultCount": 6}
    )
    places = search_response.json().get("places", [])

    results = []
    for place in places:
        photos = place.get("photos", [])
        photo_url = get_place_photo_url(photos[0]["name"]) if photos else None

        results.append({
            "name": place["displayName"]["text"],
            "rating": place.get("rating"),
            "price_level": place.get("priceLevel"),
            "lat": place["location"]["latitude"],
            "lng": place["location"]["longitude"],
            "open_now": place.get("regularOpeningHours", {}).get("openNow"),
            "summary": place.get("editorialSummary", {}).get("text"),
            "photo_url": photo_url,
        })
    return results
```

**Rate limit note:** At ~6 places per search with one photo each, you have headroom for ~1,000 searches/month before any charge on the $200 free credit.

### 4. `get_weather_forecast`

```python
@tool
def get_weather_forecast(
    city: str,
    start_date: str,  # "YYYY-MM-DD"
    end_date: str
) -> list[dict]:
    """Get weather forecast for a city over a date range.
    Returns daily forecast with temperature highs/lows, conditions,
    and precipitation probability."""
```

### 5. `get_currency_exchange`

```python
@tool
def get_currency_exchange(
    base_currency: str = "GBP",
    target_currency: str = "JPY"
) -> dict:
    """Get current exchange rate between two currencies.
    Returns rate and common conversion amounts."""
```

### 6. `get_country_info`

```python
@tool
def get_country_info(country: str) -> dict:
    """Get practical travel information for a country including
    visa requirements, safety rating, official language, currency,
    and travel tips."""
```

Returns:
```json
{
  "name": "Japan",
  "capital": "Tokyo",
  "language": "Japanese",
  "currency_code": "JPY",
  "visa_required_for_uk": false,
  "visa_note": "90 days visa-free, passport valid 6+ months",
  "safety_score": 88,
  "safety_label": "Very safe",
  "practical_tips": ["Get IC Suica card for transit", "Cash-heavy culture", "No tipping"]
}
```

### 7. `calculate_budget`

```python
@tool
def calculate_budget(
    flight_price_per_person: float,
    hotel_price_per_night: float,
    num_nights: int,
    num_people: int,
    activities_estimate: float = 0,
    food_per_day_estimate: float = 0,
    total_budget: float = 0
) -> dict:
    """Calculate total trip cost breakdown and compare against budget.
    Returns itemised costs and whether the trip is within budget."""
```

### 8. `generate_itinerary`

```python
@tool
def generate_itinerary(
    destination: str,
    start_date: str,
    end_date: str,
    hotel: dict,
    flights: dict,
    places: list[dict],
    weather: list[dict]
) -> dict:
    """Generate a structured day-by-day itinerary as JSON, stitching together
    flights, hotel check-in/out, recommended places, meals, and weather-aware
    activity scheduling. Returns a schema the frontend renders as a timeline."""
```

**Critical:** This tool must return structured JSON matching the `ItinerarySchema` exactly. The frontend timeline renderer depends on this schema — do not change it without updating the frontend type definitions.

```typescript
// types/index.ts
interface ItineraryEvent {
  time: string;           // "09:30"
  title: string;
  subtitle: string;
  type: "flight" | "hotel" | "activity" | "poi" | "food" | "transport";
  price_local?: string;   // "¥3,200"
  duration_minutes?: number;
  coordinates?: { lat: number; lng: number };
}

interface ItineraryDay {
  day_number: number;
  date: string;           // "2025-04-28"
  city: string;
  label: string;          // "Tokyo arrival"
  weather_icon: string;
  weather_high: number;
  weather_low: number;
  events: ItineraryEvent[];
}

interface Itinerary {
  trip_id: string;
  destination: string;
  days: ItineraryDay[];
}
```

---

## Streaming (SSE) architecture

### Backend SSE endpoint (`main.py`)

```python
from fastapi import FastAPI
from fastapi.responses import StreamingResponse
from agent.graph import graph
import json

app = FastAPI()

@app.post("/api/chat/stream")
async def stream_chat(request: ChatRequest):
    async def event_generator():
        async for event in graph.astream_events(
            {"messages": [("user", request.message)], "trip_context": request.context},
            version="v2"
        ):
            kind = event["event"]
            if kind == "on_chat_model_stream":
                chunk = event["data"]["chunk"].content
                if chunk:
                    yield f"data: {json.dumps({'type': 'token', 'content': chunk})}\n\n"
            elif kind == "on_tool_start":
                yield f"data: {json.dumps({'type': 'tool_start', 'tool': event['name']})}\n\n"
            elif kind == "on_tool_end":
                yield f"data: {json.dumps({'type': 'tool_result', 'tool': event['name'], 'output': event['data']['output']})}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")
```

### Frontend SSE hook (`hooks/useSSE.ts`)

```typescript
export function useSSE() {
  const streamChat = async (message: string, context: TripContext) => {
    const response = await fetch('/api/chat/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, context })
    });

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const lines = decoder.decode(value).split('\n');
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const event = JSON.parse(line.slice(6));
          handleStreamEvent(event);  // dispatch to Zustand store
        }
      }
    }
  };
}
```

### Inline card rendering flow

When a `tool_result` SSE event arrives, `InlineCardRenderer.tsx` switches on the tool name and renders the correct card directly into the chat stream. No tab switch needed — the card appears exactly where the conversation is.

```typescript
// components/chat/InlineCardRenderer.tsx
export function InlineCardRenderer({ tool, output }: { tool: string; output: unknown }) {
  switch (tool) {
    case "search_flights":
      return <FlightCard data={output as FlightResult[]} />
    case "search_hotels":
      return <HotelCard data={output as HotelResult[]} />
    case "search_places":
      return <PlaceCard data={output as PlaceResult[]} />
    case "get_weather_forecast":
      return <WeatherStrip data={output as WeatherDay[]} />
    case "get_country_info":
      return <CountryInfoPanel data={output as CountryInfo} />
    case "generate_itinerary":
      return null  // itinerary renders in Itinerary tab, not inline
    default:
      return null
  }
}
```

**Chat message flow for a full trip request:**

```
User: "Plan me 7 days in Tokyo, budget £2,400"

[ToolCallIndicator: search_flights ...]       ← green dot, loading
[FlightCard — 2 options, Book now →]          ← card appears inline

[ToolCallIndicator: search_hotels ...]
[HotelCard — 4 options, Book now →]           ← card appears inline

[ToolCallIndicator: get_weather_forecast ...]
[WeatherStrip — 7-day forecast]               ← card appears inline

[ToolCallIndicator: get_currency_exchange ...]
                                              ← updates right panel only, no inline card
[ToolCallIndicator: get_country_info ...]
[CountryInfoPanel — visa, safety, tips]       ← card appears inline

[ToolCallIndicator: search_places ...]
[PlaceCard grid — 6 attractions with photos]  ← card appears inline

[ToolCallIndicator: calculate_budget ...]
                                              ← updates right panel budget tracker only
[ToolCallIndicator: generate_itinerary ...]
                                              ← updates Itinerary tab, no inline card

Assistant text: "Here's your 7-day Tokyo plan. You're £124 over budget
— I've flagged a cheaper BA flight option that brings you in under.
May 1 looks rainy so I've scheduled TeamLab and Akihabara for that day."
```

**Note:** `get_currency_exchange` and `calculate_budget` update the right panel silently — no inline card. `generate_itinerary` populates the Itinerary tab — no inline card. Everything else renders inline.

**Collapsing old card sets:** When the user sends a follow-up message (e.g. "find cheaper hotels"), the previous HotelCard set collapses to a single summary line to keep the chat readable. The new results expand inline below the new message. This is a polish task for Phase 8.

---

## UI layout

```
┌──────────────┬───────────────────────────────┬───────────────────┐
│  Saved trips │  [Chat | Itinerary | Map]      │  Budget tracker   │
│  sidebar     │                               ├───────────────────┤
│              │  Chat messages + inline cards  │  MiniMap          │
│  220px       │  scroll here                  │  (clickable →     │
│              │                               │   Map tab)        │
│  + New trip  │  [chat input bar at bottom]   ├───────────────────┤
│              │                               │  Currency         │
│              │                               ├───────────────────┤
│              │                               │  Tokens / cost    │
└──────────────┴───────────────────────────────┴───────────────────┘
```

### Tab structure (3 tabs, not 4)

| Tab | Content |
|---|---|
| Chat | Streaming conversation + inline tool result cards (flights, hotels, weather, places, country info) |
| Itinerary | Day-by-day timeline rendered from `generate_itinerary` output |
| Map | Full-width interactive Leaflet map with all pins and clustering |

Tabs appear after the first agent response. Default active tab: **Chat**.

### First-load empty state

- Centered welcome screen with Voyager logo and tagline
- Three suggested prompt chips: "Plan a week in Tokyo", "Weekend in Barcelona", "Surprise me"
- Single text input: "Where to?"
- Right sidebar: budget tracker shows dashes, MiniMap is blank, tokens show 0
- No tabs yet — tabs appear after first agent response

### Map tab behaviour

- Full centre panel given to Leaflet when Map tab is active
- MiniMap in right sidebar always visible — clicking it switches to Map tab
- Both share the same Zustand pin state
- Full Map tab uses `leaflet.markercluster` for grouped pins
- Rich popups on full map: photo, name, category, price, "+ Add to itinerary" button
- MiniMap: plain popups only (name + category), no clustering

---

## Component specifications

### `ChatWindow.tsx`
- Main scrolling area for the conversation
- Renders a sequence of: `ChatBubble` (user) → `ToolCallIndicator` → `InlineCardRenderer` → `ChatBubble` (assistant text)
- Each assistant turn is: zero or more tool calls with inline cards, followed by the final text response
- Scroll anchors to bottom on new content
- Older card sets collapse to summary line on follow-up message (Phase 8 polish)

### `InlineCardRenderer.tsx`
- Switches on `tool` name from SSE `tool_result` event
- Renders the correct card component with the tool output as props
- `calculate_budget` and `get_currency_exchange` → no card, update right panel via Zustand
- `generate_itinerary` → no inline card, update Itinerary tab via Zustand

### `FlightCard.tsx`
- Displays: origin/destination IATA codes, departure/arrival times, duration, stops, airline, price
- Two flight options shown — recommended highlighted with blue border
- Each option: "Select / Selected ✓" button + "Book now →" link (always visible)
- "Book now →" opens `booking_url` (Kiwi deep link) in new tab

### `HotelCard.tsx`
- 2-column grid
- Hotel photo from `photo_url` (RapidAPI `main_photo_url`), fallback to placeholder
- Star rating (amber), price per night, location
- "+ / ✓" toggle + "Book now →" link to Booking.com with dates pre-filled

### `WeatherStrip.tsx`
- 7-column grid (one per day)
- Date label, weather icon, high/low temp, condition
- Rain day gets secondary background tint
- Footer: agent-generated contextual tip (e.g. "May 1 looks rainy — consider TeamLab")

### `PlaceCard.tsx`
- 3-column grid with photo from Google Places (fallback to category-colored icon)
- Name, category, neighbourhood, rating, price level, duration
- Heart icon (save) + "+ Add / Added ✓" toggle
- Adding a place triggers re-call of `generate_itinerary`

### `CountryInfoPanel.tsx`
- 2-column grid: visa, safety score bar, language, currency, practical tips chips
- Visa: green pill if visa-free, amber warning if required
- Safety: colored progress bar (green=safe, amber=moderate, red=high risk)

### `ItineraryTimeline.tsx`
- Vertical spine: day number circle + connecting line
- Each day: date header, city label, weather badge
- Each event: time, colored dot, title, subtitle, type badge
- Badge colors: Flight=blue, Hotel=teal, Activity=purple, Food=amber, POI=green
- Rainy-day events get left blue accent border

### `RightPanel.tsx`
- Budget tracker: rows for flights, hotels, activities, food — label + value + thin bar
- Total row with over/under budget indicator in amber/green
- MiniMap: Leaflet preview, clicking switches to Map tab
- Currency: base + target with live rate
- Token counter: input tokens, output tokens, estimated cost in USD

### `MapTab.tsx` (full-width)
- Full centre panel Leaflet map
- `leaflet.markercluster` — install via `npm install leaflet.markercluster`
- Import cluster CSS or pins render unstyled:
  ```typescript
  import 'leaflet.markercluster/dist/MarkerCluster.css'
  import 'leaflet.markercluster/dist/MarkerCluster.Default.css'
  ```
- Rich popups: photo, name, category, price, "+ Add to itinerary" / "Added ✓" button
- Clicking "+ Add" in popup updates Zustand store — pin switches to tick, PlaceCard updates, itinerary regenerates

### `MiniMap.tsx`
- Smaller Leaflet instance in right sidebar
- Same plain/tick pin state from Zustand
- No clustering (too small)
- Simple popups: name + category only
- Entire component is clickable → switches active tab to Map

### Map pin behaviour

```typescript
// lib/mapIcons.ts
import L from "leaflet";

export const plainPin = L.divIcon({
  className: "",
  html: `<div style="
    width: 28px; height: 28px; border-radius: 50%;
    background: white; border: 2px solid #185FA5;
  "></div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

export const tickPin = L.divIcon({
  className: "",
  html: `<div style="
    width: 28px; height: 28px; border-radius: 50%;
    background: #185FA5; border: 2px solid #185FA5;
    display: flex; align-items: center; justify-content: center;
    color: white; font-size: 14px;
  ">✓</div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});
```

Pin rules:
- Hotels → tick pin once selected
- Places/POI → plain pin by default, tick when added to itinerary
- Flights → do not appear on map

### `ToolCallIndicator.tsx`
- Green dot + tool name + params summary
- Example: `● search_flights(LHR → HND, Apr 28–May 8, 2 adults)`
- Shown inline in chat while tool runs, stays in history after completion

### `EmptyState.tsx`
- Centered layout, Voyager logo + tagline
- Three prompt chips → call `sendMessage(promptText)` on click
- Single large input: "Where to?"

---

## Database schema (Supabase)

```sql
create table trips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  title text not null,
  destination text,
  start_date date,
  end_date date,
  budget_gbp numeric,
  party_size integer default 2,
  status text default 'draft',        -- 'draft' | 'planned' | 'booked'
  itinerary jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table messages (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid references trips(id) on delete cascade,
  role text not null,                 -- 'user' | 'assistant' | 'tool'
  content text,
  tool_name text,
  tool_result jsonb,
  created_at timestamptz default now()
);

alter table trips enable row level security;
alter table messages enable row level security;

create policy "Users see own trips" on trips
  for all using (auth.uid() = user_id);

create policy "Users see own messages" on messages
  for all using (
    trip_id in (select id from trips where user_id = auth.uid())
  );
```

---

## System prompt

```python
SYSTEM_PROMPT = """You are Voyager, an expert AI travel planning assistant.

Your job is to help users plan complete trips by calling the available tools to search for real flights, hotels, places, weather, and currency information.

When a user describes a trip:
1. Extract: destination(s), travel dates, budget, number of travellers, origin city
2. Call tools to gather all needed data: search_flights, search_hotels, get_weather_forecast, get_currency_exchange, get_country_info, search_places, calculate_budget, generate_itinerary
3. Call generate_itinerary last, after all other tools have returned results

Rules:
- Always call calculate_budget before generate_itinerary so you know if the trip is within budget
- If the trip is over budget, suggest alternatives (cheaper flight, different hotel) before generating the itinerary
- Weather-aware scheduling: if forecast shows rain on a day, schedule indoor activities for that day
- Return generate_itinerary output as valid JSON matching the ItinerarySchema exactly — the frontend renders it directly
- Be concise in prose responses. The cards carry the data; your text should add context and recommendations only
- When the user asks to modify the itinerary, call only the tools needed for that change, then regenerate the itinerary
- Do not repeat data already shown in cards — add insight, not repetition

Personality: warm, knowledgeable, efficient. You are a well-travelled friend who gives honest recommendations, not a corporate travel agent.
"""
```

---

## Error handling

Every tool must catch exceptions and return a structured error dict — a failed tool should not crash the agent.

```python
@tool
def search_flights(origin: str, destination: str, ...) -> list[dict]:
    try:
        response = requests.get(KIWI_URL, params={...}, timeout=10)
        response.raise_for_status()
        return parse_flights(response.json())
    except requests.Timeout:
        return [{"error": "Flight search timed out. Try again."}]
    except requests.HTTPError as e:
        return [{"error": f"Flight search failed: {str(e)}"}]
    except Exception as e:
        return [{"error": f"Unexpected error: {str(e)}"}]
```

If a tool returns an error dict, the agent acknowledges it to the user and continues with remaining tools rather than stopping.

---

## Build order

Build and verify each phase before moving to the next.

### Phase 1 — backend skeleton (day 1)
- [ ] FastAPI app with `/health` endpoint
- [ ] LangGraph agent with one tool (`get_country_info` — simplest, no auth)
- [ ] SSE streaming endpoint working end-to-end
- [ ] Test with curl: confirm streaming tokens arrive

### Phase 2 — core tools (days 2–3)
- [ ] `search_flights` (Kiwi Tequila)
- [ ] `search_hotels` (RapidAPI)
- [ ] `get_weather_forecast` (OpenWeatherMap)
- [ ] `get_currency_exchange` (ExchangeRate-API)
- [ ] All tools tested individually with real API calls

### Phase 3 — derived tools (day 4)
- [ ] `search_places` (Google Places API)
- [ ] `calculate_budget` (internal)
- [ ] `generate_itinerary` (internal LLM call with structured output)
- [ ] Full agent run end-to-end: "Plan 7 days in Tokyo" → all 8 tools fire

### Phase 4 — frontend foundation (day 5)
- [ ] Next.js app shell with three-column layout
- [ ] Sidebar with saved trips list
- [ ] EmptyState welcome screen with prompt chips
- [ ] ChatInput + useSSE hook connecting to backend
- [ ] Tabs: Chat, Itinerary, Map (appear after first response)

### Phase 5 — inline cards in chat (days 6–7)
- [ ] `InlineCardRenderer` switches on tool name
- [ ] `FlightCard` renders inline on `tool_result: search_flights`
- [ ] `HotelCard` renders inline on `tool_result: search_hotels`
- [ ] `WeatherStrip` renders inline on `tool_result: get_weather_forecast`
- [ ] `PlaceCard` renders inline on `tool_result: search_places`
- [ ] `CountryInfoPanel` renders inline on `tool_result: get_country_info`
- [ ] `ToolCallIndicator` shows between cards while tools run
- [ ] `calculate_budget` and `get_currency_exchange` update right panel silently

### Phase 6 — itinerary + map + right panel (day 8)
- [ ] `ItineraryTimeline` renders in Itinerary tab from `generate_itinerary` output
- [ ] Budget tracker in right panel updates live as tool results arrive
- [ ] `MiniMap` in right sidebar with plain/tick pins, clickable to Map tab
- [ ] `MapTab` full-width with markercluster, rich popups, Add to itinerary button
- [ ] Currency panel + token counter in right panel

### Phase 7 — persistence + auth (day 9)
- [ ] Supabase schema applied
- [ ] Trips save to DB after `generate_itinerary` completes
- [ ] Auth: login/signup page, protected routes
- [ ] Saved trips load in sidebar on login

### Phase 8 — polish + optional tasks (day 10)
- [ ] Collapse older card sets to summary line on follow-up message
- [ ] Loading skeletons while tools are running
- [ ] Error states for each card (skeleton → error → content)
- [ ] Token usage + cost display (medium optional task — already in right panel)
- [ ] Trip memory: agent has access to previous trip preferences
- [ ] Mobile responsive layout

---

## Optional tasks target list

| Task | Difficulty | Status |
|---|---|---|
| Token usage + cost display | Medium | Built into right panel |
| Short-term memory (trip context within session) | Medium | Via LangGraph state |
| Long-term memory (user preferences across sessions) | Medium | Supabase `user_preferences` table |
| Feedback loop (thumbs up/down on itinerary) | Medium | Phase 8 |
| RAG — user uploads destination guide PDF | Hard | LangChain document loader + Supabase vector store |

For maximum grade: implement token display, memory, and RAG.

---

## Key implementation decisions

**Why inline cards in chat (Option B) over a separate Results tab?**
Mindtrip-style inline rendering is more dynamic and impressive. Cards appear exactly where the conversation is — no tab switching, no context lost. The Results tab was redundant once cards live in the chat. Three tabs (Chat, Itinerary, Map) is cleaner than four.

**Why LangGraph over plain LangChain?**
LangGraph's `astream_events` gives us `on_tool_start` / `on_tool_end` events with tool names and outputs, which is exactly what `InlineCardRenderer` needs to render cards progressively. Plain LangChain AgentExecutor makes this harder.

**Why `generate_itinerary` as a tool and not a final LLM response?**
The frontend needs structured JSON to render the timeline. Prose itineraries are fragile to parse. A tool with a defined output schema always renders correctly.

**Why Leaflet.js and not Google Maps?**
Leaflet is free with no API key. Google Places already uses the billing account — adding Google Maps JavaScript API increases billing surface area for minimal visual gain. Leaflet with OpenStreetMap tiles is indistinguishable in a portfolio demo.

**Why not MCP?**
MCP is optimised for the Claude API. This project uses OpenAI + LangGraph which has its own mature `@tool` system. MCP adds complexity with no benefit here.

---

## Booking — deep links

Voyager does not process payments. Every flight and hotel card has a "Book now →" button opening a pre-filled booking page on the provider's site.

```python
# Flights — Kiwi Tequila returns deep_link in response
{ ...flight fields..., "booking_url": data["deep_link"] }

# Hotels — construct from RapidAPI url field
{ ...hotel fields..., "booking_url": f"{hotel['url']}?checkin={check_in}&checkout={check_out}&group_adults={guests}" }
```

"Book now →" uses `target="_blank" rel="noopener noreferrer"`. Always visible regardless of selected state.

---

## Known limitations vs. commercial travel planners

| Limitation | Mitigation in Voyager |
|---|---|
| Prices go stale | "Book now →" deep link always shows current price on provider's site |
| No in-app booking | Deep links to Kiwi / Booking.com — user completes purchase there |
| Hotel review depth | Star rating + price shown; link out to Booking.com for full reviews |
| No seat selection | Out of scope |
| No long-term personalisation | Supabase `user_preferences` table if memory feature is built |
| Fully online | PDF export of itinerary is a viable future addition |

**What Voyager does that commercial planners don't:**
- Natural language planning — "I hate museums, love food, budget £2k, surprise me"
- Everything in one conversation — no switching between Skyscanner, Booking.com, Google Maps, and a weather app
- Weather-aware itinerary scheduling, automatically
- Unified budget tracker across all categories

**How to frame it:** "Voyager isn't replacing Booking.com — it's the planning layer before you book. It compresses 2 hours of tab-switching and research into one conversation, then hands off to the right provider to complete the booking."

---

## Common mistakes to avoid

- Do not return raw API responses from tools — always parse and return only the fields the frontend needs
- Do not call `generate_itinerary` before `search_flights` and `search_hotels` have returned results
- Do not hardcode currency as GBP — infer from user's origin or ask explicitly
- Do not store API keys in the frontend — all API calls go through the FastAPI backend
- Do not use `any` types in TypeScript — define proper interfaces in `types/index.ts`
- Do not hide "Book now →" behind selected state — always visible on flight and hotel cards
- Do not construct booking deep links on the frontend — backend tool returns `booking_url`
- Do not render `generate_itinerary` output as an inline card — it goes to the Itinerary tab only
- Do not render `calculate_budget` or `get_currency_exchange` as inline cards — they update the right panel only
