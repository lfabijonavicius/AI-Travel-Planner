"use client"

import { Heart, MapPin, Plus, Star, X } from "lucide-react"
import { useMemo, useState } from "react"
import { useTripStore } from "@/hooks/useTripStore"
import { useSSE } from "@/hooks/useSSE"

export function DestinationDetailPanel() {
  const {
    selectedDestinationDetail,
    setSelectedDestinationDetail,
    discoveryHighlights,
    discoveryHighlightsLoading,
    discoveryHighlightFilter,
    setDiscoveryHighlightFilter,
    setSelectedPlaceDetail,
    setTargetLocation,
  } = useTripStore()
  const { sendMessage } = useSSE()
  const [favorited, setFavorited] = useState(false)
  const d = selectedDestinationDetail

  const visibleHighlights = useMemo(() => {
    const filtered =
      discoveryHighlightFilter === "all"
        ? discoveryHighlights
        : discoveryHighlights.filter((place) => classifyHighlight(place.category) === discoveryHighlightFilter)
    return filtered.slice(0, 4)
  }, [discoveryHighlightFilter, discoveryHighlights])
  const iconCount = discoveryHighlights.filter((place) => classifyHighlight(place.category) === "icons").length
  const attractionCount = discoveryHighlights.filter((place) => classifyHighlight(place.category) === "attractions").length
  const foodCount = discoveryHighlights.filter((place) => classifyHighlight(place.category) === "restaurants").length

  if (!d) return null
  const destination = d

  function handlePlan() {
    sendMessage(`Plan a trip to ${destination.name}, ${destination.country}`, {
      destination: destination.name,
      origin: "LON",
    })
  }

  function openHighlight(name: string) {
    const place = discoveryHighlights.find((item) => item.name === name)
    if (!place) return
    setSelectedPlaceDetail(place)
    setTargetLocation({ lat: place.lat, lng: place.lng })
  }

  return (
    <div className="absolute left-6 top-6 z-[1200] w-[316px] max-w-[calc(100%-3rem)] max-h-[calc(100vh-3rem)]">
      <div
        data-testid="city-detail-card"
        className="overflow-hidden rounded-2xl max-h-[calc(100vh-3rem)] flex flex-col"
        style={{
          background: "var(--surface)",
          boxShadow: "0 18px 48px rgba(0,0,0,0.38)",
          border: "1px solid rgba(255,255,255,0.08)",
          backdropFilter: "blur(10px)",
        }}
      >
        <button
          onClick={() => setSelectedDestinationDetail(null)}
          data-testid="city-detail-card-close"
          className="absolute left-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full cursor-pointer"
          style={{ background: "rgba(10,14,22,0.72)", color: "white", border: "1px solid rgba(255,255,255,0.12)" }}
          aria-label="Close"
        >
          <X size={14} />
        </button>

        <div className="relative aspect-[1.2] overflow-hidden shrink-0" style={{ background: "#152033" }}>
          {destination.photo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={destination.photo_url} alt={destination.name} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-6xl opacity-30">🌍</div>
          )}

          <div
            className="absolute inset-0"
            style={{ background: "linear-gradient(to bottom, rgba(8,12,20,0.10), rgba(8,12,20,0.05) 35%, rgba(8,12,20,0.92))" }}
          />

          <div className="absolute right-3 top-3 flex items-center gap-2">
            <button
              onClick={() => setFavorited((v) => !v)}
              className="flex h-8 w-8 items-center justify-center rounded-full cursor-pointer transition-transform hover:scale-105"
              style={{ background: "rgba(10,14,22,0.72)", color: "white", border: "1px solid rgba(255,255,255,0.12)" }}
              aria-label="Save"
            >
              <Heart size={14} fill={favorited ? "#f87171" : "none"} style={{ color: favorited ? "#f87171" : "white" }} />
            </button>
            <button
              onClick={handlePlan}
              className="flex h-8 w-8 items-center justify-center rounded-full cursor-pointer transition-transform hover:scale-105"
              style={{ background: "rgba(10,14,22,0.72)", color: "white", border: "1px solid rgba(255,255,255,0.12)" }}
              aria-label="Plan this trip"
            >
              <Plus size={14} />
            </button>
          </div>

          {destination.rating != null && (
            <div
              className="absolute right-3 bottom-3 rounded-full px-2.5 py-1 text-xs font-semibold"
              style={{
                background: "rgba(10,14,22,0.78)",
                color: "white",
                border: "1px solid rgba(255,255,255,0.12)",
              }}
            >
              <span className="inline-flex items-center gap-1">
                <Star size={12} fill="#f59e0b" style={{ color: "#f59e0b" }} />
                {destination.rating.toFixed(1)}
              </span>
            </div>
          )}
        </div>

        <div className="px-4 pb-4 pt-3 overflow-y-auto" style={{ scrollbarWidth: "thin" }}>
          <h3 className="text-[26px] font-semibold leading-[1.02] tracking-[-0.03em]" style={{ color: "var(--text)" }}>
            {destination.name}
          </h3>

          <div className="mt-1 flex items-center gap-1 text-xs" style={{ color: "var(--text-muted)" }}>
            <MapPin size={12} />
            <span>{destination.region || destination.country}</span>
          </div>

          <p className="mt-3 text-[13px] leading-relaxed line-clamp-3" style={{ color: "var(--text)" }}>
            {destination.description}
          </p>

          {destination.rating_count != null && (
            <div className="mt-3 flex items-center gap-1 text-xs" style={{ color: "var(--text-muted)" }}>
              <Heart size={12} fill="currentColor" />
              <span>Popular with {formatCount(destination.rating_count)} travelers</span>
            </div>
          )}

          <div
            className="mt-4 rounded-2xl px-3 py-3"
            style={{
              background: "rgba(24,95,165,0.075)",
              border: "1px solid rgba(61,140,214,0.18)",
            }}
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--accent-light)" }}>
                  Explore The Map
                </p>
                <p className="mt-1 text-[11px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
                  {discoveryHighlightsLoading
                    ? `Lighting up ${destination.name} with places worth a closer look…`
                    : discoveryHighlights.length
                      ? `${iconCount} iconic places, ${attractionCount} sights, and ${foodCount} food spots are now pinned around ${destination.name}.`
                      : `Open this destination to scatter iconic landmarks, sights, and food spots across the map.`}
                </p>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <FilterChip
                label={`All ${discoveryHighlights.length ? `(${discoveryHighlights.length})` : ""}`.trim()}
                active={discoveryHighlightFilter === "all"}
                onClick={() => setDiscoveryHighlightFilter("all")}
              />
              <FilterChip
                label={`Icons ${iconCount ? `(${iconCount})` : ""}`.trim()}
                active={discoveryHighlightFilter === "icons"}
                onClick={() => setDiscoveryHighlightFilter("icons")}
              />
              <FilterChip
                label={`Sights ${attractionCount ? `(${attractionCount})` : ""}`.trim()}
                active={discoveryHighlightFilter === "attractions"}
                onClick={() => setDiscoveryHighlightFilter("attractions")}
              />
              <FilterChip
                label={`Food ${foodCount ? `(${foodCount})` : ""}`.trim()}
                active={discoveryHighlightFilter === "restaurants"}
                onClick={() => setDiscoveryHighlightFilter("restaurants")}
              />
            </div>

            <div className="mt-3 grid grid-cols-1 gap-2">
              {discoveryHighlightsLoading ? (
                <div className="rounded-xl px-3 py-2 text-xs" style={{ background: "rgba(255,255,255,0.035)", color: "var(--text-muted)", border: "1px solid var(--border)" }}>
                  Finding iconic landmarks, sights, and food spots around {d.name}…
                </div>
              ) : visibleHighlights.length ? (
                visibleHighlights.map((place) => (
                  <button
                    key={`${place.name}-${place.lat}-${place.lng}`}
                    onClick={() => openHighlight(place.name)}
                    className="rounded-xl px-3 py-2 text-left cursor-pointer transition-colors hover:bg-white/6"
                    style={{ background: "rgba(255,255,255,0.035)", border: "1px solid var(--border)" }}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold truncate" style={{ color: "var(--text)" }}>
                          {place.name}
                        </p>
                        <p className="mt-0.5 text-[10px]" style={{ color: "var(--text-muted)" }}>
                          {highlightLabel(classifyHighlight(place.category))}{place.rating != null ? ` · ★ ${place.rating.toFixed(1)}` : ""}
                        </p>
                      </div>
                      <span className="text-[9px] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--accent-light)" }}>
                        Open
                      </span>
                    </div>
                  </button>
                ))
              ) : (
                <div className="rounded-xl px-3 py-2 text-xs" style={{ background: "rgba(255,255,255,0.035)", color: "var(--text-muted)", border: "1px solid var(--border)" }}>
                  No map highlights were found yet for this destination.
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-2">
            {destination.why_now && <PreviewFact label="Why now" value={destination.why_now} />}
            {destination.best_for && <PreviewFact label="Best for" value={destination.best_for} />}
            {destination.tradeoff && <PreviewFact label="Tradeoff" value={destination.tradeoff} />}
          </div>

          <div className="mt-4 flex gap-2">
            <button
              onClick={handlePlan}
              className="flex-1 rounded-xl px-3 py-2 text-sm font-semibold cursor-pointer"
              style={{
                background: "var(--accent)",
                color: "white",
                boxShadow: "0 2px 10px rgba(24,95,165,0.42)",
              }}
            >
              {destination.plan_title || `Plan ${destination.name}`}
            </button>
            <button
              onClick={() => sendMessage(`Compare ${destination.name} with the other June options and tell me its strongest advantage.`)}
              className="rounded-xl px-3 py-2 text-sm font-semibold cursor-pointer"
              style={{
                background: "transparent",
                color: "var(--text)",
                border: "1px solid var(--border)",
              }}
            >
              Compare
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function FilterChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="rounded-full px-2.5 py-1 text-[11px] font-semibold cursor-pointer"
      style={{
        background: active ? "rgba(61,140,214,0.18)" : "rgba(255,255,255,0.04)",
        color: active ? "var(--text)" : "var(--text-muted)",
        border: `1px solid ${active ? "rgba(61,140,214,0.28)" : "var(--border)"}`,
      }}
    >
      {label}
    </button>
  )
}

function classifyHighlight(category: string) {
  if (/restaurant|food|cafe|bar|bistro|bakery/i.test(category)) return "restaurants"
  if (/landmark|monument|historic|heritage|palace|castle|fortress|citadel|ruins|icon/i.test(category)) return "icons"
  return "attractions"
}

function highlightLabel(kind: "icons" | "attractions" | "restaurants") {
  if (kind === "icons") return "Iconic place"
  if (kind === "restaurants") return "Food spot"
  return "Sight"
}

function PreviewFact({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="rounded-xl px-3 py-2"
      style={{
        background: "rgba(255,255,255,0.035)",
        border: "1px solid var(--border)",
      }}
    >
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.16em]" style={{ color: "var(--text-muted)" }}>
        {label}
      </p>
      <p className="text-xs leading-relaxed line-clamp-2" style={{ color: "var(--text)" }}>
        {value}
      </p>
    </div>
  )
}

function formatCount(value: number) {
  if (value >= 1000) return `${(value / 1000).toFixed(1).replace(".0", "")}k`
  return `${value}`
}
