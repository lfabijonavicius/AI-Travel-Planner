"use client"

import { PlaceResult } from "@/types"
import { useTripStore } from "@/hooks/useTripStore"
import { ArrowRight, Clock3, Heart, MapPin, Plus } from "lucide-react"
import { useScrollToLatest } from "@/hooks/useScrollToLatest"
import { useSSE } from "@/hooks/useSSE"
import { ToolCarousel } from "./ToolCarousel"
import { buildPlaceBrowseSections, classifyPlaceBrowseKind } from "@/lib/placeBrowse"

interface Props {
  data: PlaceResult[]
}

export function PlaceCard({ data }: Props) {
  const {
    pinnedPlaceIds,
    togglePin,
    setHoveredPlace,
    setSelectedPlaceDetail,
    setTargetLocation,
    interactionMode,
    hoveredBrowseSection,
    focusedBrowseSection,
    setHoveredBrowseSection,
    setFocusedBrowseSection,
  } = useTripStore()
  const cardRef = useScrollToLatest(data)
  const { sendMessage } = useSSE()

  if (!data?.length || (data[0] as any)?.error) return null

  function openPlace(place: PlaceResult) {
    setSelectedPlaceDetail(place)
    setTargetLocation({ lat: place.lat, lng: place.lng })
  }

  if (interactionMode === "info") {
    const sections = buildPlaceBrowseSections(data)
    return (
      <div ref={cardRef} className="my-4 space-y-4">
        <div
          className="rounded-2xl px-4 py-3"
          style={{
            background: "linear-gradient(135deg, rgba(24,95,165,0.18), rgba(61,140,214,0.08))",
            border: "1px solid rgba(61,140,214,0.24)",
            boxShadow: "var(--card-shadow)",
          }}
        >
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--accent-light)" }}>
            Curated Browse
          </p>
          <p className="text-sm leading-relaxed" style={{ color: "var(--text)" }}>
            Grouped the way the destination actually unfolds on foot, so you can scan clusters first and only dive deeper where the map feels strongest.
          </p>
        </div>

        <div className="space-y-3">
          {sections.map((section) => {
            const isFocused = focusedBrowseSection === section.id
            const isHovered = hoveredBrowseSection === section.id
            const isActive = isFocused || isHovered
            return (
            <section
              key={section.id}
              className="space-y-2.5"
              onMouseEnter={() => setHoveredBrowseSection(section.id)}
              onMouseLeave={() => setHoveredBrowseSection(null)}
            >
              <div
                className="rounded-2xl px-4 py-3"
                style={{
                  background: `linear-gradient(135deg, ${section.accent}${isActive ? "24" : "18"}, rgba(13,18,28,0.72))`,
                  border: `1px solid ${isActive ? `${section.accent}55` : `${section.accent}33`}`,
                  boxShadow: isActive ? `0 10px 24px ${section.accent}20` : "none",
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold" style={{ color: "var(--text)" }}>
                      {section.title}
                    </p>
                    <p className="mt-1 text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
                      {section.blurb}
                    </p>
                  </div>
                  <span
                    className="shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]"
                    style={{
                      color: section.accent,
                      background: `${section.accent}12`,
                      border: `1px solid ${section.accent}2e`,
                    }}
                  >
                    {section.places.length} {section.places.length === 1 ? "spot" : "spots"}
                  </span>
                </div>
                <div className="mt-3 flex justify-end">
                  <button
                    onClick={() => setFocusedBrowseSection(section.id)}
                    className="rounded-lg px-2.5 py-1.5 text-[11px] font-semibold cursor-pointer"
                    style={{
                      color: isFocused ? "white" : section.accent,
                      background: isFocused ? section.accent : `${section.accent}10`,
                      border: `1px solid ${section.accent}35`,
                    }}
                  >
                    {isFocused ? "Focused on map" : "Spotlight on map"}
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                {section.places.map((place, i) => {
                  const isPinned = pinnedPlaceIds.has(place.name)
                  const browseKind = classifyPlaceBrowseKind(place)
                  return (
                    <div
                      key={`${section.id}-${place.name}-${i}`}
                      data-place-name={place.name}
                      onMouseEnter={() => setHoveredPlace(place.name)}
                      onMouseLeave={() => setHoveredPlace(null)}
                      onClick={() => openPlace(place)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault()
                          openPlace(place)
                        }
                      }}
                      role="button"
                      tabIndex={0}
                      className="w-full rounded-2xl p-3 text-left cursor-pointer transition-all hover:translate-y-[-1px]"
                      style={{
                        background: "var(--surface-2)",
                        border: `1px solid ${isPinned ? `${section.accent}66` : "var(--border-subtle)"}`,
                        boxShadow: isPinned ? "var(--card-shadow-hover)" : "var(--card-shadow)",
                      }}
                    >
                      <div className="flex gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-base font-semibold leading-tight" style={{ color: "var(--text)" }}>
                                {place.name}
                              </p>
                              <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px]" style={{ color: "var(--text-muted)" }}>
                                <span
                                  className="rounded-full px-2 py-0.5 capitalize"
                                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--border)" }}
                                >
                                  {prettyPlaceCategory(place.category)}
                                </span>
                                {place.rating != null && <span>★ {place.rating.toFixed(1)}</span>}
                                {place.price_level && <span>{place.price_level}</span>}
                                {place.open_now != null && <span>{place.open_now ? "Open now" : "Closed"}</span>}
                              </div>
                            </div>
                            <span
                              className="shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]"
                              style={{
                                color: section.accent,
                                background: `${section.accent}12`,
                                border: `1px solid ${section.accent}2a`,
                              }}
                            >
                              {browseKind === "restaurants" ? "Food" : browseKind === "icons" ? "Iconic" : "Sight"}
                            </span>
                          </div>

                          {place.summary && (
                            <p className="mt-2 text-sm leading-relaxed line-clamp-3" style={{ color: "var(--text)" }}>
                              {place.summary}
                            </p>
                          )}

                          <div className="mt-3 flex items-center justify-between gap-3">
                            <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                              {place.address || infoLineForPlace(place)}
                            </p>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  togglePin(place.name)
                                }}
                                className="text-[11px] font-semibold px-2.5 py-1.5 rounded-lg cursor-pointer"
                                style={{
                                  background: isPinned ? "var(--accent)" : "rgba(255,255,255,0.04)",
                                  color: isPinned ? "white" : "var(--text)",
                                  border: `1px solid ${isPinned ? "var(--accent)" : "var(--border)"}`,
                                }}
                              >
                                {isPinned ? "Added" : "Add"}
                              </button>
                            </div>
                          </div>
                        </div>

                        <div className="w-[112px] shrink-0 overflow-hidden rounded-xl" style={{ background: "var(--surface)" }}>
                          {place.photo_url ? (
                            <img src={place.photo_url} alt={place.name} className="h-[112px] w-full object-cover" />
                          ) : (
                            <div className="flex h-[112px] w-full items-center justify-center">
                              <MapPin size={20} style={{ color: "var(--border)" }} />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
          )})}
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--text-muted)" }}>
            You might want to ask
          </p>
          <div className="flex flex-wrap gap-2">
            {buildPlaceFollowUps(data).map((prompt) => (
              <button
                key={prompt}
                onClick={() => sendMessage(prompt)}
                className="text-xs px-3 py-1.5 rounded-full cursor-pointer transition-all"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  color: "var(--text)",
                  border: "1px solid var(--border)",
                }}
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div ref={cardRef}>
      <ToolCarousel
        eyebrow="Places To Explore"
        description="A few compact picks to compare on the map before you add anything into the trip."
        followUps={buildPlaceFollowUps(data).map((prompt) => ({
          label: prompt,
          onClick: () => sendMessage(prompt),
        }))}
      >
        {data.map((place, i) => {
          const isPinned = pinnedPlaceIds.has(place.name)
          return (
            <div
              key={i}
              data-place-name={place.name}
              className="snap-start shrink-0 w-[248px] rounded-2xl overflow-hidden flex flex-col transition-all cursor-pointer"
              style={{
                background: "var(--surface-2)",
                boxShadow: isPinned ? "var(--card-shadow-hover)" : "var(--card-shadow)",
                border: `1px solid ${isPinned ? "rgba(61,140,214,0.4)" : "var(--border-subtle)"}`,
              }}
              onMouseEnter={() => setHoveredPlace(place.name)}
              onMouseLeave={() => setHoveredPlace(null)}
              onClick={() => openPlace(place)}
            >
              <div className="relative aspect-[0.96] overflow-hidden flex-shrink-0" style={{ background: "var(--surface)" }}>
                {place.photo_url ? (
                  <img src={place.photo_url} alt={place.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <MapPin size={22} style={{ color: "var(--border)" }} />
                  </div>
                )}
                <div
                  className="absolute inset-0"
                  style={{ background: "linear-gradient(to top, rgba(5,10,18,0.92), rgba(5,10,18,0.15) 45%, rgba(5,10,18,0))" }}
                />
                {place.rating != null && (
                  <div
                    className="absolute top-3 right-3 px-2 py-1 rounded-full text-[11px] font-semibold"
                    style={{ background: "rgba(10,14,22,0.78)", color: "white", border: "1px solid rgba(255,255,255,0.12)" }}
                  >
                    ★ {place.rating.toFixed(1)}
                  </div>
                )}
                <div
                  className="absolute top-3 left-3 px-2.5 py-1 rounded-full text-[11px] font-semibold capitalize"
                  style={{ background: "rgba(10,14,22,0.78)", color: "white", border: "1px solid rgba(255,255,255,0.12)" }}
                >
                  {place.category}
                </div>
                <div className="absolute left-0 right-0 bottom-0 px-4 pb-4 pt-10">
                  <h3 className="font-bold text-base leading-tight text-white line-clamp-2">{place.name}</h3>
                  <div className="mt-1 flex items-center gap-2 text-[11px]" style={{ color: "rgba(255,255,255,0.72)" }}>
                    {place.price_level && <span>{place.price_level}</span>}
                    {place.open_now != null && (
                      <span className="inline-flex items-center gap-1">
                        <Clock3 size={11} />
                        {place.open_now ? "Open now" : "Closed"}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="p-4">
                {place.summary && (
                  <p className="text-sm leading-relaxed line-clamp-3" style={{ color: "var(--text)" }}>
                    {place.summary}
                  </p>
                )}
                <div className="mt-3 flex items-center gap-1.5 text-[11px]" style={{ color: "var(--text-muted)" }}>
                  <Heart size={11} />
                  <span>{place.rating != null ? `Well-rated ${place.category} stop` : `Good stop to compare on the map`}</span>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      togglePin(place.name)
                    }}
                    className="flex-1 text-xs font-semibold px-3 py-2 rounded-lg cursor-pointer flex items-center justify-center gap-1.5"
                    style={{
                      background: isPinned ? "var(--accent)" : "var(--surface)",
                      color: isPinned ? "white" : "var(--text)",
                      border: `1px solid ${isPinned ? "var(--accent)" : "var(--border)"}`,
                    }}
                  >
                    <Plus size={12} />
                    {isPinned ? "Added" : "Add to trip"}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      openPlace(place)
                    }}
                    className="text-xs font-semibold px-3 py-2 rounded-lg cursor-pointer flex items-center gap-1"
                    style={{ background: "transparent", color: "var(--text)", border: "1px solid var(--border)" }}
                  >
                    View
                    <ArrowRight size={11} />
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </ToolCarousel>
    </div>
  )
}

function prettyPlaceCategory(category: string) {
  return category
    .replace(/[_-]+/g, " ")
    .replace(/\band\b/gi, "&")
    .replace(/\s+/g, " ")
    .trim()
}

function infoLineForPlace(place: PlaceResult) {
  if (/restaurant|food|cafe|bar|bistro|bakery/i.test(place.category)) return "Good food-led stop to compare on the map"
  if (/landmark|monument|historic|heritage|attraction/i.test(place.category)) return "Strong signature stop for this destination"
  return "Worth opening on the map for a closer look"
}

function buildPlaceFollowUps(data: PlaceResult[]) {
  const prompts: string[] = []
  const restaurant = data.find((place) => /restaurant|food|cafe|bar/i.test(place.category))
  const attraction = data.find((place) => /museum|attraction|landmark|park|beach/i.test(place.category))

  if (restaurant) prompts.push(`Which of these food spots looks best for a first night?`)
  if (attraction) prompts.push(`Which of these places is most worth prioritizing?`)
  if (data[0]) prompts.push(`Which of these is closest to the center?`)
  if (data.length > 1) prompts.push(`Compare the top two place picks for vibe and convenience.`)

  return Array.from(new Set(prompts)).slice(0, 4)
}
