"use client"

import { Plane, Hotel, MapPin, ArrowRight, X } from "lucide-react"
import { useTripStore } from "@/hooks/useTripStore"

interface Props {
  onConfirm: (message: string) => void
}

export function ItineraryConfirmBar({ onConfirm }: Props) {
  const { selectedFlight, selectedHotel, pinnedPlaceIds, setSelectedFlight, setSelectedHotel, itinerary, isStreaming, itineraryRequested, setItineraryRequested } = useTripStore()

  // Hide once user clicks Generate (itineraryRequested), or once itinerary is built, or if nothing selected
  if (itineraryRequested || itinerary || (!selectedFlight && !selectedHotel)) return null

  function buildMessage() {
    const parts: string[] = []
    if (selectedFlight) {
      parts.push(
        `flight ${selectedFlight.airline} ${selectedFlight.flight_number} (${selectedFlight.origin}→${selectedFlight.destination}, ${selectedFlight.departure_date}, £${selectedFlight.price_gbp}/person)`
      )
    }
    if (selectedHotel) {
      parts.push(`hotel "${selectedHotel.name}" at £${selectedHotel.price_per_night_gbp}/night`)
    }
    if (pinnedPlaceIds.size > 0) {
      const names = Array.from(pinnedPlaceIds).join(", ")
      parts.push(`these places in my itinerary: ${names}`)
    }
    return `I've selected my ${parts.join(", and ")}. Please generate my final day-by-day itinerary with these selections.`
  }

  return (
    <div
      className="mx-4 mb-3 rounded-2xl overflow-hidden"
      style={{
        background: "var(--surface-2)",
        border: "1px solid rgba(61,140,214,0.3)",
        boxShadow: "0 0 24px rgba(61,140,214,0.1)",
      }}
    >
      {/* Selections summary */}
      <div className="px-4 pt-3 pb-2 flex flex-wrap gap-2">
        {selectedFlight && (
          <div
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs"
            style={{ background: "rgba(61,140,214,0.12)", color: "var(--accent-light)", border: "1px solid rgba(61,140,214,0.2)" }}
          >
            <Plane size={11} />
            <span>{selectedFlight.airline} · {selectedFlight.origin}→{selectedFlight.destination} · £{selectedFlight.price_gbp}</span>
            <button
              onClick={() => setSelectedFlight(null)}
              className="ml-0.5 opacity-60 hover:opacity-100 cursor-pointer"
            >
              <X size={10} />
            </button>
          </div>
        )}
        {selectedHotel && (
          <div
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs"
            style={{ background: "rgba(61,140,214,0.12)", color: "var(--accent-light)", border: "1px solid rgba(61,140,214,0.2)" }}
          >
            <Hotel size={11} />
            <span>{selectedHotel.name} · £{selectedHotel.price_per_night_gbp}/night</span>
            <button
              onClick={() => setSelectedHotel(null)}
              className="ml-0.5 opacity-60 hover:opacity-100 cursor-pointer"
            >
              <X size={10} />
            </button>
          </div>
        )}
        {pinnedPlaceIds.size > 0 && (
          <div
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs"
            style={{ background: "rgba(61,140,214,0.12)", color: "var(--accent-light)", border: "1px solid rgba(61,140,214,0.2)" }}
          >
            <MapPin size={11} />
            <span>{pinnedPlaceIds.size} place{pinnedPlaceIds.size !== 1 ? "s" : ""} pinned</span>
          </div>
        )}
      </div>

      {/* Confirm button */}
      <div className="px-3 pb-3">
        <button
          onClick={() => { setItineraryRequested(true); onConfirm(buildMessage()) }}
          disabled={isStreaming}
          className="w-full py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 cursor-pointer transition-all"
          style={{
            background: "var(--accent)",
            color: "white",
            boxShadow: "0 4px 16px rgba(24,95,165,0.4)",
          }}
        >
          Generate My Itinerary <ArrowRight size={15} />
        </button>
      </div>
    </div>
  )
}
