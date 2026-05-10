"use client"

import { useEffect, useRef } from "react"
import { getSupabase } from "@/lib/supabase"
import { useTripStore } from "./useTripStore"
import { useAuth } from "@/context/AuthContext"

export function useAutoSave(onTripUpdated?: () => void) {
  const { user } = useAuth()
  const messages = useTripStore((s) => s.messages)
  const isStreaming = useTripStore((s) => s.isStreaming)
  const currentTripId = useTripStore((s) => s.currentTripId)
  const dbMessageCount = useTripStore((s) => s.dbMessageCount)
  const savedCountRef = useRef(0)
  const supabase = getSupabase()

  // Sync savedCountRef whenever dbMessageCount changes (set by loadTrip after DB load)
  useEffect(() => {
    savedCountRef.current = dbMessageCount
  }, [dbMessageCount])

  // Save new complete messages after streaming ends
  useEffect(() => {
    if (!user || !currentTripId || isStreaming) return

    const completeMsgs = messages.filter((m) => m.content.trim().length > 0 && !m.hidden)
    const toSave = completeMsgs.slice(savedCountRef.current)
    if (toSave.length === 0) return

    savedCountRef.current = completeMsgs.length

    supabase.from("messages").insert(
      toSave.map((m) => ({ trip_id: currentTripId, role: m.role, content: m.content }))
    ).then(({ error }) => {
      if (error) console.warn("Message save failed:", error.message)
    })
  }, [isStreaming, currentTripId, user])

  // Save tool state + update trip title after streaming ends
  useEffect(() => {
    if (!user || !currentTripId || isStreaming) return
    const s = useTripStore.getState()

    const state: Record<string, unknown> = {}
    if (s.flights.length) state.flights = s.flights
    if (s.hotels.length) state.hotels = s.hotels
    if (s.weather.length) state.weather = s.weather
    if (s.places.length) state.places = s.places
    if (s.itinerary) state.itinerary = s.itinerary
    if (s.selectedFlight) state.selectedFlight = s.selectedFlight
    if (s.selectedHotel) state.selectedHotel = s.selectedHotel
    if (s.cityPin) state.cityPin = s.cityPin
    if (s.destinations.length) state.destinations = s.destinations
    if (Object.keys(s.tripContext).length) state.tripContext = s.tripContext

    if (Object.keys(state).length > 0) {
      supabase.from("trip_state").upsert({ trip_id: currentTripId, state }).then(({ error }) => {
        if (error) console.warn("State save failed:", error.message)
      })
    }

    const destination = s.tripContext.destination || (s.cityPin?.name ?? null)
    const firstUserMsg = s.messages.find((m) => m.role === "user" && !m.hidden)
    const title = destination
      ? `Trip to ${destination}`
      : firstUserMsg
        ? firstUserMsg.content.slice(0, 50).trim()
        : null

    if (title) {
      supabase.from("trips")
        .update({ destination, title })
        .eq("id", currentTripId)
        .then(() => onTripUpdated?.())
    }
  }, [isStreaming, currentTripId, user])
}
