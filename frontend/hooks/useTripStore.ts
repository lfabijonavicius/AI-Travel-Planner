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
} from "@/types"

type Tab = "chat" | "itinerary"

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
  setToolResult: (tool: string, output: unknown) => void

  // UI state
  activeTab: Tab
  setActiveTab: (tab: Tab) => void
  hasStarted: boolean

  // Map hover sync
  hoveredPlaceId: string | null
  setHoveredPlace: (id: string | null) => void

  // Itinerary day filter
  selectedItineraryDay: number | null
  setSelectedItineraryDay: (day: number | null) => void

  // Trip context
  tripContext: TripContext
  setTripContext: (ctx: Partial<TripContext>) => void

  // Selected hotel/flight for budget
  selectedFlight: FlightResult | null
  selectedHotel: HotelResult | null
  setSelectedFlight: (f: FlightResult | null) => void
  setSelectedHotel: (h: HotelResult | null) => void

  // Map target (fly-to on new places)
  targetLocation: { lat: number; lng: number } | null
  setTargetLocation: (loc: { lat: number; lng: number } | null) => void

  // Map pins
  pinnedPlaceIds: Set<string>
  togglePin: (name: string) => void

  // Place detail drawer
  selectedPlaceDetail: import("@/types").PlaceResult | null
  setSelectedPlaceDetail: (place: import("@/types").PlaceResult | null) => void
}

export const useTripStore = create<TripStore>((set, get) => ({
  messages: [],
  isStreaming: false,
  hasStarted: false,

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

  setToolResult: (tool, output) => {
    switch (tool) {
      case "search_flights":
        set({ flights: output as FlightResult[] })
        break
      case "search_hotels":
        set({ hotels: output as HotelResult[] })
        break
      case "get_weather_forecast":
        set({ weather: output as WeatherDay[] })
        break
      case "search_places": {
        const newPlaces = output as PlaceResult[]
        const first = newPlaces.find((p) => p.lat && p.lng)
        set((s) => ({
          places: [...s.places, ...newPlaces],
          ...(first ? { targetLocation: { lat: first.lat, lng: first.lng } } : {}),
        }))
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
      case "generate_itinerary":
        set({ itinerary: output as Itinerary })
        break
    }
  },

  activeTab: "chat",
  setActiveTab: (tab) => set({ activeTab: tab }),

  hoveredPlaceId: null,
  setHoveredPlace: (id) => set({ hoveredPlaceId: id }),

  selectedItineraryDay: null,
  setSelectedItineraryDay: (day) => set({ selectedItineraryDay: day }),

  tripContext: {},
  setTripContext: (ctx) => set((s) => ({ tripContext: { ...s.tripContext, ...ctx } })),

  selectedFlight: null,
  selectedHotel: null,
  setSelectedFlight: (f) => set({ selectedFlight: f }),
  setSelectedHotel: (h) => set({ selectedHotel: h }),

  targetLocation: null,
  setTargetLocation: (loc) => set({ targetLocation: loc }),

  pinnedPlaceIds: new Set(),
  togglePin: (name) =>
    set((s) => {
      const next = new Set(s.pinnedPlaceIds)
      next.has(name) ? next.delete(name) : next.add(name)
      return { pinnedPlaceIds: next }
    }),

  selectedPlaceDetail: null,
  setSelectedPlaceDetail: (place) => set({ selectedPlaceDetail: place }),
})
)
