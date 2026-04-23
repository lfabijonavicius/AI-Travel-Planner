"use client"

import { FlightResult } from "@/types"
import { useTripStore } from "@/hooks/useTripStore"
import { Plane, ArrowRight } from "lucide-react"

interface Props {
  data: FlightResult[]
}

export function FlightCard({ data }: Props) {
  const { selectedFlight, setSelectedFlight } = useTripStore()

  if (!data?.length || (data[0] as any)?.error) {
    return <ErrorCard message={(data[0] as any)?.error ?? "No flights found"} />
  }

  return (
    <div className="my-2 space-y-1.5">
      {data.map((flight, i) => {
        const isSelected = selectedFlight?.flight_number === flight.flight_number
        return (
          <div
            key={i}
            className="rounded-xl px-3 py-2.5 flex items-center gap-3 transition-all"
            style={{
              background: "var(--surface-2)",
              boxShadow: isSelected ? "var(--card-shadow-hover)" : "var(--card-shadow)",
              border: `1px solid ${isSelected ? "rgba(61,140,214,0.4)" : "var(--border-subtle)"}`,
            }}
          >
            {/* Airline dot + name */}
            <div className="w-24 flex-shrink-0">
              <p className="text-xs font-semibold truncate" style={{ color: "var(--text)" }}>{flight.airline}</p>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>{flight.flight_number}</p>
            </div>

            {/* Route */}
            <div className="flex items-center gap-1.5 flex-1 min-w-0">
              <div className="text-center">
                <p className="text-sm font-bold" style={{ color: "var(--text)" }}>{flight.origin}</p>
                {flight.departure_time && (
                  <p className="text-xs" style={{ color: "var(--accent-light)" }}>{flight.departure_time}</p>
                )}
              </div>
              <div className="flex-1 flex flex-col items-center min-w-0">
                <div className="flex items-center gap-1 w-full">
                  <div className="h-px flex-1" style={{ background: "var(--border)" }} />
                  <Plane size={10} style={{ color: "var(--accent-light)" }} />
                  <div className="h-px flex-1" style={{ background: "var(--border)" }} />
                </div>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                  {flight.stops === 0 ? "Direct" : `${flight.stops} stop${flight.stops > 1 ? "s" : ""}`}
                </p>
              </div>
              <div className="text-center">
                <p className="text-sm font-bold" style={{ color: "var(--text)" }}>{flight.destination}</p>
                {flight.departure_date && (
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>{flight.departure_date.slice(5)}</p>
                )}
              </div>
            </div>

            {/* Price */}
            <div className="text-right flex-shrink-0">
              <p className="text-sm font-bold" style={{ color: "var(--text)" }}>£{flight.price_gbp.toLocaleString()}</p>
              <p className="text-xs capitalize" style={{ color: "var(--text-muted)" }}>{flight.cabin}</p>
            </div>

            {/* Actions */}
            <div className="flex gap-1.5 flex-shrink-0">
              <button
                onClick={() => setSelectedFlight(isSelected ? null : flight)}
                className="px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer"
                style={{
                  background: isSelected ? "var(--accent)" : "var(--surface)",
                  color: isSelected ? "white" : "var(--text-muted)",
                  border: "1px solid var(--border)",
                }}
              >
                {isSelected ? "✓" : "Select"}
              </button>
              <a
                href={flight.booking_url}
                target="_blank"
                rel="noopener noreferrer"
                className="px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-0.5"
                style={{ background: "var(--surface)", color: "var(--text-muted)", border: "1px solid var(--border)" }}
              >
                Book <ArrowRight size={9} />
              </a>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function ErrorCard({ message }: { message: string }) {
  return (
    <div className="rounded-xl p-3 my-2 text-sm" style={{ background: "var(--surface-2)", color: "#f87171", border: "1px solid var(--border)" }}>
      {message}
    </div>
  )
}
