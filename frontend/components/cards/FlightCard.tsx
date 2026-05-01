"use client"

import { FlightResult } from "@/types"
import { useTripStore } from "@/hooks/useTripStore"
import { useSSE } from "@/hooks/useSSE"
import { Plane, ArrowRight } from "lucide-react"
import { useScrollToLatest } from "@/hooks/useScrollToLatest"

interface Props {
  data: FlightResult[]
}

export function FlightCard({ data }: Props) {
  const { selectedFlight, setSelectedFlight, setHoveredFlight } = useTripStore()
  const cardRef = useScrollToLatest(data)

  if (!data?.length) {
    return <StatusCard title="Flight options still loading" message="Voyager is checking live fares and nearby date options." />
  }

  if (data[0]?.kind === "advice") {
    return <AdviceCard data={data[0]} origin={data[0].origin} destination={data[0].destination} />
  }

  if ((data[0] as any)?.error) {
    return <StatusCard title="Flight search note" message={(data[0] as any)?.error ?? "No flights found"} />
  }

  return (
    <div ref={cardRef} className="my-2 space-y-1.5">
      {data.map((flight, i) => {
        const isSelected = selectedFlight?.flight_number === flight.flight_number
        const canSelect = Boolean(flight.airline && flight.destination && flight.price_gbp != null)
        const canBook = Boolean(flight.booking_url)
        return (
          <div
            key={i}
            className="rounded-xl px-3 py-2.5 flex items-center gap-3 transition-all"
            onMouseEnter={() => canSelect && setHoveredFlight(flight)}
            onMouseLeave={() => setHoveredFlight(null)}
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
              {flight.option_label ? (
                <p className="mt-1 inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-semibold" style={{ color: "var(--accent-light)", background: "rgba(61,140,214,0.12)", border: "1px solid rgba(61,140,214,0.18)" }}>
                  {flight.option_label}
                </p>
              ) : null}
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
                <p className="text-xs text-center" style={{ color: "var(--text-muted)" }}>
                  {flight.stops === 0 ? "Direct" : `${flight.stops} stop${(flight.stops ?? 0) > 1 ? "s" : ""}`}
                  {flight.note ? ` · ${flight.note}` : ""}
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
              <p className="text-sm font-bold" style={{ color: "var(--text)" }}>£{flight.price_gbp?.toLocaleString()}</p>
              <p className="text-xs capitalize" style={{ color: "var(--text-muted)" }}>{flight.cabin}</p>
            </div>

            {/* Actions */}
            <div className="flex gap-1.5 flex-shrink-0">
              <button
                onClick={() => canSelect && setSelectedFlight(isSelected ? null : flight)}
                disabled={!canSelect}
                className="px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer"
                style={{
                  background: isSelected ? "var(--accent)" : "var(--surface)",
                  color: isSelected ? "white" : canSelect ? "var(--text-muted)" : "var(--text-dim)",
                  border: "1px solid var(--border)",
                  opacity: canSelect ? 1 : 0.55,
                }}
              >
                {isSelected ? "✓" : "Select"}
              </button>
              {canBook ? (
                <a
                  href={flight.booking_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-0.5"
                  style={{ background: "var(--surface)", color: "var(--text-muted)", border: "1px solid var(--border)" }}
                >
                  Book <ArrowRight size={9} />
                </a>
              ) : (
                <div
                  className="px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-0.5"
                  style={{ background: "var(--surface)", color: "var(--text-dim)", border: "1px solid var(--border)", opacity: 0.55 }}
                >
                  Hold
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function AdviceCard({ data, origin, destination }: { data: FlightResult; origin?: string; destination?: string }) {
  const { sendMessage } = useSSE()
  return (
    <div className="rounded-2xl p-4 my-2 space-y-3" style={{ background: "var(--surface-2)", border: "1px solid var(--border-subtle)", boxShadow: "var(--card-shadow)" }}>
      <div>
        <p className="text-sm font-semibold" style={{ color: "var(--text)" }}>
          {data.title || "Flight options need a softer fallback"}
        </p>
        {data.summary ? (
          <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
            {data.summary}
          </p>
        ) : null}
        {data.details ? (
          <p className="mt-2 text-xs" style={{ color: "var(--text-dim)" }}>
            {data.details}
          </p>
        ) : null}
      </div>

      {data.confirmed_operators?.length ? (
        <div className="rounded-xl p-3" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--border-subtle)" }}>
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] mb-2" style={{ color: "var(--accent-light)" }}>
            Airlines on this route
          </p>
          <div className="flex flex-wrap gap-2">
            {data.confirmed_operators.map((op) =>
              op.booking_url ? (
                <a
                  key={op.iata}
                  href={op.booking_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold transition-opacity hover:opacity-80"
                  style={{ background: "rgba(61,140,214,0.12)", color: "var(--accent-light)", border: "1px solid rgba(61,140,214,0.24)" }}
                >
                  {op.name} <ArrowRight size={10} />
                </a>
              ) : (
                <span
                  key={op.iata}
                  className="rounded-full px-3 py-1.5 text-xs font-semibold"
                  style={{ background: "var(--surface)", color: "var(--text-muted)", border: "1px solid var(--border)" }}
                >
                  {op.name}
                </span>
              )
            )}
          </div>
        </div>
      ) : null}

      <div className="grid gap-2 md:grid-cols-3">
        {!data.confirmed_operators?.length && data.suggested_dates?.length ? (
          <SuggestionBlock
            title="Try nearby dates"
            items={data.suggested_dates}
            onItemClick={(date) =>
              sendMessage(`find flights from ${origin ?? "LON"} to ${destination ?? "?"} on ${date}`)
            }
          />
        ) : null}
        {!data.confirmed_operators?.length && data.suggested_origins?.length ? (
          <SuggestionBlock title="Alternative airports" items={data.suggested_origins} />
        ) : null}
        {!data.confirmed_operators?.length && data.suggested_hubs?.length ? (
          <SuggestionBlock title="Likely connection hubs" items={data.suggested_hubs} />
        ) : null}
      </div>
    </div>
  )
}

function SuggestionBlock({ title, items, onItemClick }: { title: string; items: string[]; onItemClick?: (item: string) => void }) {
  return (
    <div className="rounded-xl p-3" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--border-subtle)" }}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em]" style={{ color: "var(--accent-light)" }}>
        {title}
      </p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {items.map((item) =>
          onItemClick ? (
            <button
              key={item}
              onClick={() => onItemClick(item)}
              className="rounded-full px-2 py-1 text-[11px] font-medium cursor-pointer transition-opacity hover:opacity-75"
              style={{ background: "var(--surface)", color: "var(--accent-light)", border: "1px solid rgba(61,140,214,0.3)" }}
            >
              {item}
            </button>
          ) : (
            <span
              key={item}
              className="rounded-full px-2 py-1 text-[11px] font-medium"
              style={{ background: "var(--surface)", color: "var(--text-muted)", border: "1px solid var(--border)" }}
            >
              {item}
            </span>
          )
        )}
      </div>
    </div>
  )
}

function StatusCard({ title, message }: { title: string; message: string }) {
  return (
    <div className="rounded-xl p-3 my-2" style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
      <p className="text-sm font-semibold" style={{ color: "var(--text)" }}>{title}</p>
      <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>{message}</p>
    </div>
  )
}

function ErrorCard({ message }: { message: string }) {
  return (
    <div className="rounded-xl p-3 my-2 text-sm" style={{ background: "var(--surface-2)", color: "var(--text-muted)", border: "1px solid var(--border)" }}>
      {message}
    </div>
  )
}
