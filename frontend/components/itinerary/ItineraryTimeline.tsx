"use client"

import { useEffect, useRef } from "react"
import { useTripStore } from "@/hooks/useTripStore"
import { ItineraryDay, ItineraryEvent } from "@/types"

const TYPE_COLORS: Record<string, string> = {
  flight:    "#3b82f6",
  hotel:     "#14b8a6",
  activity:  "#a855f7",
  poi:       "#22c55e",
  food:      "#f59e0b",
  transport: "#6b7280",
}

const TYPE_ICONS: Record<string, string> = {
  flight:    "✈",
  hotel:     "🏨",
  activity:  "🎯",
  poi:       "📍",
  food:      "🍽",
  transport: "🚌",
}

function EventRow({ event }: { event: ItineraryEvent }) {
  const color = TYPE_COLORS[event.type] ?? "#6b7280"
  const icon  = TYPE_ICONS[event.type] ?? "•"
  return (
    <div className="flex gap-3 px-4 py-3" style={{ borderTop: "1px solid var(--border)" }}>
      <div className="flex-shrink-0 w-5 text-center text-sm leading-5" style={{ marginTop: "1px" }}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>
            {event.time}
          </span>
          <span
            className="text-xs px-1.5 py-0.5 rounded font-medium"
            style={{ background: `${color}20`, color }}
          >
            {event.type}
          </span>
          {event.price_local && (
            <span className="ml-auto text-xs font-medium" style={{ color: "var(--text-muted)" }}>
              {event.price_local}
            </span>
          )}
        </div>
        <p className="text-sm font-semibold leading-snug" style={{ color: "var(--text)" }}>
          {event.title}
        </p>
        {event.subtitle && (
          <p className="text-xs mt-0.5 leading-relaxed" style={{ color: "var(--text-muted)" }}>
            {event.subtitle}
          </p>
        )}
      </div>
    </div>
  )
}

function DayCard({
  day,
  isActive,
  isFiltered,
  onClick,
}: {
  day: ItineraryDay
  isActive: boolean
  isFiltered: boolean
  onClick: () => void
}) {
  return (
    <div
      className="flex gap-4 transition-opacity duration-300"
      style={{ opacity: isFiltered && !isActive ? 0.35 : 1 }}
      id={`itinerary-day-${day.day_number}`}
    >
      {/* Timeline spine */}
      <div className="flex flex-col items-center flex-shrink-0" style={{ width: "32px" }}>
        <button
          onClick={onClick}
          className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0 cursor-pointer transition-all"
          style={{
            background: isActive ? "var(--accent)" : "var(--surface-3)",
            boxShadow: isActive ? "0 0 0 4px var(--accent-glow), 0 2px 8px rgba(24,95,165,0.4)" : "none",
            border: isActive ? "none" : "1px solid var(--border)",
            color: isActive ? "white" : "var(--text-muted)",
          }}
        >
          {day.day_number}
        </button>
        <div className="timeline-connector" />
      </div>

      {/* Content card */}
      <div className="flex-1 pb-6 min-w-0">
        {/* Day header */}
        <div
          className="flex items-center gap-3 mb-3 cursor-pointer"
          onClick={onClick}
        >
          <div className="flex-1 min-w-0">
            <p
              className="text-sm font-bold leading-snug"
              style={{ color: isActive ? "var(--accent-light)" : "var(--text)" }}
            >
              {day.label}
            </p>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
              {new Date(day.date + "T12:00:00").toLocaleDateString("en-GB", {
                weekday: "long", day: "numeric", month: "short",
              })}
              {" · "}{day.city}
            </p>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <span className="text-lg leading-none">{day.weather_icon}</span>
            <div className="text-right">
              <p className="text-xs font-semibold" style={{ color: "var(--text)" }}>
                {day.weather_high}°
              </p>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                {day.weather_low}°
              </p>
            </div>
          </div>
        </div>

        {/* Events card */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{
            background: "var(--surface-2)",
            boxShadow: isActive ? "var(--card-shadow-hover)" : "var(--card-shadow)",
            border: isActive ? "1px solid rgba(61,140,214,0.3)" : "1px solid var(--border-subtle)",
          }}
        >
          {day.events.map((event, i) => (
            <EventRow key={i} event={event} />
          ))}
        </div>
      </div>
    </div>
  )
}

export function ItineraryTimeline() {
  const { itinerary, selectedItineraryDay, setSelectedItineraryDay } = useTripStore()
  const containerRef = useRef<HTMLDivElement>(null)

  // Scroll to day when selected
  useEffect(() => {
    if (!selectedItineraryDay) return
    const el = document.getElementById(`itinerary-day-${selectedItineraryDay}`)
    el?.scrollIntoView({ behavior: "smooth", block: "start" })
  }, [selectedItineraryDay])

  if (!itinerary) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <div className="text-3xl opacity-30">🗺️</div>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Itinerary will appear here once the agent builds your trip plan.
        </p>
      </div>
    )
  }

  const isFiltered = selectedItineraryDay !== null

  return (
    <div className="h-full overflow-y-auto" ref={containerRef}>
      <div className="px-5 py-5 max-w-xl mx-auto">
        {/* Header */}
        <div className="mb-5">
          <h2 className="text-lg font-bold tracking-tight" style={{ color: "var(--text)" }}>
            {itinerary.destination}
          </h2>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
            {itinerary.days.length} days ·{" "}
            {new Date(itinerary.days[0]?.date + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
            {" – "}
            {new Date(itinerary.days[itinerary.days.length - 1]?.date + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
          </p>
        </div>

        {/* Day filter pills */}
        <div className="flex gap-1.5 flex-wrap mb-6">
          <button
            onClick={() => setSelectedItineraryDay(null)}
            className="px-3 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer"
            style={{
              background: !isFiltered ? "var(--accent)" : "var(--surface-3)",
              color: !isFiltered ? "white" : "var(--text-muted)",
              border: `1px solid ${!isFiltered ? "var(--accent)" : "var(--border)"}`,
            }}
          >
            All days
          </button>
          {itinerary.days.map((day) => {
            const active = selectedItineraryDay === day.day_number
            return (
              <button
                key={day.day_number}
                onClick={() => setSelectedItineraryDay(active ? null : day.day_number)}
                className="px-3 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer"
                style={{
                  background: active ? "var(--accent)" : "var(--surface-3)",
                  color: active ? "white" : "var(--text-muted)",
                  border: `1px solid ${active ? "var(--accent)" : "var(--border)"}`,
                }}
              >
                {day.weather_icon} Day {day.day_number}
              </button>
            )
          })}
        </div>

        {/* Days */}
        {itinerary.days.map((day) => (
          <DayCard
            key={day.day_number}
            day={day}
            isActive={selectedItineraryDay === day.day_number || !isFiltered}
            isFiltered={isFiltered}
            onClick={() =>
              setSelectedItineraryDay(
                selectedItineraryDay === day.day_number ? null : day.day_number
              )
            }
          />
        ))}
      </div>
    </div>
  )
}
