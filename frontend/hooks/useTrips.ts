"use client"

import { useEffect, useState, useCallback } from "react"
import { getSupabase } from "@/lib/supabase"
import { useAuth } from "@/context/AuthContext"
import { useTripStore } from "./useTripStore"

export interface Trip {
  id: string
  title: string
  destination: string | null
  created_at: string
  updated_at: string
}

export function useTrips() {
  const { user } = useAuth()
  const [trips, setTrips] = useState<Trip[]>([])
  const [loading, setLoading] = useState(false)
  const supabase = getSupabase()

  const fetchTrips = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const { data } = await supabase
      .from("trips")
      .select("id, title, destination, created_at, updated_at")
      .order("updated_at", { ascending: false })
    setTrips((data as Trip[]) ?? [])
    setLoading(false)
  }, [user])

  useEffect(() => {
    fetchTrips()
  }, [fetchTrips])

  const createTrip = useCallback(async (title: string, destination?: string): Promise<Trip | null> => {
    if (!user) return null
    const { data, error } = await supabase
      .from("trips")
      .insert({ user_id: user.id, title, destination: destination ?? null })
      .select()
      .single()
    if (error || !data) return null
    const trip = data as Trip
    setTrips((prev) => [trip, ...prev])
    return trip
  }, [user])

  const updateTrip = useCallback(async (tripId: string, updates: Partial<Pick<Trip, "title" | "destination">>) => {
    await supabase.from("trips").update(updates).eq("id", tripId)
    setTrips((prev) => prev.map((t) => t.id === tripId ? { ...t, ...updates } : t))
  }, [])

  const loadTrip = useCallback(async (tripId: string) => {
    const store = useTripStore.getState()
    store.resetForNewTrip(tripId)

    // Load messages
    const { data: msgs } = await supabase
      .from("messages")
      .select("role, content, created_at")
      .eq("trip_id", tripId)
      .order("created_at", { ascending: true })

    const msgCount = msgs?.length ?? 0
    if (msgs && msgCount > 0) {
      msgs.forEach((m, i) => {
        store.addMessage({
          id: `${tripId}-${i}`,
          role: m.role as "user" | "assistant",
          content: m.content,
        })
      })
    }
    // Mark loaded messages as already persisted so auto-save won't re-insert them
    store.setDbMessageCount(msgCount)

    // Load trip state (tool results)
    const { data: stateRow } = await supabase
      .from("trip_state")
      .select("state")
      .eq("trip_id", tripId)
      .single()

    if (stateRow?.state) {
      store.restoreToolState(stateRow.state)
    }
  }, [])

  return { trips, loading, createTrip, updateTrip, loadTrip, refetch: fetchTrips }
}
