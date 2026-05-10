"use client"

import { useEffect, useState, useRef } from "react"
import { categoryIcon } from "@/lib/placeIcon"
import { classifyPlaceBrowseKind } from "@/lib/placeBrowse"
import { currencySymbol } from "@/lib/currencyUtils"
import type { StoreHoverTarget, StoreHoverState } from "@/hooks/useTripStore"

export type HoverCardTarget = StoreHoverTarget
export type HoverCardState = StoreHoverState

interface Props {
  state: HoverCardState | null
  onMouseEnter: () => void
  onMouseLeave: () => void
  onOpenDetail: () => void
}

const CARD_WIDTH = 320
const CARD_OFFSET = 14
// Minimum gap between card edge and viewport/map boundary
const CARD_PADDING = 8

export function MapHoverCard({ state, onMouseEnter, onMouseLeave, onOpenDetail }: Props) {
  const [imgIndex, setImgIndex] = useState(0)
  const [imgLoaded, setImgLoaded] = useState(false)
  const lastTargetKeyRef = useRef<string | null>(null)

  useEffect(() => {
    if (!state) return
    const key =
      state.target.kind === "place"
        ? state.target.place.name
        : state.target.hotel.name
    if (key !== lastTargetKeyRef.current) {
      lastTargetKeyRef.current = key
      setImgIndex(0)
      setImgLoaded(false)
    }
  }, [state])

  if (!state) return null

  const photos: string[] =
    state.target.kind === "place"
      ? (state.target.place.photo_urls?.length
          ? state.target.place.photo_urls
          : state.target.place.photo_url
            ? [state.target.place.photo_url]
            : [])
      : (state.target.hotel.photo_urls?.length
          ? state.target.hotel.photo_urls
          : state.target.hotel.photo_url
            ? [state.target.hotel.photo_url]
            : [])

  const hasMultiple = photos.length > 1
  const currentPhoto = photos[imgIndex] ?? null

  // Flip the card to the left of the pin when rendering to the right would overflow
  // the viewport. The card uses position:fixed so we compare against window.innerWidth.
  const naturalLeft = state.x + CARD_OFFSET
  const wouldOverflowRight = naturalLeft + CARD_WIDTH > window.innerWidth - CARD_PADDING
  const left = wouldOverflowRight
    ? Math.max(CARD_PADDING, state.x - CARD_OFFSET - CARD_WIDTH)
    : naturalLeft
  const top = state.y - 130

  const place = state.target.kind === "place" ? state.target.place : null
  const hotel = state.target.kind === "hotel" ? state.target.hotel : null

  const titleText = place?.name ?? hotel?.name ?? ""
  const ratingValue = place?.rating ?? hotel?.review_score
  const ratingText = ratingValue != null ? ratingValue.toFixed(1) : ""
  const reviewCount: number | null = null
  const priceText = place?.price_level
    ? place.price_level
    : hotel
      ? `${currencySymbol(hotel.currency)}${hotel.price_per_night_gbp}/night`
      : ""

  const tagText = place
    ? (() => {
        const kind = classifyPlaceBrowseKind(place)
        return kind === "restaurants" ? "Food" : kind === "icons" ? "Iconic" : "Sight"
      })()
    : "Hotel"
  const tagGlyph = place ? categoryIcon(place.category) : "🏨"

  const openText =
    place?.open_now === true ? "Open" :
    place?.open_now === false ? "Closed" : ""

  const description =
    place?.address ??
    (hotel ? `${hotel.stars > 0 ? "★".repeat(hotel.stars) + " · " : ""}${currencySymbol(hotel.currency)}${hotel.price_per_night_gbp}/night` : "")

  return (
    <div
      className="vp-card"
      data-testid="place-popup"
      style={{
        position: "fixed",
        left: `${left}px`,
        top: `${top}px`,
        width: `${CARD_WIDTH}px`,
        zIndex: 1100,
        pointerEvents: "auto",
      }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest(".vp-card__navbtn")) return
        onOpenDetail()
      }}
      role="button"
      tabIndex={0}
    >
      <div className="vp-card__media">
        {currentPhoto ? (
          <>
            {!imgLoaded && <div className="vp-card__skeleton" />}
            <img
              key={currentPhoto}
              src={currentPhoto}
              alt=""
              className="vp-card__img"
              style={{ opacity: imgLoaded ? 1 : 0 }}
              onLoad={() => setImgLoaded(true)}
            />
            {hasMultiple && (
              <>
                <button
                  type="button"
                  className="vp-card__navbtn vp-card__navbtn--prev"
                  onClick={(e) => {
                    e.stopPropagation()
                    setImgLoaded(false)
                    setImgIndex((i) => (i - 1 + photos.length) % photos.length)
                  }}
                  aria-label="Previous photo"
                >
                  ‹
                </button>
                <button
                  type="button"
                  className="vp-card__navbtn vp-card__navbtn--next"
                  onClick={(e) => {
                    e.stopPropagation()
                    setImgLoaded(false)
                    setImgIndex((i) => (i + 1) % photos.length)
                  }}
                  aria-label="Next photo"
                >
                  ›
                </button>
                <div className="vp-card__dots">
                  {photos.map((_, i) => (
                    <span
                      key={i}
                      className={`vp-card__dot${i === imgIndex ? " is-active" : ""}`}
                    />
                  ))}
                </div>
              </>
            )}
          </>
        ) : (
          <div className="vp-card__photo-empty">{tagGlyph}</div>
        )}

        <span className="vp-card__tag">
          <span style={{ marginRight: 4 }}>{tagGlyph}</span>
          {tagText}
        </span>

        {ratingText && (
          <span className="vp-card__rating">
            <span className="vp-card__star">★</span>
            {ratingText}
            {reviewCount ? <span className="vp-card__reviews"> ({formatCount(reviewCount)})</span> : null}
          </span>
        )}

        {openText && (
          <span className={`vp-card__status vp-card__status--${place?.open_now ? "open" : "closed"}`}>
            {openText}
          </span>
        )}
      </div>

      <div className="vp-card__body">
        <div className="vp-card__title">{titleText}</div>
        {priceText && <div className="vp-card__price">{priceText}</div>}
        {description && <div className="vp-card__desc">{description}</div>}
        <div className="vp-card__footer">
          <span className="vp-card__footer-label">Open detail</span>
          <span className="vp-card__footer-arrow" aria-hidden>→</span>
        </div>
      </div>
    </div>
  )
}

function formatCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k`
  return String(n)
}
