"use client"

import { X, MapPin } from "lucide-react"
import { useTripStore } from "@/hooks/useTripStore"

function RatingStars({ rating }: { rating: number }) {
  const full = Math.round(rating)
  return (
    <span style={{ color: "#f59e0b", letterSpacing: "1px", fontSize: "14px" }}>
      {"★".repeat(full)}{"☆".repeat(5 - full)}
    </span>
  )
}

export function PlaceDetailDrawer() {
  const { selectedPlaceDetail: place, setSelectedPlaceDetail, pinnedPlaceIds, togglePin } = useTripStore()
  const isOpen = place !== null
  const isPinned = place ? pinnedPlaceIds.has(place.name) : false

  return (
    <div
      className="absolute top-0 left-0 h-full z-[2000]"
      style={{
        width: "310px",
        transform: isOpen ? "translateX(0)" : "translateX(-100%)",
        transition: "transform 0.35s cubic-bezier(0.32, 0.72, 0, 1)",
        pointerEvents: isOpen ? "auto" : "none",
        willChange: "transform",
      }}
    >
      <div
        className="h-full flex flex-col"
        style={{
          background: "var(--surface)",
          borderRight: "1px solid var(--border)",
          boxShadow: "4px 0 32px rgba(0,0,0,0.5)",
        }}
      >
        {/* ── Hero image ── */}
        <div className="relative flex-shrink-0 overflow-hidden" style={{ height: "210px" }}>
          {place?.photo_url ? (
            <img src={place.photo_url} alt={place.name} className="w-full h-full object-cover" />
          ) : (
            <div
              className="w-full h-full flex items-center justify-center text-5xl"
              style={{ background: "var(--surface-2)" }}
            >
              📍
            </div>
          )}

          {/* Gradient overlay */}
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(to bottom, rgba(0,0,0,0.35) 0%, transparent 35%, rgba(0,0,0,0.65) 100%)",
            }}
          />

          {/* Close button */}
          <button
            onClick={() => setSelectedPlaceDetail(null)}
            className="absolute top-3 right-3 w-7 h-7 rounded-full flex items-center justify-center cursor-pointer transition-opacity hover:opacity-80"
            style={{
              background: "rgba(0,0,0,0.55)",
              color: "white",
              backdropFilter: "blur(6px)",
              border: "1px solid rgba(255,255,255,0.1)",
            }}
          >
            <X size={13} />
          </button>

          {/* Category badge – bottom left */}
          {place?.category && (
            <span
              className="absolute bottom-3 left-3 px-2 py-1 rounded-full text-xs capitalize"
              style={{ background: "rgba(0,0,0,0.7)", color: "rgba(255,255,255,0.9)" }}
            >
              {place.category}
            </span>
          )}

          {/* Open / Closed – bottom right */}
          {place?.open_now != null && (
            <span
              className="absolute bottom-3 right-3 px-2 py-1 rounded-full text-xs font-semibold"
              style={{
                background: "rgba(0,0,0,0.7)",
                color: place.open_now ? "#22c55e" : "#f87171",
              }}
            >
              {place.open_now ? "● Open now" : "● Closed"}
            </span>
          )}
        </div>

        {/* ── Scrollable body ── */}
        <div className="flex-1 overflow-y-auto px-4 py-4" style={{ scrollbarWidth: "thin" }}>

          {/* Title */}
          <h2 className="text-base font-bold leading-snug mb-2" style={{ color: "var(--text)" }}>
            {place?.name}
          </h2>

          {/* Rating row */}
          {place?.rating != null && (
            <div className="flex items-center gap-2 mb-3">
              <RatingStars rating={place.rating} />
              <span className="text-sm font-semibold" style={{ color: "var(--text)" }}>
                {place.rating}
              </span>
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>/ 5.0</span>
            </div>
          )}

          {/* Pill tags */}
          <div className="flex flex-wrap gap-1.5 mb-4">
            {place?.category && (
              <span
                className="px-2 py-0.5 rounded-full text-xs capitalize"
                style={{
                  background: "rgba(61,140,214,0.12)",
                  color: "var(--accent-light)",
                  border: "1px solid rgba(61,140,214,0.25)",
                }}
              >
                {place.category}
              </span>
            )}
            {place?.price_level && (
              <span
                className="px-2 py-0.5 rounded-full text-xs"
                style={{
                  background: "var(--surface-2)",
                  color: "var(--text-muted)",
                  border: "1px solid var(--border)",
                }}
              >
                {place.price_level}
              </span>
            )}
            {place?.open_now != null && (
              <span
                className="px-2 py-0.5 rounded-full text-xs font-medium"
                style={{
                  background: place.open_now ? "rgba(34,197,94,0.1)" : "rgba(248,113,113,0.1)",
                  color: place.open_now ? "#22c55e" : "#f87171",
                  border: `1px solid ${place.open_now ? "rgba(34,197,94,0.2)" : "rgba(248,113,113,0.2)"}`,
                }}
              >
                {place.open_now ? "Open" : "Closed"}
              </span>
            )}
          </div>

          {/* Summary */}
          {place?.summary && (
            <p className="text-sm leading-relaxed mb-4" style={{ color: "var(--text-muted)" }}>
              {place.summary}
            </p>
          )}

          {/* Address */}
          {place?.address && (
            <div className="flex items-start gap-2">
              <MapPin size={12} className="flex-shrink-0 mt-0.5" style={{ color: "var(--text-muted)" }} />
              <p className="text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
                {place.address}
              </p>
            </div>
          )}
        </div>

        {/* ── Sticky action button ── */}
        <div
          className="px-4 pb-5 pt-3 flex-shrink-0"
          style={{ borderTop: "1px solid var(--border)" }}
        >
          <button
            onClick={() => place && togglePin(place.name)}
            className="w-full py-3 rounded-xl text-sm font-semibold transition-all cursor-pointer"
            style={{
              background: isPinned ? "var(--accent)" : "rgba(61,140,214,0.14)",
              color: isPinned ? "white" : "var(--accent-light)",
              border: `1px solid ${isPinned ? "var(--accent)" : "rgba(61,140,214,0.3)"}`,
              boxShadow: isPinned ? "0 4px 16px rgba(24,95,165,0.4)" : "none",
            }}
          >
            {isPinned ? "✓ Added to Itinerary" : "+ Add to Itinerary"}
          </button>
        </div>
      </div>
    </div>
  )
}
