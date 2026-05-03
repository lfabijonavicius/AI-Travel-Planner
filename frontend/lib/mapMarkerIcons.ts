import { categoryIconSvg } from "@/lib/placeIcon"
import { currencySymbol } from "@/lib/currencyUtils"
import { PlaceResult } from "@/types"

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

export function buildHotelIcon(
  L: any,
  hotel: { name: string; price_per_night_gbp: number; currency: string },
  isSelected: boolean
) {
  const sym = currencySymbol(hotel.currency)
  const priceLabel = `${sym}${hotel.price_per_night_gbp}`
  const truncatedName = hotel.name.length > 22 ? hotel.name.slice(0, 20) + "…" : hotel.name

  return L.divIcon({
    className: "",
    html: `
      <div class="vp-wrap vp-hotel${isSelected ? " is-selected" : ""}">
        <div class="vp-pin vp-pin--hotel">
          <span class="vp-icon">${categoryIconSvg("hotel")}</span>
        </div>
        <div class="vp-label vp-label--price">${escapeHtml(priceLabel)}</div>
        ${isSelected ? `<div class="vp-label vp-label--name">${escapeHtml(truncatedName)}</div>` : ""}
      </div>
    `,
    iconSize: [220, isSelected ? 60 : 36],
    iconAnchor: [16, 16],
  })
}

export function buildInfoHeroPlaceIcon(L: any, place: PlaceResult, accent: string) {
  return L.divIcon({
    className: "",
    html: `
      <div class="vp-wrap vp-hero" style="--accent:${accent};">
        <div class="vp-pin vp-pin--hero">
          <span class="vp-icon">${categoryIconSvg(place.category)}</span>
        </div>
        <div class="vp-label vp-label--inline">${escapeHtml(place.name)}</div>
      </div>
    `,
    iconSize: [220, 32],
    iconAnchor: [16, 16],
  })
}

export function buildInfoSecondaryPlaceIcon(L: any, place: PlaceResult, accent: string) {
  return L.divIcon({
    className: "",
    html: `
      <div class="vp-wrap vp-secondary" style="--accent:${accent};">
        <div class="vp-pin vp-pin--secondary">
          <span class="vp-icon">${categoryIconSvg(place.category)}</span>
        </div>
        <div class="vp-label vp-label--hover">${escapeHtml(place.name)}</div>
      </div>
    `,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  })
}

export function buildInfoZoneIcon(
  L: any,
  zone: { title: string; subtitle: string; accent: string },
  options?: { muted?: boolean; badge?: string | null }
) {
  const muted = options?.muted ?? false
  const badge = options?.badge
  return L.divIcon({
    className: "",
    html: `
      <div class="vp-zone${muted ? " is-muted" : ""}" style="--accent:${zone.accent};">
        <div class="vp-zone__title">${escapeHtml(zone.title)}</div>
        <div class="vp-zone__meta">
          <span class="vp-zone__count">${escapeHtml(zone.subtitle)}</span>
          ${badge ? `<span class="vp-zone__badge">${escapeHtml(badge)}</span>` : ""}
        </div>
      </div>
    `,
    iconSize: [190, 44],
    iconAnchor: [12, 12],
  })
}

// Currently unused but kept exported for future / external callers.
export function buildInfoPlaceIcon(L: any, place: PlaceResult, accent: string) {
  return L.divIcon({
    className: "",
    html: `
      <div class="vp-wrap vp-info" style="--accent:${accent};">
        <div class="vp-pin vp-pin--info">
          <span class="vp-icon">${categoryIconSvg(place.category)}</span>
        </div>
        <div class="vp-label vp-label--inline">${escapeHtml(place.name)}</div>
      </div>
    `,
    iconSize: [210, 28],
    iconAnchor: [14, 14],
  })
}
