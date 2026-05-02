// ── SSE event types ──────────────────────────────────────────────────────────

export type SSEEvent =
  | { type: "token"; content: string }
  | { type: "tool_start"; tool: string; inputs?: Record<string, unknown> }
  | { type: "tool_result"; tool: string; output: unknown }
  | { type: "usage"; input_tokens: number; output_tokens: number; cost_usd: number }
  | { type: "error"; content: string }

export interface TokenUsage {
  input_tokens: number
  output_tokens: number
  cost_usd: number
}

// ── Tool output shapes ───────────────────────────────────────────────────────

export interface FlightResult {
  kind?: "flight" | "advice"
  airline?: string
  airline_code?: string
  flight_number?: string
  origin?: string
  destination?: string
  departure_date?: string
  departure_time?: string
  return_date?: string
  stops?: number
  price_gbp?: number
  cabin?: string
  booking_url?: string
  option_label?: string
  note?: string
  matches_requested_dates?: boolean
  date_adjustment_days?: number
  title?: string
  summary?: string
  details?: string
  suggested_dates?: string[]
  suggested_origins?: string[]
  suggested_hubs?: string[]
  confirmed_operators?: Array<{ name: string; iata: string; booking_url?: string }>
}

export interface HotelResult {
  name: string
  stars: number
  review_score: number | null
  review_word: string
  price_per_night_gbp: number
  total_price_gbp: number
  currency: string
  address: string
  city: string
  photo_url: string
  booking_url: string
  lat?: number
  lng?: number
}

export interface WeatherDay {
  date: string
  temp_high_c: number
  temp_low_c: number
  condition: string
  weather_icon: string
  precipitation_probability: number
}

export interface CurrentWeather {
  city: string
  temp_c: number
  feels_like_c: number
  temp_min_c: number
  temp_max_c: number
  humidity_pct: number
  condition: string
  weather_icon: string
  wind_speed_ms: number
}

export interface PlaceReview {
  author: string
  author_photo: string | null
  rating: number | null
  text: string
  relative_time: string
}

export interface PlaceResult {
  name: string
  category: string
  rating: number | null
  price_level: string | null
  lat: number
  lng: number
  address: string
  open_now: boolean | null
  summary: string | null
  photo_url: string | null
  photo_urls?: string[]
  reviews?: PlaceReview[]
}

export interface DestinationSuggestion {
  name: string
  headline: string
  country: string
  region: string
  description: string
  why_now: string
  best_for: string
  tradeoff: string
  plan_title: string
  tags: string[]
  lat: number | null
  lng: number | null
  photo_url: string | null
  rating: number | null
  rating_count: number | null
}

export interface CountryInfo {
  name: string
  capital: string
  region: string
  subregion: string
  languages: string[]
  currencies: { code: string; name: string; symbol: string }[]
  flag: string
  timezone: string
  calling_code: string
  population: string
  driving_side: string
}

export interface BudgetBreakdown {
  breakdown: {
    flights_gbp: number
    hotel_gbp: number
    activities_gbp: number
    food_gbp: number
  }
  total_gbp: number
  budget_gbp: number | null
  within_budget: boolean | null
  over_by_gbp: number
  per_person_gbp: number
}

export interface CurrencyInfo {
  base: string
  target: string
  rate: number
  conversions: Record<string, number>
  last_updated: string
}

export interface ItineraryEvent {
  time: string
  title: string
  subtitle: string
  type: "flight" | "hotel" | "activity" | "poi" | "food" | "transport"
  price_local?: string
  duration_minutes?: number
  coordinates?: { lat: number; lng: number }
}

export interface ItineraryEventDetail {
  time: string
  title: string
  subtitle: string
  type: "flight" | "hotel" | "activity" | "poi" | "food" | "transport"
  city?: string
  date?: string
  day_label?: string
  price_local?: string
  duration_minutes?: number
  coordinates?: { lat: number; lng: number }
}

export interface ItineraryDay {
  day_number: number
  date: string
  city: string
  label: string
  weather_icon: string
  weather_high: number
  weather_low: number
  events: ItineraryEvent[]
}

export interface Itinerary {
  trip_id: string
  destination: string
  days: ItineraryDay[]
}

// ── Chat message ─────────────────────────────────────────────────────────────

export interface ToolCall {
  tool: string
  inputs?: Record<string, unknown>
  output?: unknown
}

export interface ChatMessage {
  id: string
  role: "user" | "assistant"
  content: string
  toolCalls?: ToolCall[]
  hidden?: boolean
}

// ── Trip context sent with each request ─────────────────────────────────────

export interface TripContext {
  destination?: string
  start_date?: string
  end_date?: string
  budget_gbp?: number
  party_size?: number
  origin?: string
}
