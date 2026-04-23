"use client"

import { useCallback } from "react"
import { useTripStore } from "./useTripStore"
import { SSEEvent, ChatMessage, TripContext } from "@/types"

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"

export function useSSE() {
  const { addMessage, appendToken, setStreaming, setToolResult, addToolCallToLast, resolveToolCall, addSkeleton, removeSkeleton } = useTripStore()

  const sendMessage = useCallback(
    async (text: string, context: TripContext = {}) => {
      const userMsg: ChatMessage = {
        id: Date.now().toString(),
        role: "user",
        content: text,
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
      const snapshot: Record<string, unknown> = {}

      if (s.flights.length) {
        snapshot.flights_found = s.flights
          .filter((f) => f.airline && f.price_gbp)
          .map((f) => ({
            airline: f.airline,
            flight_number: f.flight_number ?? "",
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
        // filter undefined/empty names to avoid Python join() failure
        snapshot.places_found = s.places.map((p) => p.name).filter(Boolean)
      }
      if (s.pinnedPlaceIds.size) {
        snapshot.pinned_places = Array.from(s.pinnedPlaceIds).filter(Boolean)
      }
      if (s.selectedFlight) {
        snapshot.selected_flight = {
          airline: s.selectedFlight.airline,
          flight_number: s.selectedFlight.flight_number,
          route: `${s.selectedFlight.origin}→${s.selectedFlight.destination}`,
          departure_date: s.selectedFlight.departure_date,
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
        snapshot.weather_fetched = true
      }
      if (s.currency) {
        snapshot.currency_fetched = { base: s.currency.base, target: s.currency.target, rate: s.currency.rate }
      }

      // Send last 8 messages as history (excluding the current user msg + empty assistant we just seeded)
      const history = s.messages
        .slice(0, -2)
        .filter((m) => m.content.trim().length > 10)
        .slice(-8)
        .map((m) => ({ role: m.role, content: m.content.slice(0, 800).trim() }))

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

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const lines = decoder.decode(value, { stream: true }).split("\n")
          for (const line of lines) {
            if (!line.startsWith("data: ")) continue
            const raw = line.slice(6).trim()
            if (raw === "[DONE]") break

            try {
              const event = JSON.parse(raw) as SSEEvent
              handleEvent(event)
            } catch {
              // malformed chunk — skip
            }
          }
        }
      } catch (err) {
        appendToken(`\n\n_Error: ${(err as Error).message}_`)
      } finally {
        setStreaming(false)
      }
    },
    [addMessage, appendToken, setStreaming, setToolResult, addToolCallToLast, resolveToolCall, addSkeleton, removeSkeleton]
  )

  function handleEvent(event: SSEEvent) {
    switch (event.type) {
      case "token":
        appendToken(event.content)
        break
      case "tool_start":
        addToolCallToLast({ tool: event.tool, inputs: event.inputs })
        if (["search_flights", "search_hotels", "get_weather_forecast", "search_places", "get_country_info"].includes(event.tool)) {
          addSkeleton(event.tool)
        }
        break
      case "tool_result":
        setToolResult(event.tool, event.output)
        resolveToolCall(event.tool, event.output)
        removeSkeleton(event.tool)
        break
      case "error":
        appendToken(`\n\n_${event.content}_`)
        break
    }
  }

  return { sendMessage }
}
