import { create } from "zustand"
import {
  ChatMessage,
  FlightResult,
  HotelResult,
  WeatherDay,
  PlaceResult,
  CountryInfo,
  BudgetBreakdown,
  CurrencyInfo,
  Itinerary,
  TripContext,
  TokenUsage,
  DestinationSuggestion,
  ItineraryEventDetail,
} from "@/types"
import type { PlaceBrowseTheme } from "@/lib/placeBrowse"

// Shared hover-close timer — used by map markers, zone pins, and chat links
let _hoverCloseTimer: ReturnType<typeof setTimeout> | null = null

export function cancelHoverClose() {
  if (_hoverCloseTimer) { clearTimeout(_hoverCloseTimer); _hoverCloseTimer = null }
}

export function scheduleHoverClose(close: () => void, ms = 150) {
  cancelHoverClose()
  _hoverCloseTimer = setTimeout(close, ms)
}

// Hover card state — shared between map markers and chat links
export type StoreHoverTarget =
  | { kind: "place"; place: PlaceResult }
  | {
      kind: "hotel"
      hotel: {
        name: string
        photo_url?: string
        photo_urls?: string[]
        review_score?: number | null
        stars: number
        price_per_night_gbp: number
        currency: string
      }
    }

export interface StoreHoverState {
  target: StoreHoverTarget
  x: number
  y: number
}

type Tab = "chat" | "itinerary"
type InteractionMode = "planning" | "lookup" | "discovery" | "info" | null
type DiscoveryHighlightFilter = "all" | "icons" | "attractions" | "restaurants"

interface TripStore {
  // Chat
  messages: ChatMessage[]
  isStreaming: boolean
  addMessage: (msg: ChatMessage) => void
  updateLastAssistantMessage: (content: string) => void
  appendToken: (token: string) => void
  setStreaming: (v: boolean) => void
  addToolCallToLast: (tc: { tool: string; inputs?: Record<string, unknown> }) => void
  resolveToolCall: (tool: string, output: unknown) => void

  // Tool results
  flights: FlightResult[]
  hotels: HotelResult[]
  weather: WeatherDay[]
  places: PlaceResult[]
  countryInfo: CountryInfo | null
  budget: BudgetBreakdown | null
  currency: CurrencyInfo | null
  itinerary: Itinerary | null
  destinations: DestinationSuggestion[]
  discoveryHighlights: PlaceResult[]
  discoveryHighlightsLoading: boolean
  discoveryHighlightFilter: DiscoveryHighlightFilter
  setToolResult: (tool: string, output: unknown, inputs?: Record<string, unknown>) => void
  setDiscoveryHighlights: (places: PlaceResult[]) => void
  setDiscoveryHighlightsLoading: (loading: boolean) => void
  setDiscoveryHighlightFilter: (filter: DiscoveryHighlightFilter) => void
  hoveredBrowseSection: PlaceBrowseTheme | null
  focusedBrowseSection: PlaceBrowseTheme | null
  setHoveredBrowseSection: (section: PlaceBrowseTheme | null) => void
  setFocusedBrowseSection: (section: PlaceBrowseTheme | null) => void

  // UI state
  activeTab: Tab
  setActiveTab: (tab: Tab) => void
  hasStarted: boolean
  interactionMode: InteractionMode
  setInteractionMode: (mode: InteractionMode) => void

  // Map hover sync
  hoveredPlaceId: string | null
  setHoveredPlace: (id: string | null) => void

  // Hover card (shared between map and chat)
  hoverCard: StoreHoverState | null
  setHoverCard: (state: StoreHoverState | null) => void
  showHoverCardAtPoint: (target: StoreHoverTarget, x: number, y: number) => void

  // Flight path preview on hover
  hoveredFlight: import("@/types").FlightResult | null
  setHoveredFlight: (f: import("@/types").FlightResult | null) => void

  // Itinerary day filter
  selectedItineraryDay: number | null
  setSelectedItineraryDay: (day: number | null) => void
  selectedItineraryEventKey: string | null
  setSelectedItineraryEventKey: (key: string | null) => void

  // Trip context
  tripContext: TripContext
  setTripContext: (ctx: Partial<TripContext>) => void

  // Selected hotel/flight for budget
  selectedFlight: FlightResult | null
  selectedHotel: HotelResult | null
  setSelectedFlight: (f: FlightResult | null) => void
  setSelectedHotel: (h: HotelResult | null) => void

  // Confirm bar dismissed once user clicks Generate
  itineraryRequested: boolean
  setItineraryRequested: (v: boolean) => void

  // LLM token usage + cost (cumulative for session)
  tokenUsage: TokenUsage
  setTokenUsage: (u: TokenUsage) => void

  // Chat pane collapsed state (map takes full width)
  chatCollapsed: boolean
  setChatCollapsed: (v: boolean) => void

  // Map target (fly-to on new places)
  targetLocation: { lat: number; lng: number; zoom?: number } | null
  setTargetLocation: (loc: { lat: number; lng: number; zoom?: number } | null) => void

  // City-level pin (single marker anchoring the map to a city)
  cityPin: PlaceResult | null
  setCityPin: (pin: PlaceResult | null) => void

  // Map pins
  pinnedPlaceIds: Set<string>
  togglePin: (name: string) => void

  // Place detail drawer
  selectedPlaceDetail: import("@/types").PlaceResult | null
  setSelectedPlaceDetail: (place: import("@/types").PlaceResult | null) => void

  // Hotel detail drawer
  selectedHotelDetail: import("@/types").HotelResult | null
  setSelectedHotelDetail: (hotel: import("@/types").HotelResult | null) => void

  // Destination detail preview card on the map side
  selectedDestinationDetail: DestinationSuggestion | null
  setSelectedDestinationDetail: (d: DestinationSuggestion | null) => void

  // Fallback drawer content for itinerary events without a known place/hotel match
  selectedItineraryEventDetail: ItineraryEventDetail | null
  setSelectedItineraryEventDetail: (event: ItineraryEventDetail | null) => void

  // Skeleton cards shown while tools are running
  activeSkeletons: Partial<Record<"search_flights" | "search_hotels" | "get_weather_forecast" | "search_places" | "get_country_info", boolean>>
  addSkeleton: (tool: string) => void
  removeSkeleton: (tool: string) => void
}

export const useTripStore = create<TripStore>((set, get) => ({
  messages: [],
  isStreaming: false,
  hasStarted: false,
  interactionMode: null,

  addMessage: (msg) =>
    set((s) => ({
      messages: [...s.messages, msg],
      hasStarted: true,
    })),

  updateLastAssistantMessage: (content) =>
    set((s) => {
      const msgs = [...s.messages]
      for (let i = msgs.length - 1; i >= 0; i--) {
        if (msgs[i].role === "assistant") {
          msgs[i] = { ...msgs[i], content }
          break
        }
      }
      return { messages: msgs }
    }),

  appendToken: (token) =>
    set((s) => {
      const msgs = [...s.messages]
      for (let i = msgs.length - 1; i >= 0; i--) {
        if (msgs[i].role === "assistant") {
          msgs[i] = { ...msgs[i], content: msgs[i].content + token }
          return { messages: msgs }
        }
      }
      // No assistant message yet — create one
      return {
        messages: [
          ...msgs,
          { id: Date.now().toString(), role: "assistant", content: token, toolCalls: [] },
        ],
      }
    }),

  setStreaming: (v) => set({ isStreaming: v }),
  setInteractionMode: (mode) =>
    set((s) => ({
      interactionMode: mode,
      ...(mode !== "discovery"
        ? {
            destinations: [],
            selectedDestinationDetail: null,
            discoveryHighlights: [],
            discoveryHighlightsLoading: false,
            discoveryHighlightFilter: "all" as DiscoveryHighlightFilter,
          }
        : {}),
      ...(mode !== "info"
        ? {
            hoveredBrowseSection: null,
            focusedBrowseSection: null,
          }
        : {}),
      ...(mode === "lookup" ? { selectedItineraryDay: null, selectedItineraryEventKey: null, hoveredFlight: null } : {}),
      ...(mode === "planning" ? { itineraryRequested: false } : {}),
      ...(mode === "lookup" && s.activeTab === "itinerary" ? { activeTab: "chat" } : {}),
    })),

  addToolCallToLast: (tc) =>
    set((s) => {
      const msgs = [...s.messages]
      for (let i = msgs.length - 1; i >= 0; i--) {
        if (msgs[i].role === "assistant") {
          msgs[i] = { ...msgs[i], toolCalls: [...(msgs[i].toolCalls ?? []), { tool: tc.tool, inputs: tc.inputs }] }
          return { messages: msgs }
        }
      }
      return {}
    }),

  resolveToolCall: (tool, output) =>
    set((s) => {
      const msgs = [...s.messages]
      for (let i = msgs.length - 1; i >= 0; i--) {
        if (msgs[i].role === "assistant") {
          const calls = [...(msgs[i].toolCalls ?? [])]
          // Find last unresolved call for this tool
          for (let j = calls.length - 1; j >= 0; j--) {
            if (calls[j].tool === tool && calls[j].output === undefined) {
              calls[j] = { ...calls[j], output }
              break
            }
          }
          msgs[i] = { ...msgs[i], toolCalls: calls }
          return { messages: msgs }
        }
      }
      return {}
    }),

  flights: [],
  hotels: [],
  weather: [],
  places: [],
  countryInfo: null,
  budget: null,
  currency: null,
  itinerary: null,
  destinations: [],
  discoveryHighlights: [],
  discoveryHighlightsLoading: false,
  discoveryHighlightFilter: "all",

  setToolResult: (tool, output) => {
    switch (tool) {
      case "search_flights":
        set({ flights: output as FlightResult[] })
        break
      case "search_hotels":
        set({ hotels: output as HotelResult[] })
        break
      case "get_weather_forecast":
        set({
          weather: Array.isArray(output)
            ? (output as WeatherDay[]).filter(
                (day) =>
                  !!day &&
                  typeof day.date === "string" &&
                  Number.isFinite(day.temp_high_c) &&
                  Number.isFinite(day.temp_low_c)
              )
            : [],
        })
        break
      case "search_places": {
        const newPlaces = output as PlaceResult[]
        const first = newPlaces.find((p) => p.lat && p.lng)
        const isLookupCategory = get().interactionMode === "lookup"
        set((s) => {
          if (isLookupCategory) {
            return {
              places: newPlaces.filter((p) => p && p.name),
              hoveredBrowseSection: null,
              focusedBrowseSection: null,
              ...(first ? { targetLocation: { lat: first.lat, lng: first.lng } } : {}),
            }
          }
          const existingNames = new Set(s.places.map((p) => p.name))
          const deduped = newPlaces.filter((p) => !existingNames.has(p.name))
          return {
            places: [...s.places, ...deduped],
            hoveredBrowseSection: null,
            focusedBrowseSection: null,
            ...(first ? { targetLocation: { lat: first.lat, lng: first.lng } } : {}),
          }
        })
        break
      }
      case "get_country_info":
        set({ countryInfo: output as CountryInfo })
        break
      case "calculate_budget":
        set({ budget: output as BudgetBreakdown })
        break
      case "get_currency_exchange":
        set({ currency: output as CurrencyInfo })
        break
      case "suggest_destinations": {
        const dests = output as DestinationSuggestion[]
        if (Array.isArray(dests) && dests.length > 0) {
          set({ destinations: dests })
          // Zoom to first destination on map
          const first = dests.find((d) => d.lat && d.lng)
          if (first && first.lat && first.lng) {
            set({ targetLocation: { lat: first.lat, lng: first.lng } })
          }
        }
        break
      }
      case "generate_itinerary": {
        const it = output as Itinerary
        if (it && Array.isArray(it.days) && it.days.length > 0) {
          set((s) => ({
            itinerary: it,
            activeTab: "itinerary",
            tripContext: {
              ...s.tripContext,
              destination: it.destination || s.tripContext.destination,
              start_date: it.days[0]?.date || s.tripContext.start_date,
              end_date: it.days[it.days.length - 1]?.date || s.tripContext.end_date,
            },
          }))
        }
        break
      }
      case "get_city_pin": {
        const pin = output as PlaceResult
        if (pin && !("error" in (pin as any)) && pin.lat && pin.lng) {
          set({
            cityPin: { ...pin, category: "city" },
            targetLocation: { lat: pin.lat, lng: pin.lng, zoom: 10 },
          })
        }
        break
      }
    }
  },

  setDiscoveryHighlights: (places) => set({ discoveryHighlights: places }),
  setDiscoveryHighlightsLoading: (loading) => set({ discoveryHighlightsLoading: loading }),
  setDiscoveryHighlightFilter: (filter) => set({ discoveryHighlightFilter: filter }),
  hoveredBrowseSection: null,
  focusedBrowseSection: null,
  setHoveredBrowseSection: (section) => set({ hoveredBrowseSection: section }),
  setFocusedBrowseSection: (section) =>
    set((s) => ({ focusedBrowseSection: s.focusedBrowseSection === section ? null : section })),

  activeTab: "chat",
  setActiveTab: (tab) => set({ activeTab: tab }),

  hoveredPlaceId: null,
  setHoveredPlace: (id) => set({ hoveredPlaceId: id }),

  hoverCard: null,
  setHoverCard: (state) => set({ hoverCard: state }),
  showHoverCardAtPoint: (target, x, y) => set({ hoverCard: { target, x, y } }),

  hoveredFlight: null,
  setHoveredFlight: (f) => set({ hoveredFlight: f }),

  selectedItineraryDay: null,
  setSelectedItineraryDay: (day) => set({ selectedItineraryDay: day }),

  selectedItineraryEventKey: null,
  setSelectedItineraryEventKey: (key) => set({ selectedItineraryEventKey: key }),

  tripContext: {},
  setTripContext: (ctx) => set((s) => ({ tripContext: { ...s.tripContext, ...ctx } })),

  selectedFlight: null,
  selectedHotel: null,
  setSelectedFlight: (f) => set({ selectedFlight: f }),
  setSelectedHotel: (h) => set({ selectedHotel: h }),

  itineraryRequested: false,
  setItineraryRequested: (v) => set({ itineraryRequested: v }),

  tokenUsage: { input_tokens: 0, output_tokens: 0, cost_usd: 0 },
  setTokenUsage: (u) => set({ tokenUsage: u }),

  chatCollapsed: false,
  setChatCollapsed: (v) => set({ chatCollapsed: v }),

  targetLocation: null,
  setTargetLocation: (loc) => set({ targetLocation: loc }),

  cityPin: null,
  setCityPin: (pin) => set({ cityPin: pin }),

  pinnedPlaceIds: new Set(),
  togglePin: (name) =>
    set((s) => {
      const next = new Set(s.pinnedPlaceIds)
      next.has(name) ? next.delete(name) : next.add(name)
      return { pinnedPlaceIds: next }
    }),

  selectedPlaceDetail: null,
  setSelectedPlaceDetail: (place) =>
    set({ selectedPlaceDetail: place, selectedHotelDetail: null, selectedItineraryEventDetail: null }),

  selectedHotelDetail: null,
  setSelectedHotelDetail: (hotel) =>
    set({ selectedHotelDetail: hotel, selectedPlaceDetail: null, selectedItineraryEventDetail: null }),

  selectedDestinationDetail: null,
  setSelectedDestinationDetail: (d) =>
    set({
      selectedDestinationDetail: d,
      selectedPlaceDetail: null,
      selectedHotelDetail: null,
      selectedItineraryEventDetail: null,
      ...(d ? {} : { discoveryHighlights: [], discoveryHighlightsLoading: false, discoveryHighlightFilter: "all" as DiscoveryHighlightFilter }),
    }),

  selectedItineraryEventDetail: null,
  setSelectedItineraryEventDetail: (event) =>
    set({
      selectedItineraryEventDetail: event,
      ...(event ? { selectedPlaceDetail: null, selectedHotelDetail: null } : {}),
    }),

  activeSkeletons: {},
  addSkeleton: (tool) =>
    set((s) => ({ activeSkeletons: { ...s.activeSkeletons, [tool]: true } })),
  removeSkeleton: (tool) =>
    set((s) => {
      const next = { ...s.activeSkeletons }
      delete next[tool as keyof typeof next]
      return { activeSkeletons: next }
    }),
})
)
