"use client"

import { X, MapPin, Star, ArrowRight, ChevronLeft, ChevronRight } from "lucide-react"
import { useTripStore } from "@/hooks/useTripStore"
import { PlaceReview } from "@/types"
import { useState, useEffect } from "react"

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
      className="rounded-xl p-3"
      style={{ background: "var(--surface-3)", border: "1px solid var(--border-subtle)" }}
    >
      {/* Author row */}
      <div className="flex items-center gap-2.5 mb-2">
        {review.author_photo ? (
          <img
            src={review.author_photo}
            alt={review.author}
            className="w-7 h-7 rounded-full object-cover flex-shrink-0"
          />
        ) : (
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold"
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

      {/* Review text */}
      <p className="text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
        {review.text}
      </p>
    </div>
  )
}

function PhotoCarousel({ urls, alt }: { urls: string[]; alt: string }) {
  const [idx, setIdx] = useState(0)
  useEffect(() => { setIdx(0) }, [urls])
  if (!urls.length) return (
    <div className="w-full h-full flex items-center justify-center text-5xl" style={{ background: "var(--surface-2)" }}>📍</div>
  )
  return (
    <div className="relative w-full h-full">
      <img src={urls[idx]} alt={alt} className="w-full h-full object-cover" />
      {urls.length > 1 && (
        <>
          <button
            onClick={() => setIdx((i) => (i - 1 + urls.length) % urls.length)}
            className="absolute left-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full flex items-center justify-center cursor-pointer"
            style={{ background: "rgba(0,0,0,0.55)", color: "white", backdropFilter: "blur(4px)" }}
          >
            <ChevronLeft size={13} />
          </button>
          <button
            onClick={() => setIdx((i) => (i + 1) % urls.length)}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full flex items-center justify-center cursor-pointer"
            style={{ background: "rgba(0,0,0,0.55)", color: "white", backdropFilter: "blur(4px)" }}
          >
            <ChevronRight size={13} />
          </button>
          <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex gap-1">
            {urls.map((_, i) => (
              <button
                key={i}
                onClick={() => setIdx(i)}
                className="rounded-full transition-all cursor-pointer"
                style={{
                  width: i === idx ? "16px" : "6px",
                  height: "6px",
                  background: i === idx ? "white" : "rgba(255,255,255,0.45)",
                }}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

export function PlaceDetailDrawer() {
  const {
    selectedPlaceDetail: place, setSelectedPlaceDetail,
    selectedHotelDetail: hotel, setSelectedHotelDetail,
    selectedHotel, setSelectedHotel,
    pinnedPlaceIds, togglePin,
  } = useTripStore()

  const isOpen = place !== null || hotel !== null
  const isPinned = place ? pinnedPlaceIds.has(place.name) : false
  const isHotelSelected = hotel ? selectedHotel?.name === hotel.name : false

  const photoUrl = place?.photo_url ?? hotel?.photo_url ?? null
  const heroLabel = place?.category ?? (hotel ? "Hotel" : null)
  const name = place?.name ?? hotel?.name ?? ""

  function close() {
    setSelectedPlaceDetail(null)
    setSelectedHotelDetail(null)
  }

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
          {place ? (
            <PhotoCarousel urls={place.photo_urls ?? (place.photo_url ? [place.photo_url] : [])} alt={name} />
          ) : photoUrl ? (
            <img src={photoUrl} alt={name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-5xl" style={{ background: "var(--surface-2)" }}>🏨</div>
          )}

          <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.35) 0%, transparent 35%, rgba(0,0,0,0.65) 100%)", pointerEvents: "none" }} />

          <button
            onClick={close}
            className="absolute top-3 right-3 w-7 h-7 rounded-full flex items-center justify-center cursor-pointer transition-opacity hover:opacity-80"
            style={{ background: "rgba(0,0,0,0.55)", color: "white", backdropFilter: "blur(6px)", border: "1px solid rgba(255,255,255,0.1)" }}
          >
            <X size={13} />
          </button>

          {heroLabel && (
            <span className="absolute bottom-3 left-3 px-2 py-1 rounded-full text-xs capitalize" style={{ background: "rgba(0,0,0,0.7)", color: "rgba(255,255,255,0.9)" }}>
              {heroLabel}
            </span>
          )}

          {place?.open_now != null && (
            <span
              className="absolute bottom-3 right-3 px-2 py-1 rounded-full text-xs font-semibold"
              style={{ background: "rgba(0,0,0,0.7)", color: place.open_now ? "#22c55e" : "#f87171" }}
            >
              {place.open_now ? "● Open now" : "● Closed"}
            </span>
          )}
        </div>

        {/* ── Scrollable body ── */}
        <div className="flex-1 overflow-y-auto px-4 py-4" style={{ scrollbarWidth: "thin" }}>

          <h2 className="text-base font-bold leading-snug mb-2" style={{ color: "var(--text)" }}>{name}</h2>

          {/* ── PLACE mode: rating row ── */}
          {place?.rating != null && (
            <div className="flex items-center gap-2 mb-3">
              <RatingStars rating={place.rating} />
              <span className="text-sm font-semibold" style={{ color: "var(--text)" }}>{place.rating}</span>
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>/ 5.0</span>
            </div>
          )}

          {/* ── HOTEL mode: stars + review score row ── */}
          {hotel && (
            <div className="mb-3 space-y-1.5">
              {hotel.stars > 0 && (
                <div className="flex gap-0.5">
                  {Array.from({ length: hotel.stars }).map((_, i) => (
                    <Star key={i} size={12} fill="#f59e0b" color="#f59e0b" />
                  ))}
                  {Array.from({ length: 5 - hotel.stars }).map((_, i) => (
                    <Star key={i} size={12} fill="transparent" color="#6b7394" />
                  ))}
                </div>
              )}
              {hotel.review_score != null && (
                <div className="flex items-center gap-2">
                  <span
                    className="px-1.5 py-0.5 rounded text-xs font-bold"
                    style={{ background: "var(--accent)", color: "white" }}
                  >
                    {hotel.review_score}
                  </span>
                  {hotel.review_word && (
                    <span className="text-sm font-semibold" style={{ color: "var(--text)" }}>{hotel.review_word}</span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── HOTEL mode: price block ── */}
          {hotel && (
            <div
              className="flex items-center justify-between rounded-xl px-3 py-2.5 mb-4"
              style={{ background: "var(--surface-2)", border: "1px solid var(--border-subtle)" }}
            >
              <div>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>Per night</p>
                <p className="text-lg font-bold" style={{ color: "var(--text)" }}>
                  {currencySymbol(hotel.currency)}{hotel.price_per_night_gbp}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>Total stay</p>
                <p className="text-sm font-semibold" style={{ color: "var(--accent-light)" }}>
                  {currencySymbol(hotel.currency)}{hotel.total_price_gbp}
                </p>
              </div>
            </div>
          )}

          {/* ── PLACE mode: pill tags ── */}
          {place && (
            <div className="flex flex-wrap gap-1.5 mb-4">
              {place.category && (
                <span className="px-2 py-0.5 rounded-full text-xs capitalize" style={{ background: "rgba(61,140,214,0.12)", color: "var(--accent-light)", border: "1px solid rgba(61,140,214,0.25)" }}>
                  {place.category}
                </span>
              )}
              {place.price_level && (
                <span className="px-2 py-0.5 rounded-full text-xs" style={{ background: "var(--surface-2)", color: "var(--text-muted)", border: "1px solid var(--border)" }}>
                  {place.price_level}
                </span>
              )}
              {place.open_now != null && (
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
          )}

          {/* Summary */}
          {place?.summary && (
            <p className="text-sm leading-relaxed mb-4" style={{ color: "var(--text-muted)" }}>{place.summary}</p>
          )}

          {/* Address */}
          {(place?.address || hotel?.address) && (
            <div className="flex items-start gap-2 mb-4">
              <MapPin size={12} className="flex-shrink-0 mt-0.5" style={{ color: "var(--text-muted)" }} />
              <p className="text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
                {place?.address ?? hotel?.address}
              </p>
            </div>
          )}

          {/* Reviews (places only) */}
          {place?.reviews && place.reviews.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3 pb-2" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>Reviews</p>
                <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: "var(--surface-3)", color: "var(--text-muted)" }}>
                  {place.reviews.length}
                </span>
              </div>
              <div className="space-y-2">
                {place.reviews.map((review, i) => (
                  <ReviewCard key={i} review={review} />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Sticky action buttons ── */}
        <div className="px-4 pb-5 pt-3 flex-shrink-0 space-y-2" style={{ borderTop: "1px solid var(--border)" }}>
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
            </>
          ) : (
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
          )}
        </div>
      </div>
    </div>
  )
}
