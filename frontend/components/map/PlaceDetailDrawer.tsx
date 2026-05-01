"use client"

import { X, MapPin, Star, ArrowRight, ChevronLeft, ChevronRight, Clock3, Camera, Sparkles } from "lucide-react"
import { useTripStore } from "@/hooks/useTripStore"
import { PlaceResult, PlaceReview } from "@/types"
import { useState, useEffect, useMemo } from "react"
import { resolveItineraryEventEntity } from "@/lib/itineraryEventResolver"
import { useSSE } from "@/hooks/useSSE"

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"

interface PlaceLookupResult extends PlaceResult {
  match_score?: number
}

interface TripadvisorReview {
  id?: string
  rating?: number | null
  title?: string | null
  text?: string | null
  published_date?: string | null
  user?: { username?: string | null }
}

interface TripadvisorAward {
  display_name?: string
  year?: string
}

interface TripadvisorSubrating {
  localized_name?: string
  value?: string | number | null
}

interface TripadvisorEnrichment {
  matched: boolean
  match_score?: number
  details?: {
    location_id?: string
    name?: string
    rating?: string | number | null
    num_reviews?: string | number | null
    ranking_string?: string | null
    price_level?: string | null
    trip_types?: Array<{ localized_name?: string; value?: string }>
    awards?: TripadvisorAward[]
    web_url?: string | null
    write_review?: string | null
    description?: string | null
    reviews?: TripadvisorReview[]
    subratings?: TripadvisorSubrating[]
    photo_count?: string | number | null
    see_all_photos?: string | null
    hotel_booking?: {
      bookable?: boolean
      booking_url?: string | null
    }
    category?: string | null
    subcategory?: Array<{ localized_name?: string }>
    address_string?: string | null
  }
}

const tripadvisorCache = new Map<string, TripadvisorEnrichment | null>()

const CURRENCY_SYMBOLS: Record<string, string> = {
  GBP: "£", EUR: "€", USD: "$", JPY: "¥", CHF: "Fr",
  SEK: "kr", NOK: "kr", DKK: "kr", PLN: "zł", CZK: "Kč",
  HUF: "Ft", TRY: "₺", AED: "د.إ", THB: "฿", SGD: "S$",
}
function currencySymbol(code: string) {
  return CURRENCY_SYMBOLS[code?.toUpperCase()] ?? code ?? "£"
}

function RatingStars({ rating, size = 14 }: { rating: number; size?: number }) {
  const full = Math.round(rating)
  return (
    <span style={{ color: "#f59e0b", letterSpacing: "1px", fontSize: `${size}px` }}>
      {"★".repeat(full)}{"☆".repeat(5 - full)}
    </span>
  )
}

function ReviewCard({ review }: { review: PlaceReview }) {
  return (
    <div
      className="rounded-2xl p-3.5"
      style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))", border: "1px solid var(--border-subtle)" }}
    >
      <div className="flex items-center gap-3 mb-2.5">
        {review.author_photo ? (
          <img
            src={review.author_photo}
            alt={review.author}
            className="w-8 h-8 rounded-full object-cover flex-shrink-0"
          />
        ) : (
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold"
            style={{ background: "var(--accent)", color: "white" }}
          >
            {review.author.charAt(0).toUpperCase()}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold truncate" style={{ color: "var(--text)" }}>
            {review.author}
          </p>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            {review.relative_time}
          </p>
        </div>
        {review.rating != null && (
          <RatingStars rating={review.rating} size={11} />
        )}
      </div>

      <p className="text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
        {review.text}
      </p>
    </div>
  )
}

function uniqueUrls(urls: Array<string | null | undefined>) {
  return Array.from(new Set(urls.filter((url): url is string => !!url)))
}

function DetailSection({
  id,
  eyebrow,
  title,
  children,
}: {
  id?: string
  eyebrow: string
  title?: string
  children: React.ReactNode
}) {
  return (
    <section
      id={id}
      className="rounded-2xl px-4 py-4"
      style={{ background: "var(--surface-2)", border: "1px solid var(--border-subtle)" }}
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] mb-2" style={{ color: "var(--accent-light)" }}>
        {eyebrow}
      </p>
      {title ? (
        <p className="text-sm font-semibold mb-2" style={{ color: "var(--text)" }}>
          {title}
        </p>
      ) : null}
      {children}
    </section>
  )
}

function MetricCard({
  label,
  value,
  tone = "default",
}: {
  label: string
  value: React.ReactNode
  tone?: "default" | "accent" | "warm" | "success"
}) {
  const toneStyles =
    tone === "accent"
      ? { border: "1px solid rgba(61,140,214,0.22)", background: "rgba(61,140,214,0.08)" }
      : tone === "warm"
        ? { border: "1px solid rgba(245,158,11,0.22)", background: "rgba(245,158,11,0.08)" }
        : tone === "success"
          ? { border: "1px solid rgba(34,197,94,0.22)", background: "rgba(34,197,94,0.08)" }
          : { border: "1px solid var(--border-subtle)", background: "var(--surface-3)" }

  return (
    <div className="rounded-xl px-3 py-2.5" style={toneStyles}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] mb-1" style={{ color: "var(--text-muted)" }}>
        {label}
      </p>
      <div className="text-sm font-semibold leading-snug" style={{ color: "var(--text)" }}>
        {value}
      </div>
    </div>
  )
}

function MediaGallery({
  urls,
  alt,
  badgeLabel,
  statusLabel,
}: {
  urls: string[]
  alt: string
  badgeLabel?: string | null
  statusLabel?: { text: string; color: string } | null
}) {
  const [idx, setIdx] = useState(0)
  useEffect(() => { setIdx(0) }, [urls])
  if (!urls.length) {
    return (
      <div className="w-full h-full flex items-center justify-center text-5xl" style={{ background: "linear-gradient(135deg, #182233, #0f1521)" }}>
        📍
      </div>
    )
  }

  const currentUrl = urls[idx]
  const remainingUrls = urls.filter((_, index) => index !== idx)
  const totalCount = urls.length

  function tileButton({
    url,
    index,
    altText,
    className,
    showOverlayCount,
    active = false,
  }: {
    url: string
    index: number
    altText: string
    className: string
    showOverlayCount?: number
    active?: boolean
  }) {
    return (
      <button
        key={`${url}-${index}`}
        onClick={() => setIdx(index)}
        className={`relative overflow-hidden cursor-pointer transition-transform hover:scale-[1.01] ${className}`}
        style={{
          border: active ? "2px solid rgba(255,255,255,0.82)" : "1px solid rgba(255,255,255,0.08)",
          boxShadow: active ? "0 10px 22px rgba(0,0,0,0.24)" : "none",
        }}
      >
        <img src={url} alt={altText} className="h-full w-full object-cover" />
        <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(0,0,0,0.26), rgba(0,0,0,0.04))" }} />
        {showOverlayCount ? (
          <div className="absolute inset-0 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.42)", color: "white" }}>
            <span className="text-base font-semibold">+{showOverlayCount}</span>
          </div>
        ) : null}
      </button>
    )
  }

  function renderLayout() {
    if (totalCount === 1) {
      return (
        <div className="h-full w-full p-1.5">
          <div className="relative h-full overflow-hidden rounded-[24px]">
            <img src={currentUrl} alt={alt} className="h-full w-full object-cover" />
            <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.08), rgba(0,0,0,0.46))" }} />
          </div>
        </div>
      )
    }

    if (totalCount === 2) {
      return (
        <div className="grid h-full w-full grid-cols-2 gap-1.5 bg-black/20 p-1.5">
          {urls.map((url, index) =>
            tileButton({
              url,
              index,
              altText: `${alt} ${index + 1}`,
              className: "rounded-[24px]",
              active: index === idx,
            })
          )}
        </div>
      )
    }

    if (totalCount === 3) {
      return (
        <div className="grid h-full w-full grid-cols-3 gap-1.5 bg-black/20 p-1.5">
          {urls.map((url, index) =>
            tileButton({
              url,
              index,
              altText: `${alt} ${index + 1}`,
              className: "rounded-[22px]",
              active: index === idx,
            })
          )}
        </div>
      )
    }

    if (totalCount === 4) {
      return (
        <div className="grid h-full w-full grid-cols-2 grid-rows-2 gap-1.5 bg-black/20 p-1.5">
          {urls.map((url, index) =>
            tileButton({
              url,
              index,
              altText: `${alt} ${index + 1}`,
              className: "rounded-[22px]",
              active: index === idx,
            })
          )}
        </div>
      )
    }

    const sideTiles = remainingUrls.slice(0, 4).map((url) => ({ url, index: urls.indexOf(url) }))
    const extraCount = remainingUrls.length - 4
    return (
      <div className="grid h-full w-full grid-cols-[1.45fr_1fr] gap-1.5 bg-black/20 p-1.5">
        {tileButton({
          url: currentUrl,
          index: idx,
          altText: alt,
          className: "rounded-[24px]",
          active: true,
        })}
        <div className="grid grid-cols-2 grid-rows-2 gap-1.5">
          {sideTiles.map((tile, tileIndex) =>
            tileButton({
              url: tile.url,
              index: tile.index,
              altText: `${alt} ${tile.index + 1}`,
              className: "rounded-2xl",
              showOverlayCount: tileIndex === 3 && extraCount > 0 ? extraCount : undefined,
            })
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="relative h-full w-full overflow-hidden">
      {renderLayout()}

      <div className="absolute left-4 top-4 flex items-center gap-2">
        {badgeLabel ? (
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold capitalize" style={{ background: "rgba(0,0,0,0.7)", color: "white", border: "1px solid rgba(255,255,255,0.1)" }}>
            {badgeLabel}
          </span>
        ) : null}
        {totalCount > 1 ? (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold" style={{ background: "rgba(0,0,0,0.7)", color: "white", border: "1px solid rgba(255,255,255,0.1)" }}>
            <Camera size={12} />
            {totalCount} photos
          </span>
        ) : null}
      </div>

      {totalCount > 1 ? (
        <>
          <button
            onClick={() => setIdx((i) => (i - 1 + totalCount) % totalCount)}
            className="absolute left-4 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full flex items-center justify-center cursor-pointer"
            style={{ background: "rgba(0,0,0,0.55)", color: "white", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.12)" }}
          >
            <ChevronLeft size={15} />
          </button>
          <button
            onClick={() => setIdx((i) => (i + 1) % totalCount)}
            className="absolute right-4 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full flex items-center justify-center cursor-pointer"
            style={{ background: "rgba(0,0,0,0.55)", color: "white", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.12)" }}
          >
            <ChevronRight size={15} />
          </button>
          <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-1.5">
            {urls.map((_, index) => (
              <button
                key={`gallery-dot-${index}`}
                onClick={() => setIdx(index)}
                className="h-2.5 rounded-full cursor-pointer transition-all"
                style={{
                  width: index === idx ? "18px" : "8px",
                  background: index === idx ? "white" : "rgba(255,255,255,0.45)",
                  border: "1px solid rgba(255,255,255,0.18)",
                }}
              />
            ))}
          </div>
        </>
      ) : null}

      {statusLabel ? (
        <span
          className="absolute bottom-4 right-4 px-2.5 py-1 rounded-full text-xs font-semibold"
          style={{ background: "rgba(0,0,0,0.7)", color: statusLabel.color, border: "1px solid rgba(255,255,255,0.1)" }}
        >
          {statusLabel.text}
        </span>
      ) : null}
    </div>
  )
}

function DrawerNavPill({
  label,
  onClick,
}: {
  label: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="rounded-full px-3 py-1.5 text-[11px] font-semibold cursor-pointer transition-all hover:translate-y-[-1px]"
      style={{
        background: "rgba(255,255,255,0.04)",
        color: "var(--text)",
        border: "1px solid var(--border-subtle)",
      }}
    >
      {label}
    </button>
  )
}

function DrawerTab({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="border-b-2 px-0 pb-2 pt-1 text-sm font-medium cursor-pointer transition-colors"
      style={{
        color: active ? "var(--text)" : "var(--text-muted)",
        borderColor: active ? "rgba(255,255,255,0.92)" : "transparent",
      }}
    >
      {label}
    </button>
  )
}

function AskPrompt({
  prompt,
  onClick,
}: {
  prompt: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="w-full rounded-2xl px-4 py-3 text-left cursor-pointer transition-all hover:translate-y-[-1px]"
      style={{
        background: "linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))",
        border: "1px solid var(--border-subtle)",
      }}
    >
      <span className="text-sm leading-relaxed" style={{ color: "var(--text)" }}>
        {prompt}
      </span>
    </button>
  )
}

function normalizeLookupText(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}

function asciiFold(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
}

function buildLookupCandidates(title: string) {
  const patterns = [
    /^(?:visit|explore|discover|morning walk in|walk in|afternoon in|evening at|sunset at)\s+/i,
    /^(?:breakfast|lunch|dinner|drinks|cocktails)\s+at\s+/i,
    /^(?:hotel check in|hotel check-in|check in at|check-in at|check out from|check-out from)\s+/i,
    /^(?:flight arrival at|arrival at|departure from|transfer to)\s+/i,
  ]
  const candidates = [title.trim()]
  patterns.forEach((pattern) => {
    if (pattern.test(title)) candidates.push(title.replace(pattern, "").trim())
  })
  if (/\sat\s/i.test(title)) candidates.push(title.split(/\sat\s/i).slice(1).join(" at ").trim())
  if (/\sin\s/i.test(title)) candidates.push(title.split(/\sin\s/i).slice(1).join(" in ").trim())
  return Array.from(new Set(candidates.filter(Boolean)))
}

function isGenericItineraryVenue(value: string) {
  const normalized = normalizeLookupText(value)
  return [
    "nearby bistro",
    "nearby cafe",
    "nearby restaurant",
    "market restaurant",
    "local restaurant",
    "local cafe",
    "restaurant",
    "cafe",
    "bistro",
  ].includes(normalized)
}

function categoryForEventType(type: string) {
  return type === "food" ? "restaurants" : "attractions"
}

function coordinatesClose(
  a: { lat: number; lng: number } | undefined,
  b: { lat: number; lng: number } | undefined,
  tolerance = 0.03
) {
  if (!a || !b) return true
  return Math.abs(a.lat - b.lat) <= tolerance && Math.abs(a.lng - b.lng) <= tolerance
}

function tripadvisorCategory(place: PlaceResult | null, hotelName: string | null) {
  if (hotelName) return "hotels"
  const normalized = normalizeLookupText(place?.category ?? "")
  return normalized.includes("restaurant") || normalized.includes("food") || normalized.includes("bar") || normalized.includes("cafe")
    ? "restaurants"
    : "attractions"
}

export function PlaceDetailDrawer() {
  const { sendMessage } = useSSE()
  const {
    selectedPlaceDetail: place, setSelectedPlaceDetail,
    selectedHotelDetail: hotel, setSelectedHotelDetail,
    selectedItineraryEventDetail: eventDetail, setSelectedItineraryEventDetail,
    setSelectedItineraryEventKey,
    selectedItineraryEventKey,
    itinerary,
    places,
    hotels,
    setSelectedItineraryDay,
    selectedHotel, setSelectedHotel,
    pinnedPlaceIds, togglePin, setTargetLocation,
  } = useTripStore()
  const [activeTab, setActiveTab] = useState<"overview" | "traveler" | "reviews" | "location" | "ask">("overview")
  const [drawerScrollTop, setDrawerScrollTop] = useState(0)

  const isOpen = place !== null || hotel !== null || eventDetail !== null
  const isPinned = place ? pinnedPlaceIds.has(place.name) : false
  const isHotelSelected = hotel ? selectedHotel?.name === hotel.name : false

  const heroLabel = place?.category ?? (hotel ? "Hotel" : eventDetail?.type ?? null)
  const name = place?.name ?? hotel?.name ?? eventDetail?.title ?? ""
  const [tripadvisor, setTripadvisor] = useState<TripadvisorEnrichment | null>(null)
  const [tripadvisorLoading, setTripadvisorLoading] = useState(false)
  const [eventLookupLoading, setEventLookupLoading] = useState(false)
  const galleryUrls = useMemo(
    () =>
      uniqueUrls([
        ...(place?.photo_urls ?? []),
        place?.photo_url ?? null,
        hotel?.photo_url ?? null,
      ]),
    [place, hotel]
  )
  const detailSummary =
    place?.summary ??
    (tripadvisor?.matched && tripadvisor.details?.description ? tripadvisor.details.description : null) ??
    eventDetail?.subtitle ??
    null
  const primaryReviewCount =
    tripadvisor?.details?.num_reviews != null
      ? Number(tripadvisor.details.num_reviews)
      : place?.reviews?.length ?? null
  const statusLabel = place?.open_now != null
    ? { text: place.open_now ? "● Open now" : "● Closed", color: place.open_now ? "#22c55e" : "#f87171" }
    : null
  const centerCoordinates =
    place?.lat != null && place?.lng != null
      ? { lat: place.lat, lng: place.lng }
      : hotel?.lat != null && hotel?.lng != null
        ? { lat: hotel.lat, lng: hotel.lng }
        : eventDetail?.coordinates ?? null

  const tripadvisorTarget = useMemo(() => {
    if (place?.lat && place?.lng) {
      return {
        key: `place|${place.name}|${place.lat}|${place.lng}|${tripadvisorCategory(place, null)}`,
        q: asciiFold(place.name),
        lat: place.lat,
        lng: place.lng,
        category: tripadvisorCategory(place, null),
      }
    }
    if (hotel?.lat && hotel?.lng) {
      return {
        key: `hotel|${hotel.name}|${hotel.lat}|${hotel.lng}|hotels`,
        q: asciiFold(hotel.name),
        lat: hotel.lat,
        lng: hotel.lng,
        category: "hotels",
      }
    }
    return null
  }, [place, hotel])

  const topTripadvisorSubratings = useMemo(() => {
    const subratings = tripadvisor?.details?.subratings ?? []
    return [...subratings]
      .map((item) => ({
        localized_name: item.localized_name ?? "Rating",
        value: Number(item.value ?? 0),
      }))
      .filter((item) => Number.isFinite(item.value) && item.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 4)
  }, [tripadvisor])

  const itineraryEntries = useMemo(() => {
    if (!itinerary) return []
    return itinerary.days.flatMap((day) =>
      day.events.map((event, index) => ({
        key: `${day.day_number}-${event.time}-${event.title}-${index}`,
        day,
        event,
      }))
    )
  }, [itinerary])

  const selectedEntryIndex = useMemo(
    () => itineraryEntries.findIndex((entry) => entry.key === selectedItineraryEventKey),
    [itineraryEntries, selectedItineraryEventKey]
  )

  const selectedEntry = selectedEntryIndex >= 0 ? itineraryEntries[selectedEntryIndex] : null
  const previousEntry = selectedEntryIndex > 0 ? itineraryEntries[selectedEntryIndex - 1] : null
  const nextEntry = selectedEntryIndex >= 0 && selectedEntryIndex < itineraryEntries.length - 1
    ? itineraryEntries[selectedEntryIndex + 1]
    : null
  const hasTravelerSection = Boolean((place || hotel) && (tripadvisorLoading || tripadvisor?.matched))
  const hasReviewSection = Boolean(
    (tripadvisor?.matched && tripadvisor.details?.reviews && tripadvisor.details.reviews.length > 0) ||
    (place?.reviews && place.reviews.length > 0)
  )
  const hasLocationSection = Boolean(place?.address || hotel?.address || tripadvisor?.details?.address_string || eventDetail?.city || centerCoordinates)
  const heroCollapseProgress = Math.min(drawerScrollTop / 220, 1)
  const heroHeight = Math.round(348 - (348 - 168) * heroCollapseProgress)
  const entityKind = hotel ? "hotel" : place?.category?.toLowerCase().includes("restaurant") ? "restaurant" : "place"
  const askPrompts = useMemo(() => {
    const city = eventDetail?.city ?? hotel?.city ?? "this area"
    if (hotel) {
      return [
        `Is ${name} in a good area to stay in ${city}?`,
        `What are the pros and cons of staying at ${name}?`,
        `What should I do near ${name} on my first evening?`,
        `Compare ${name} with the best nearby hotel alternative.`,
      ]
    }
    if (entityKind === "restaurant") {
      return [
        `What should I order at ${name}?`,
        `Is ${name} worth prioritising over nearby food spots?`,
        `What pairs well with ${name} nearby?`,
        `What's the best time to go to ${name} to avoid crowds?`,
      ]
    }
    return [
      `What's the best time to visit ${name}?`,
      `How long should I spend at ${name}?`,
      `What pairs best with ${name} nearby?`,
      `Is ${name} one of the essential stops in ${city}?`,
    ]
  }, [entityKind, eventDetail?.city, hotel, hotel?.city, name])

  useEffect(() => {
    setActiveTab("overview")
  }, [name, place?.name, hotel?.name, eventDetail?.title])

  useEffect(() => {
    setDrawerScrollTop(0)
  }, [name, place?.name, hotel?.name, eventDetail?.title, isOpen])

  function scrollToDrawerSection(id: string) {
    if (typeof document === "undefined") return
    const el = document.getElementById(id)
    if (!el) return
    el.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  function openItineraryEntry(entry: (typeof itineraryEntries)[number]) {
    setSelectedItineraryDay(entry.day.day_number)
    setSelectedItineraryEventKey(entry.key)

    const resolved = resolveItineraryEventEntity({
      event: entry.event,
      dayLabel: entry.day.label,
      city: entry.day.city,
      date: entry.day.date,
      places,
      hotels,
    })

    if (resolved.place) {
      setSelectedPlaceDetail(resolved.place)
      if (resolved.place.lat && resolved.place.lng) {
        setTargetLocation({ lat: resolved.place.lat, lng: resolved.place.lng })
      }
      return
    }

    if (resolved.hotel) {
      setSelectedHotelDetail(resolved.hotel)
      if (resolved.hotel.lat && resolved.hotel.lng) {
        setTargetLocation({ lat: resolved.hotel.lat, lng: resolved.hotel.lng })
      }
      return
    }

    setSelectedItineraryEventDetail(resolved.fallback)
    if (resolved.fallback.coordinates) {
      setTargetLocation(resolved.fallback.coordinates)
    }
  }

  function close() {
    setSelectedPlaceDetail(null)
    setSelectedHotelDetail(null)
    setSelectedItineraryEventDetail(null)
    setSelectedItineraryEventKey(null)
  }

  useEffect(() => {
    let cancelled = false
    async function loadTripadvisor() {
      if (!tripadvisorTarget) {
        setTripadvisor(null)
        return
      }

      const cached = tripadvisorCache.get(tripadvisorTarget.key)
      if (cached !== undefined) {
        setTripadvisor(cached)
        setTripadvisorLoading(false)
        return
      }

      setTripadvisorLoading(true)
      try {
        const params = new URLSearchParams({
          lat: String(tripadvisorTarget.lat),
          lng: String(tripadvisorTarget.lng),
          q: tripadvisorTarget.q,
          category: tripadvisorTarget.category,
        })
        const response = await fetch(`${API_URL}/api/tripadvisor/enrich?${params.toString()}`)
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const data = (await response.json()) as TripadvisorEnrichment | { error?: string }
        if (!cancelled) {
          const normalized = "matched" in data ? data : null
          tripadvisorCache.set(tripadvisorTarget.key, normalized)
          setTripadvisor(normalized)
        }
      } catch {
        if (!cancelled) {
          tripadvisorCache.set(tripadvisorTarget.key, null)
          setTripadvisor(null)
        }
      } finally {
        if (!cancelled) setTripadvisorLoading(false)
      }
    }

    if (tripadvisorTarget) {
      void loadTripadvisor()
    } else {
      setTripadvisor(null)
      setTripadvisorLoading(false)
    }

    return () => {
      cancelled = true
    }
  }, [tripadvisorTarget])

  useEffect(() => {
    let cancelled = false

    async function upgradeEventToPlace() {
      if (!eventDetail || place || hotel || !eventDetail.city) {
        setEventLookupLoading(false)
        return
      }

      const candidates = buildLookupCandidates(eventDetail.title).filter((candidate) => !isGenericItineraryVenue(candidate))
      if (!candidates.length) {
        setEventLookupLoading(false)
        return
      }

      setEventLookupLoading(true)
      try {
        for (const candidate of candidates.slice(0, 2)) {
          const params = new URLSearchParams({
            q: candidate,
            city: eventDetail.city,
            category: categoryForEventType(eventDetail.type),
            max_results: "3",
          })
          const response = await fetch(`${API_URL}/api/place-lookup?${params.toString()}`)
          if (!response.ok) continue
          const results = (await response.json()) as Array<PlaceLookupResult | { error?: string }>
          const best = results.find(
            (result): result is PlaceLookupResult =>
              "name" in result &&
              (result.match_score ?? 0) >= 0.78 &&
              coordinatesClose(eventDetail.coordinates, result.lat != null && result.lng != null ? { lat: result.lat, lng: result.lng } : undefined)
          )
          if (best && !cancelled) {
            setSelectedPlaceDetail(best)
            if (best.lat && best.lng) {
              setTargetLocation({ lat: best.lat, lng: best.lng })
            }
            return
          }
        }
      } catch {
        // Keep the fallback itinerary drawer when exact lookup fails.
      } finally {
        if (!cancelled) setEventLookupLoading(false)
      }
    }

    void upgradeEventToPlace()
    return () => {
      cancelled = true
    }
  }, [eventDetail, place, hotel, setSelectedPlaceDetail, setTargetLocation])

  return (
    <>
      {/* Subtle map dim when drawer is open */}
      <div
        className="absolute inset-0 z-[1900]"
        style={{
          background: "rgba(0,0,0,0.35)",
          opacity: isOpen ? 1 : 0,
          pointerEvents: isOpen ? "auto" : "none",
          transition: "opacity 0.3s ease",
        }}
        onClick={close}
      />

      <div
        className="absolute top-0 right-0 h-full w-full z-[2000]"
        style={{
          transform: isOpen ? "translateX(0)" : "translateX(105%)",
          transition: "transform 0.35s cubic-bezier(0.32, 0.72, 0, 1)",
          pointerEvents: isOpen ? "auto" : "none",
          willChange: "transform",
        }}
      >
        <div
          className="h-full flex flex-col"
          style={{
            background: "var(--surface)",
            borderLeft: "1px solid var(--border)",
            boxShadow: "-4px 0 32px rgba(0,0,0,0.5)",
          }}
        >
          {/* ── Hero gallery ── */}
          <div
            className="relative flex-shrink-0 overflow-hidden"
            style={{
              height: `${heroHeight}px`,
              transition: drawerScrollTop === 0 ? "height 0.22s ease" : "none",
            }}
          >
            <MediaGallery
              urls={galleryUrls}
              alt={name}
              badgeLabel={heroLabel}
              statusLabel={statusLabel}
            />

            <button
              onClick={close}
              className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center cursor-pointer transition-opacity hover:opacity-80"
              style={{ background: "rgba(0,0,0,0.58)", color: "white", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.1)" }}
            >
              <X size={14} />
            </button>
          </div>

        {/* ── Scrollable body ── */}
        <div
          className="flex-1 overflow-y-auto px-4 py-4 space-y-4"
          style={{ scrollbarWidth: "thin" }}
          onScroll={(e) => setDrawerScrollTop(e.currentTarget.scrollTop)}
        >

          <div
            className="rounded-[26px] px-5 py-4"
            style={{
              background: "linear-gradient(135deg, rgba(255,255,255,0.03), rgba(61,140,214,0.05))",
              border: "1px solid rgba(255,255,255,0.06)",
              boxShadow: "0 16px 34px rgba(0,0,0,0.22)",
            }}
          >
            <div className="flex flex-wrap items-center gap-2 mb-3">
              {place && (
                <span className="px-2.5 py-1 rounded-full text-[11px] font-medium" style={{ background: "rgba(255,255,255,0.04)", color: "var(--text-muted)", border: "1px solid var(--border)" }}>
                  Google Places
                </span>
              )}
              {hotel && (
                <span className="px-2.5 py-1 rounded-full text-[11px] font-medium" style={{ background: "rgba(255,255,255,0.04)", color: "var(--text-muted)", border: "1px solid var(--border)" }}>
                  Booking.com
                </span>
              )}
              {(tripadvisorLoading || tripadvisor?.matched) && (
                <span className="px-2.5 py-1 rounded-full text-[11px] font-medium" style={{ background: "rgba(245,158,11,0.12)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.24)" }}>
                  Tripadvisor
                </span>
              )}
              {selectedEntry && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium" style={{ background: "rgba(61,140,214,0.12)", color: "var(--accent-light)", border: "1px solid rgba(61,140,214,0.24)" }}>
                  <Sparkles size={11} />
                  Planned stop
                </span>
              )}
            </div>

            <h2 className="text-[38px] font-semibold leading-[0.98] tracking-[-0.04em] mb-2" style={{ color: "var(--text)" }}>
              {name}
            </h2>

            {detailSummary ? (
              <p className="mb-4 max-w-[52ch] text-[16px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
                {detailSummary}
              </p>
            ) : null}

            {(place?.address || hotel?.address || tripadvisor?.details?.address_string || eventDetail?.city) && (
              <div className="flex items-start gap-2 mb-3">
                <MapPin size={13} className="flex-shrink-0 mt-0.5" style={{ color: "var(--text-muted)" }} />
                <p className="text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
                  {place?.address ?? hotel?.address ?? tripadvisor?.details?.address_string ?? eventDetail?.city}
                </p>
              </div>
            )}

            {place?.rating != null && (
              <div className="flex flex-wrap items-center gap-2.5 mb-3">
                <RatingStars rating={place.rating} size={16} />
                <span className="text-base font-semibold" style={{ color: "var(--text)" }}>{place.rating}</span>
                <span className="text-sm" style={{ color: "var(--text-muted)" }}>/ 5.0</span>
                {primaryReviewCount ? (
                  <span className="text-sm" style={{ color: "var(--text-muted)" }}>
                    · {primaryReviewCount.toLocaleString()} reviews
                  </span>
                ) : null}
              </div>
            )}

            {hotel && (
              <div className="mb-3 space-y-1.5">
                {hotel.stars > 0 && (
                  <div className="flex gap-0.5">
                    {Array.from({ length: hotel.stars }).map((_, i) => (
                      <Star key={i} size={13} fill="#f59e0b" color="#f59e0b" />
                    ))}
                    {Array.from({ length: 5 - hotel.stars }).map((_, i) => (
                      <Star key={i} size={13} fill="transparent" color="#6b7394" />
                    ))}
                  </div>
                )}
                {hotel.review_score != null && (
                  <div className="flex items-center gap-2">
                    <span
                      className="px-2 py-0.5 rounded text-xs font-bold"
                      style={{ background: "var(--accent)", color: "white" }}
                    >
                      {hotel.review_score}
                    </span>
                    {hotel.review_word && (
                      <span className="text-sm font-semibold" style={{ color: "var(--text)" }}>{hotel.review_word}</span>
                    )}
                    {primaryReviewCount ? (
                      <span className="text-sm" style={{ color: "var(--text-muted)" }}>
                        · {primaryReviewCount.toLocaleString()} reviews
                      </span>
                    ) : null}
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-2.5">
              {place ? (
                <>
                  <MetricCard label="Category" value={place.category} tone="accent" />
                  <MetricCard
                    label="Status"
                    value={place.open_now == null ? "Check hours" : place.open_now ? "Open now" : "Closed"}
                    tone={place.open_now ? "success" : "default"}
                  />
                  {place.price_level ? <MetricCard label="Price level" value={place.price_level} /> : null}
                  {tripadvisor?.details?.ranking_string ? <MetricCard label="Traveler rank" value={tripadvisor.details.ranking_string} tone="warm" /> : null}
                </>
              ) : hotel ? (
                <>
                  <MetricCard
                    label="Per night"
                    value={`${currencySymbol(hotel.currency)}${hotel.price_per_night_gbp}`}
                    tone="accent"
                  />
                  <MetricCard
                    label="Total stay"
                    value={`${currencySymbol(hotel.currency)}${hotel.total_price_gbp}`}
                  />
                  {tripadvisor?.details?.ranking_string ? <MetricCard label="Traveler rank" value={tripadvisor.details.ranking_string} tone="warm" /> : null}
                  {tripadvisor?.details?.photo_count != null ? <MetricCard label="Traveler photos" value={tripadvisor.details.photo_count} /> : null}
                </>
              ) : eventDetail ? (
                <>
                  <MetricCard label="Timing" value={`${eventDetail.time}${eventDetail.date ? ` · ${eventDetail.date}` : ""}`} tone="accent" />
                  {eventDetail.day_label ? <MetricCard label="Day" value={eventDetail.day_label} /> : null}
                </>
              ) : null}
            </div>

            <div className="mt-5 border-t pt-3" style={{ borderColor: "var(--border-subtle)" }}>
              <div className="flex flex-wrap items-center gap-5">
                <DrawerTab label="Overview" active={activeTab === "overview"} onClick={() => setActiveTab("overview")} />
                {hasTravelerSection ? (
                  <DrawerTab label="Traveler Signal" active={activeTab === "traveler"} onClick={() => setActiveTab("traveler")} />
                ) : null}
                {hasReviewSection ? (
                  <DrawerTab label="Reviews" active={activeTab === "reviews"} onClick={() => setActiveTab("reviews")} />
                ) : null}
                {hasLocationSection ? (
                  <DrawerTab label="Location" active={activeTab === "location"} onClick={() => setActiveTab("location")} />
                ) : null}
                <DrawerTab label="Ask" active={activeTab === "ask"} onClick={() => setActiveTab("ask")} />
              </div>
            </div>
          </div>

          {selectedEntry && (
            <DetailSection eyebrow="Planned Stop" title={selectedEntry.day.label}>
              <p className="text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
                {selectedEntry.event.time} · {selectedEntry.day.city} · {selectedEntry.day.date}
              </p>
            </DetailSection>
          )}

          {activeTab === "traveler" && (place || hotel) && (tripadvisorLoading || tripadvisor?.matched) && (
            <DetailSection id="drawer-section-traveler" eyebrow="Traveler Signal" title="What Tripadvisor adds here">
              <div className="flex items-center justify-between gap-2 mb-2">
                {tripadvisor?.match_score != null && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: "rgba(255,255,255,0.06)", color: "var(--text-muted)" }}>
                    {Math.round(tripadvisor.match_score * 100)}% match
                  </span>
                )}
              </div>

              {tripadvisorLoading ? (
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>Loading Tripadvisor details…</p>
              ) : tripadvisor?.details ? (
                <div className="space-y-2.5">
                  <div className="flex flex-wrap gap-2">
                    {tripadvisor.details.rating != null && (
                      <span className="px-2 py-1 rounded-full text-xs font-semibold" style={{ background: "rgba(245,158,11,0.14)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.25)" }}>
                        ★ {tripadvisor.details.rating}
                      </span>
                    )}
                    {tripadvisor.details.num_reviews != null && (
                      <span className="px-2 py-1 rounded-full text-xs" style={{ background: "var(--surface-2)", color: "var(--text-muted)", border: "1px solid var(--border)" }}>
                        {tripadvisor.details.num_reviews} Tripadvisor reviews
                      </span>
                    )}
                    {tripadvisor.details.price_level && (
                      <span className="px-2 py-1 rounded-full text-xs" style={{ background: "var(--surface-2)", color: "var(--text-muted)", border: "1px solid var(--border)" }}>
                        {tripadvisor.details.price_level}
                      </span>
                    )}
                  </div>

                  {tripadvisor.details.ranking_string && (
                    <p className="text-sm font-semibold" style={{ color: "var(--text)" }}>
                      {tripadvisor.details.ranking_string}
                    </p>
                  )}

                  {hotel && topTripadvisorSubratings.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {topTripadvisorSubratings.map((subrating) => (
                        <span
                          key={subrating.localized_name}
                          className="px-2 py-1 rounded-full text-xs"
                          style={{ background: "rgba(61,140,214,0.10)", color: "var(--accent-light)", border: "1px solid rgba(61,140,214,0.22)" }}
                        >
                          {subrating.localized_name} {subrating.value.toFixed(1)}
                        </span>
                      ))}
                    </div>
                  )}

                  {tripadvisor.details.awards && tripadvisor.details.awards.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {tripadvisor.details.awards.slice(0, 2).map((award, index) => (
                        <span
                          key={`${award.display_name ?? "award"}-${index}`}
                          className="px-2 py-0.5 rounded-full text-xs"
                          style={{ background: "rgba(34,197,94,0.10)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.2)" }}
                        >
                          {award.display_name}{award.year ? ` ${award.year}` : ""}
                        </span>
                      ))}
                    </div>
                  )}

                  {hotel && (tripadvisor.details.photo_count || tripadvisor.details.see_all_photos) && (
                    <div className="flex flex-wrap items-center gap-3 text-xs" style={{ color: "var(--text-muted)" }}>
                      {tripadvisor.details.photo_count != null && (
                        <span>Traveler photos: {tripadvisor.details.photo_count}</span>
                      )}
                      {tripadvisor.details.see_all_photos && (
                        <a
                          href={tripadvisor.details.see_all_photos}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 font-semibold"
                          style={{ color: "#f59e0b" }}
                        >
                          See all photos <ArrowRight size={12} />
                        </a>
                      )}
                    </div>
                  )}

                  {tripadvisor.details.web_url && (
                    <a
                      href={tripadvisor.details.web_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-semibold"
                      style={{ color: "#f59e0b" }}
                    >
                      Open on Tripadvisor <ArrowRight size={12} />
                    </a>
                  )}
                </div>
              ) : null}
            </DetailSection>
          )}

          {activeTab === "overview" && detailSummary && (
            <DetailSection id="drawer-section-overview" eyebrow="Overview" title="Why this place is worth opening">
              <p className="text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
                {detailSummary}
              </p>
            </DetailSection>
          )}

          {activeTab === "overview" && eventDetail && !place && !hotel && (
            <DetailSection eyebrow="Fallback Detail" title="Itinerary stop">
              <div className="space-y-3">
                {eventLookupLoading && (
                  <p className="text-xs" style={{ color: "var(--accent-light)" }}>
                    Looking up live place details…
                  </p>
                )}
                <div className="flex items-start gap-2">
                  <Clock3 size={12} className="flex-shrink-0 mt-0.5" style={{ color: "var(--text-muted)" }} />
                  <p className="text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
                    {eventDetail.time}
                    {eventDetail.date ? ` · ${eventDetail.date}` : ""}
                    {eventDetail.city ? ` · ${eventDetail.city}` : ""}
                  </p>
                </div>
                {eventDetail.subtitle && (
                  <p className="text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
                    {eventDetail.subtitle}
                  </p>
                )}
                {eventDetail.price_local && (
                  <p className="text-sm font-semibold" style={{ color: "var(--text)" }}>
                    {eventDetail.price_local}
                  </p>
                )}
              </div>
            </DetailSection>
          )}

          {activeTab === "location" && hasLocationSection && (
            <DetailSection id="drawer-section-location" eyebrow="Location" title="Where it sits in the city">
              <div className="space-y-3">
                <p className="text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
                  {place?.address ?? hotel?.address ?? tripadvisor?.details?.address_string ?? eventDetail?.city}
                </p>
                <div className="flex flex-wrap gap-2">
                  {centerCoordinates ? (
                    <button
                      onClick={() => setTargetLocation(centerCoordinates)}
                      className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold cursor-pointer"
                      style={{
                        background: "rgba(61,140,214,0.14)",
                        color: "var(--accent-light)",
                        border: "1px solid rgba(61,140,214,0.3)",
                      }}
                    >
                      Center on map
                    </button>
                  ) : null}
                  {tripadvisor?.matched && tripadvisor.details?.web_url ? (
                    <a
                      href={tripadvisor.details.web_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold"
                      style={{
                        background: "rgba(245,158,11,0.10)",
                        color: "#f59e0b",
                        border: "1px solid rgba(245,158,11,0.22)",
                      }}
                    >
                      Open on Tripadvisor <ArrowRight size={12} />
                    </a>
                  ) : null}
                </div>
              </div>
            </DetailSection>
          )}

          {activeTab === "overview" && tripadvisor?.matched && tripadvisor.details?.trip_types && tripadvisor.details.trip_types.length > 0 && (
            <DetailSection eyebrow="Best For" title="Traveler fit">
              <div className="flex flex-wrap gap-1.5">
              {tripadvisor.details.trip_types
                .filter((tripType) => Number(tripType.value ?? "0") > 0)
                .slice(0, 4)
                .map((tripType, index) => (
                  <span
                    key={`${tripType.localized_name ?? "trip-type"}-${index}`}
                    className="px-2 py-0.5 rounded-full text-xs"
                    style={{ background: "var(--surface-2)", color: "var(--text-muted)", border: "1px solid var(--border)" }}
                  >
                    Tripadvisor: {tripType.localized_name}
                  </span>
                ))}
              </div>
            </DetailSection>
          )}

          {activeTab === "reviews" && tripadvisor?.matched && tripadvisor.details?.reviews && tripadvisor.details.reviews.length > 0 && (
            <DetailSection id="drawer-section-reviews" eyebrow="Reviews" title="Tripadvisor reactions">
              <div className="flex items-center gap-2 mb-3 pb-2" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#f59e0b" }}>Tripadvisor Reviews</p>
                <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: "var(--surface-3)", color: "var(--text-muted)" }}>
                  {tripadvisor.details.reviews.length}
                </span>
              </div>
              <div className="space-y-2">
                {tripadvisor.details.reviews.slice(0, 2).map((review, index) => (
                  <div
                    key={review.id ?? `${review.user?.username ?? "review"}-${index}`}
                    className="rounded-xl p-3"
                    style={{ background: "var(--surface-3)", border: "1px solid var(--border-subtle)" }}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <p className="text-xs font-semibold" style={{ color: "var(--text)" }}>
                        {review.user?.username ?? "Tripadvisor reviewer"}
                      </p>
                      {review.rating != null && (
                        <span className="text-xs font-semibold" style={{ color: "#f59e0b" }}>
                          ★ {review.rating}
                        </span>
                      )}
                    </div>
                    {review.title && (
                      <p className="text-xs font-semibold mb-1" style={{ color: "var(--text)" }}>
                        {review.title}
                      </p>
                    )}
                    {review.text && (
                      <p className="text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
                        {review.text}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </DetailSection>
          )}

          {/* Reviews (places only) */}
          {activeTab === "reviews" && place?.reviews && place.reviews.length > 0 && (
            <DetailSection id={tripadvisor?.matched && tripadvisor.details?.reviews?.length ? undefined : "drawer-section-reviews"} eyebrow="Reviews" title="Google reviews">
              <div className="flex items-center gap-2 mb-3 pb-2" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>Google Reviews</p>
                <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: "var(--surface-3)", color: "var(--text-muted)" }}>
                  {place.reviews.length}
                </span>
              </div>
              <div className="space-y-2">
                {place.reviews.map((review, i) => (
                  <ReviewCard key={i} review={review} />
                ))}
              </div>
            </DetailSection>
          )}

          {activeTab === "ask" && (
            <DetailSection eyebrow="Continue" title="Ask something sharper about this place">
              <div className="space-y-2.5">
                {askPrompts.map((prompt) => (
                  <AskPrompt key={prompt} prompt={prompt} onClick={() => sendMessage(prompt)} />
                ))}
              </div>
            </DetailSection>
          )}

        </div>

        {/* ── Sticky action buttons ── */}
        <div className="px-4 pb-5 pt-3 flex-shrink-0 space-y-2" style={{ borderTop: "1px solid var(--border)" }}>
          {selectedEntry && (
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => previousEntry && openItineraryEntry(previousEntry)}
                disabled={!previousEntry}
                className="py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer disabled:opacity-35 disabled:cursor-default"
                style={{ background: "var(--surface-2)", color: "var(--text)", border: "1px solid var(--border)" }}
              >
                Previous Stop
              </button>
              <button
                onClick={() => nextEntry && openItineraryEntry(nextEntry)}
                disabled={!nextEntry}
                className="py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer disabled:opacity-35 disabled:cursor-default"
                style={{ background: "var(--surface-2)", color: "var(--text)", border: "1px solid var(--border)" }}
              >
                Next Stop
              </button>
            </div>
          )}

          {hotel ? (
            <>
              <button
                onClick={() => setSelectedHotel(isHotelSelected ? null : hotel)}
                className="w-full py-3 rounded-xl text-sm font-semibold transition-all cursor-pointer"
                style={{
                  background: isHotelSelected ? "var(--accent)" : "rgba(61,140,214,0.14)",
                  color: isHotelSelected ? "white" : "var(--accent-light)",
                  border: `1px solid ${isHotelSelected ? "var(--accent)" : "rgba(61,140,214,0.3)"}`,
                  boxShadow: isHotelSelected ? "0 4px 16px rgba(24,95,165,0.4)" : "none",
                }}
              >
                {isHotelSelected ? "✓ Selected" : "Select Hotel"}
              </button>
              <a
                href={hotel.booking_url}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-1.5 transition-all"
                style={{ background: "var(--surface-2)", color: "var(--text-muted)", border: "1px solid var(--border)" }}
              >
                Book on Booking.com <ArrowRight size={13} />
              </a>
              {tripadvisor?.matched && tripadvisor.details?.hotel_booking?.bookable && tripadvisor.details.hotel_booking.booking_url && (
                <a
                  href={tripadvisor.details.hotel_booking.booking_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-1.5 transition-all"
                  style={{ background: "var(--surface-2)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.22)" }}
                >
                  Book on Tripadvisor <ArrowRight size={13} />
                </a>
              )}
              {tripadvisor?.matched && tripadvisor.details?.web_url && (
                <a
                  href={tripadvisor.details.web_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-1.5 transition-all"
                  style={{ background: "var(--surface-2)", color: "var(--text-muted)", border: "1px solid var(--border)" }}
                >
                  Open on Tripadvisor <ArrowRight size={13} />
                </a>
              )}
            </>
          ) : eventDetail ? (
            centerCoordinates ? (
              <button
                onClick={() => setTargetLocation(centerCoordinates)}
                className="w-full py-3 rounded-xl text-sm font-semibold transition-all cursor-pointer"
                style={{
                  background: "rgba(61,140,214,0.14)",
                  color: "var(--accent-light)",
                  border: "1px solid rgba(61,140,214,0.3)",
                }}
              >
                Center on Map
              </button>
            ) : null
          ) : (
            <>
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
              {tripadvisor?.matched && tripadvisor.details?.web_url && (
                <a
                  href={tripadvisor.details.web_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-1.5 transition-all"
                  style={{ background: "var(--surface-2)", color: "var(--text-muted)", border: "1px solid var(--border)" }}
                >
                  Open on Tripadvisor <ArrowRight size={13} />
                </a>
              )}
            </>
          )}
        </div>
      </div>
      </div>
    </>
  )
}
