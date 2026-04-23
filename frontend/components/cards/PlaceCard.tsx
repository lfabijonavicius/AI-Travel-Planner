"use client"

import { PlaceResult } from "@/types"
import { useTripStore } from "@/hooks/useTripStore"
import { MapPin } from "lucide-react"
import { useScrollToLatest } from "@/hooks/useScrollToLatest"

interface Props {
  data: PlaceResult[]
}

export function PlaceCard({ data }: Props) {
  const { pinnedPlaceIds, togglePin, setHoveredPlace, setSelectedPlaceDetail } = useTripStore()
  const cardRef = useScrollToLatest(data)

  if (!data?.length || (data[0] as any)?.error) return null

  return (
    <div ref={cardRef} className="my-2 grid grid-cols-3 gap-2">
      {data.map((place, i) => {
        const isPinned = pinnedPlaceIds.has(place.name)
        return (
          <div
            key={i}
            data-place-name={place.name}
            className="rounded-xl overflow-hidden flex flex-col transition-all cursor-pointer"
            style={{
              background: "var(--surface-2)",
              boxShadow: isPinned ? "var(--card-shadow-hover)" : "var(--card-shadow)",
              border: `1px solid ${isPinned ? "rgba(61,140,214,0.4)" : "var(--border-subtle)"}`,
            }}
            onMouseEnter={() => setHoveredPlace(place.name)}
            onMouseLeave={() => setHoveredPlace(null)}
          >
            {/* Aspect-ratio photo with overlaid badges — click opens detail drawer */}
            <div
              className="relative aspect-[4/3] overflow-hidden flex-shrink-0 cursor-pointer"
              style={{ background: "var(--surface)" }}
              onClick={() => setSelectedPlaceDetail(place)}
            >
              {place.photo_url ? (
                <img src={place.photo_url} alt={place.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <MapPin size={20} style={{ color: "var(--border)" }} />
                </div>
              )}

              {/* Rating — top-left */}
              {place.rating != null && (
                <div
                  className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded text-xs font-semibold"
                  style={{ background: "rgba(0,0,0,0.7)", color: "#f59e0b" }}
                >
                  ★ {place.rating}
                </div>
              )}

              {/* Price level — top-right */}
              {place.price_level && (
                <div
                  className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded text-xs"
                  style={{ background: "rgba(0,0,0,0.7)", color: "rgba(255,255,255,0.75)" }}
                >
                  {place.price_level}
                </div>
              )}

              {/* Category — bottom-left */}
              <div
                className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 rounded text-xs capitalize"
                style={{ background: "rgba(0,0,0,0.7)", color: "rgba(255,255,255,0.85)" }}
              >
                {place.category}
              </div>

              {/* Open status — bottom-right */}
              {place.open_now != null && (
                <div
                  className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded text-xs font-medium"
                  style={{ background: "rgba(0,0,0,0.7)", color: place.open_now ? "#22c55e" : "#f87171" }}
                >
                  {place.open_now ? "Open" : "Closed"}
                </div>
              )}
            </div>

            {/* Name + summary — click opens detail drawer */}
            <div
              className="px-2.5 pt-2 pb-1 flex-1 cursor-pointer"
              onClick={() => setSelectedPlaceDetail(place)}
            >
              <p className="text-xs font-semibold leading-snug line-clamp-2 tracking-tight" style={{ color: "var(--text)" }}>
                {place.name}
              </p>
              {place.summary && (
                <p className="text-xs mt-1 line-clamp-2 leading-relaxed" style={{ color: "var(--text-muted)", fontSize: "11px" }}>
                  {place.summary}
                </p>
              )}
            </div>

            {/* Add to itinerary button */}
            <div className="px-2.5 pb-2.5 pt-1">
              <button
                onClick={() => togglePin(place.name)}
                className="w-full py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer"
                style={{
                  background: isPinned ? "var(--accent)" : "var(--surface)",
                  color: isPinned ? "white" : "var(--text-muted)",
                  border: `1px solid ${isPinned ? "var(--accent)" : "var(--border)"}`,
                }}
              >
                {isPinned ? "✓ Added to itinerary" : "+ Add to itinerary"}
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
