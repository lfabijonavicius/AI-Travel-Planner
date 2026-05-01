"use client"

import { useCallback } from "react"
import { useTripStore } from "./useTripStore"
import { SSEEvent, ChatMessage, Itinerary, ItineraryEvent, TripContext } from "@/types"

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"
const PLANNING_TOOL_SET = new Set(["search_flights", "search_hotels", "get_weather_forecast", "generate_itinerary", "calculate_budget"])
export function useSSE() {
  const { addMessage, appendToken, updateLastAssistantMessage, setStreaming, setToolResult, addToolCallToLast, resolveToolCall, addSkeleton, removeSkeleton, setTokenUsage, setTripContext, setInteractionMode } = useTripStore()
  const SEEDED_MESSAGES = new Set([
    "Pulling together a few contrasting warm-weather directions for June...",
    "Building the trip plan and checking the live pieces now...",
  ])
  const ITINERARY_HEADING_RE = /\bday\s*1\b/i

  function looksLikePlanningRequest(text: string) {
    const lower = text.toLowerCase()
    return [
      "plan",
      "itinerary",
      "weekend in",
      "days in",
      "book",
      "flight",
      "hotel",
      "put together",
      "build me",
      "organise",
      "organize",
    ].some((term) => lower.includes(term))
  }

  function looksLikeInfoRequest(text: string) {
    const lower = text.toLowerCase()
    return [
      "things to do",
      "what to do",
      "landmarks",
      "must see",
      "must-see",
      "top sights",
      "where to eat",
      "places to eat",
      "restaurants in",
      "food in",
      "best time to visit",
      "tell me about",
      "is it safe",
      "how do i get around",
    ].some((term) => lower.includes(term))
  }

  function buildNarrativeItineraryFallback(context: TripContext): Itinerary | null {
    const state = useTripStore.getState()
    const destination = state.tripContext.destination || context.destination
    const assistant = [...state.messages].reverse().find((msg) => msg.role === "assistant" && ITINERARY_HEADING_RE.test(msg.content))
    if (!assistant?.content || !destination) return null

    const startDateValue = state.tripContext.start_date || context.start_date
    const baseDate = startDateValue ? new Date(`${startDateValue}T12:00:00`) : new Date()
    if (Number.isNaN(baseDate.getTime())) return null

    const weatherByDate = new Map(state.weather.map((day) => [day.date, day]))
    const normalizedPlaces = [...state.places].sort((a, b) => b.name.length - a.name.length)
    const normalizedHotels = [...state.hotels].sort((a, b) => b.name.length - a.name.length)

    const normalize = (value: string) =>
      value
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .trim()

    const titleFromSentence = (sentence: string): Pick<ItineraryEvent, "title" | "subtitle" | "type" | "coordinates"> => {
      const flat = sentence.replace(/[*_`#>-]/g, "").trim()
      const sentenceOnly = flat.split(/[.!?]/)[0]?.trim() || flat
      const placeMatch = normalizedPlaces.find((place) => normalize(sentenceOnly).includes(normalize(place.name)))
      if (placeMatch) {
        return {
          title: placeMatch.name,
          subtitle: sentenceOnly,
          type: /restaurant|food|cafe|bar/i.test(placeMatch.category) ? "food" : "activity",
          coordinates: { lat: placeMatch.lat, lng: placeMatch.lng },
        }
      }
      const hotelMatch = normalizedHotels.find((hotel) => normalize(sentenceOnly).includes(normalize(hotel.name)))
      if (hotelMatch) {
        return {
          title: hotelMatch.name,
          subtitle: sentenceOnly,
          type: "hotel" as const,
          coordinates: hotelMatch.lat != null && hotelMatch.lng != null ? { lat: hotelMatch.lat, lng: hotelMatch.lng } : undefined,
        }
      }
      if (/flight|arriv|depart/i.test(sentenceOnly)) {
        return {
          title: /depart/i.test(sentenceOnly) ? "Flight Departure" : "Flight Arrival",
          subtitle: sentenceOnly,
          type: "flight" as const,
          coordinates: undefined,
        }
      }
      if (/hotel|check[\s-]?in|check[\s-]?out/i.test(sentenceOnly)) {
        return {
          title: /check[\s-]?out/i.test(sentenceOnly) ? "Hotel Check-out" : "Hotel Check-in",
          subtitle: sentenceOnly,
          type: "hotel" as const,
          coordinates: undefined,
        }
      }
      if (/lunch|dinner|breakfast|tapas|meal|restaurant|bistro|cafe|bar/i.test(sentenceOnly)) {
        return {
          title: sentenceOnly.length > 52 ? `${sentenceOnly.slice(0, 49).trim()}…` : sentenceOnly,
          subtitle: sentenceOnly,
          type: "food" as const,
          coordinates: undefined,
        }
      }
      return {
        title: sentenceOnly.length > 52 ? `${sentenceOnly.slice(0, 49).trim()}…` : sentenceOnly,
        subtitle: sentenceOnly,
        type: "activity" as const,
        coordinates: undefined,
      }
    }

    const timeByPeriod: Record<string, string> = {
      morning: "09:00",
      afternoon: "14:00",
      evening: "19:00",
      breakfast: "08:30",
      lunch: "12:30",
      dinner: "19:30",
    }

    const sections = assistant.content
      .split(/\n(?=Day\s*\d+\s*[–—-])/i)
      .map((section) => section.trim())
      .filter((section) => /^Day\s*\d+\s*[–—-]/i.test(section))

    if (!sections.length) return null

    const days = sections.map((section, index) => {
      const lines = section
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
      const headingMatch = lines[0]?.match(/^Day\s*(\d+)\s*[–—-]\s*(.+)$/i)
      const dayNumber = headingMatch ? Number(headingMatch[1]) : index + 1
      const label = headingMatch?.[2]?.trim() || `Day ${dayNumber}`
      const eventLines = lines.filter((line) => /(?:morning|afternoon|evening|breakfast|lunch|dinner)\s*:/i.test(line))
      const date = new Date(baseDate)
      date.setDate(baseDate.getDate() + index)
      const isoDate = date.toISOString().slice(0, 10)
      const weather = weatherByDate.get(isoDate)

      const events: ItineraryEvent[] = eventLines.map((line, eventIndex) => {
        const match = line.match(/(?:☀️|🌤️|🌇|🌙|🍽️|🍳)?\s*(Morning|Afternoon|Evening|Breakfast|Lunch|Dinner)\s*:\s*(.+)$/i)
        const period = (match?.[1] || `Event ${eventIndex + 1}`).toLowerCase()
        const body = match?.[2]?.trim() || line
        const resolved = titleFromSentence(body)
        return {
          time: timeByPeriod[period] || `${9 + eventIndex * 2}:00`.padStart(5, "0"),
          title: resolved.title,
          subtitle: resolved.subtitle,
          type: resolved.type,
          coordinates: resolved.coordinates,
        }
      })

      return {
        day_number: dayNumber,
        date: isoDate,
        city: destination,
        label,
        weather_icon: weather?.weather_icon || "☀️",
        weather_high: weather?.temp_high_c ?? Number.NaN,
        weather_low: weather?.temp_low_c ?? Number.NaN,
        events,
      }
    })

    return {
      trip_id: "narrative-fallback",
      destination,
      days,
    }
  }

  function buildSnapshot() {
    const s = useTripStore.getState()
    const snapshot: Record<string, unknown> = {}

    if (s.flights.length) {
      snapshot.flights_found = s.flights
        .filter((f) => f.airline && f.price_gbp)
        .map((f) => ({
          airline: f.airline,
          flight_number: f.flight_number ?? "",
          destination: f.destination,
          route: `${f.origin}→${f.destination}`,
          departure_date: f.departure_date,
          return_date: f.return_date,
          stops: f.stops,
          price_gbp: f.price_gbp,
        }))
    }
    if (s.hotels.length) {
      snapshot.hotels_found = s.hotels
        .filter((h) => h.name && h.city)
        .map((h) => ({
          name: h.name,
          city: h.city,
          stars: h.stars,
          price_per_night_gbp: h.price_per_night_gbp,
          total_price_gbp: h.total_price_gbp,
          review_score: h.review_score ?? null,
        }))
    }
    if (s.places.length) {
      snapshot.places_found = s.places
        .filter((p) => p.name)
        .map((p) => ({
          name: p.name,
          category: p.category,
          rating: p.rating,
          lat: p.lat,
          lng: p.lng,
          open_now: p.open_now,
        }))
    }
    if (s.pinnedPlaceIds.size) {
      snapshot.pinned_places = Array.from(s.pinnedPlaceIds).filter(Boolean)
    }
    if (s.selectedFlight) {
      snapshot.selected_flight = {
        airline: s.selectedFlight.airline,
        flight_number: s.selectedFlight.flight_number,
        destination: s.selectedFlight.destination,
        route: `${s.selectedFlight.origin}→${s.selectedFlight.destination}`,
        departure_date: s.selectedFlight.departure_date,
        return_date: s.selectedFlight.return_date,
        price_gbp: s.selectedFlight.price_gbp,
      }
    }
    if (s.selectedHotel) {
      snapshot.selected_hotel = {
        name: s.selectedHotel.name,
        city: s.selectedHotel.city,
        price_per_night_gbp: s.selectedHotel.price_per_night_gbp,
        total_price_gbp: s.selectedHotel.total_price_gbp,
      }
    }
    if (s.itinerary) {
      snapshot.itinerary_built = {
        destination: s.itinerary.destination,
        days: s.itinerary.days.length,
        start: s.itinerary.days[0]?.date,
        end: s.itinerary.days[s.itinerary.days.length - 1]?.date,
      }
    }
    if (s.weather.length) {
      snapshot.weather_data = s.weather.map((w) => ({
        date: w.date,
        condition: w.condition,
        weather_icon: w.weather_icon,
        temp_high_c: w.temp_high_c,
        temp_low_c: w.temp_low_c,
        precipitation_probability: w.precipitation_probability,
      }))
    }
    if (s.currency) {
      snapshot.currency_fetched = { base: s.currency.base, target: s.currency.target, rate: s.currency.rate }
    }

    return snapshot
  }

  async function ensureItineraryFallback(context: TripContext, userText: string, sawPlanningToolThisTurn: boolean) {
    const state = useTripStore.getState()
    if (state.itinerary) return

    const hasDestination = Boolean(state.tripContext.destination || context.destination)
    const lastAssistant = [...state.messages].reverse().find((msg) => msg.role === "assistant")
    const looksLikeNarrativeItinerary = Boolean(lastAssistant?.content && ITINERARY_HEADING_RE.test(lastAssistant.content))
    const hasPlanningData =
      state.flights.length > 0 ||
      state.hotels.length > 0 ||
      state.weather.length > 0 ||
      state.places.length > 0

    if (!hasDestination) return
    if (!sawPlanningToolThisTurn && !looksLikeNarrativeItinerary && !looksLikePlanningRequest(userText)) return
    if (!sawPlanningToolThisTurn && looksLikeInfoRequest(userText) && !looksLikeNarrativeItinerary) return
    if (!hasPlanningData && !looksLikeNarrativeItinerary) return

    const snapshot = buildSnapshot()
    const response = await fetch(`${API_URL}/api/itinerary/build`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ context: { ...state.tripContext, ...context }, snapshot }),
    })
    if (!response.ok) {
      const parsed = buildNarrativeItineraryFallback(context)
      if (parsed) {
        setToolResult("generate_itinerary", parsed)
        resolveToolCall("generate_itinerary", parsed)
      }
      return
    }

    const output = await response.json()
    if (output && Array.isArray(output.days) && output.days.length > 0) {
      setToolResult("generate_itinerary", output)
      resolveToolCall("generate_itinerary", output)
      return
    }

    const parsed = buildNarrativeItineraryFallback(context)
    if (parsed) {
      setToolResult("generate_itinerary", parsed)
      resolveToolCall("generate_itinerary", parsed)
    }
  }

  const sendMessage = useCallback(
    async (text: string, context: TripContext = {}, hidden = false) => {
      if (Object.keys(context).length > 0) {
        setTripContext(context)
      }
      const userMsg: ChatMessage = {
        id: Date.now().toString(),
        role: "user",
        content: text,
        hidden,
      }
      addMessage(userMsg)
      setStreaming(true)

      // Seed an empty assistant message
      const assistantMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "",
        toolCalls: [],
      }
      addMessage(assistantMsg)

      // Build a compact snapshot of everything the agent already found this session
      const s = useTripStore.getState()
      const snapshot = buildSnapshot()

      // Send last 8 messages as history (excluding the current user msg + empty assistant we just seeded)
      const history = s.messages
        .slice(0, -2)
        .filter((m) => m.content.trim().length > 10)
        .slice(-8)
        .map((m) => ({ role: m.role, content: m.content.slice(0, 800).trim() }))
      let sawPlanningToolThisTurn = false

      try {
        const response = await fetch(`${API_URL}/api/chat/stream`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: text, context, snapshot, history }),
        })

        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        if (!response.body) throw new Error("No response body")

        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ""

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const frames = buffer.split("\n\n")
          buffer = frames.pop() ?? ""

          for (const frame of frames) {
            const lines = frame.split("\n")
            const dataLines = lines
              .filter((line) => line.startsWith("data: "))
              .map((line) => line.slice(6))
            if (!dataLines.length) continue

            const raw = dataLines.join("\n").trim()
            if (raw === "[DONE]") {
              buffer = ""
              break
            }
            try {
              const event = JSON.parse(raw) as SSEEvent
              if (
                (event.type === "tool_start" || event.type === "tool_result") &&
                "tool" in event &&
                PLANNING_TOOL_SET.has(event.tool)
              ) {
                sawPlanningToolThisTurn = true
              }
              handleEvent(event)
            } catch {
              // malformed chunk — skip
            }
          }
        }
      } catch (err) {
        appendToken(`\n\n_Error: ${(err as Error).message}_`)
      } finally {
        try {
          await ensureItineraryFallback(context, text, sawPlanningToolThisTurn)
        } catch {
          // Silent fallback — chat should still complete even if direct itinerary build fails
        }
        setStreaming(false)
      }
    },
    [addMessage, appendToken, setStreaming, setToolResult, addToolCallToLast, resolveToolCall, addSkeleton, removeSkeleton, setTripContext] // eslint-disable-line react-hooks/exhaustive-deps
  )

  function handleEvent(event: SSEEvent) {
    switch (event.type) {
      case "token": {
        const s = useTripStore.getState()
        const last = s.messages[s.messages.length - 1]
        if (last?.role === "assistant" && SEEDED_MESSAGES.has(last.content.trim())) {
          updateLastAssistantMessage(event.content)
        } else {
          appendToken(event.content)
        }
        break
      }
      case "tool_start":
        const toolInputs =
          event.inputs && typeof event.inputs === "object" ? (event.inputs as Record<string, unknown>) : undefined
        if (event.tool === "suggest_destinations") {
          setInteractionMode("discovery")
          const s = useTripStore.getState()
          const last = s.messages[s.messages.length - 1]
          if (last?.role === "assistant" && !last.content.trim()) {
            updateLastAssistantMessage("Pulling together a few contrasting warm-weather directions for June...")
          }
        } else if (event.tool === "search_places") {
          const s = useTripStore.getState()
          const latestUser = [...s.messages].reverse().find((msg) => msg.role === "user" && !msg.hidden)?.content ?? ""
          if (s.interactionMode === "planning") {
            setInteractionMode("planning")
          } else {
            setInteractionMode(looksLikeInfoRequest(latestUser) ? "info" : "lookup")
          }
        } else if (
          ["search_flights", "search_hotels", "get_weather_forecast", "generate_itinerary"].includes(event.tool)
        ) {
          setInteractionMode("planning")
          const s = useTripStore.getState()
          const last = s.messages[s.messages.length - 1]
          if (last?.role === "assistant" && !last.content.trim()) {
            updateLastAssistantMessage("Building the trip plan and checking the live pieces now...")
          }
        }
        addToolCallToLast({ tool: event.tool, inputs: toolInputs })
        if (["search_flights", "search_hotels", "get_weather_forecast", "search_places", "get_country_info"].includes(event.tool)) {
          addSkeleton(event.tool)
        }
        break
      case "tool_result":
        setToolResult(event.tool, event.output)
        resolveToolCall(event.tool, event.output)
        removeSkeleton(event.tool)
        break
      case "usage":
        setTokenUsage({
          input_tokens: event.input_tokens,
          output_tokens: event.output_tokens,
          cost_usd: event.cost_usd,
        })
        break
      case "error":
        appendToken(`\n\n_${event.content}_`)
        break
    }
  }

  return { sendMessage }
}
