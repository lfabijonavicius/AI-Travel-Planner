"use client"

import { HotelResult, ItineraryEvent, ItineraryEventDetail, PlaceResult } from "@/types"

interface ResolverInput {
  event: ItineraryEvent
  dayLabel?: string
  city?: string
  date?: string
  places: PlaceResult[]
  hotels: HotelResult[]
}

interface ResolverResult {
  place?: PlaceResult
  hotel?: HotelResult
  fallback: ItineraryEventDetail
}

function normalize(value: string | undefined) {
  return (value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}

function buildNameCandidates(event: ItineraryEvent) {
  const candidates = [event.title, event.subtitle]
  const title = event.title.trim()
  const patterns = [
    /^(?:visit|explore|discover|morning walk in|walk in|afternoon in|evening at|sunset at)\s+/i,
    /^(?:breakfast|lunch|dinner|drinks|cocktails)\s+at\s+/i,
    /^(?:hotel check in|hotel check-in|check in at|check-in at|check out from|check-out from)\s+/i,
    /^(?:flight arrival at|arrival at|departure from|transfer to)\s+/i,
  ]
  for (const pattern of patterns) {
    if (pattern.test(title)) candidates.push(title.replace(pattern, ""))
  }
  if (/\sat\s/i.test(title)) candidates.push(title.split(/\sat\s/i).slice(1).join(" at "))
  if (/\sin\s/i.test(title)) candidates.push(title.split(/\sin\s/i).slice(1).join(" in "))
  return Array.from(new Set(candidates.map((value) => value.trim()).filter(Boolean)))
}

function hasExplicitVenue(event: ItineraryEvent, candidates: string[]) {
  const normalizedTitle = normalize(event.title)
  return candidates.some((candidate) => {
    const normalizedCandidate = normalize(candidate)
    return Boolean(normalizedCandidate) && normalizedCandidate !== normalizedTitle
  })
}

function coordsMatch(
  coords: { lat: number; lng: number } | undefined,
  lat: number | undefined,
  lng: number | undefined,
  tolerance = 0.003
) {
  if (!coords || lat == null || lng == null) return false
  return Math.abs(coords.lat - lat) <= tolerance && Math.abs(coords.lng - lng) <= tolerance
}

function nameMatchScore(candidates: string[], value: string | undefined) {
  const target = normalize(value)
  if (!target) return 0
  let bestScore = 0
  candidates.forEach((candidate) => {
    const normalized = normalize(candidate)
    if (!normalized) return
    if (normalized === target) {
      bestScore = Math.max(bestScore, 100)
      return
    }
    if (normalized.startsWith(target) || target.startsWith(normalized)) {
      bestScore = Math.max(bestScore, 85)
      return
    }
    if (normalized.includes(target) || target.includes(normalized)) {
      bestScore = Math.max(bestScore, 70)
    }
  })
  return bestScore
}

function isFoodPlace(place: PlaceResult) {
  const category = normalize(place.category)
  return (
    category.includes("restaurant") ||
    category.includes("food") ||
    category.includes("bar") ||
    category.includes("cafe") ||
    category.includes("dining")
  )
}

function isActivityPlace(place: PlaceResult) {
  return !isFoodPlace(place)
}

function categoryCompatible(event: ItineraryEvent, place: PlaceResult) {
  if (event.type === "food") return isFoodPlace(place)
  if (event.type === "activity" || event.type === "poi") return isActivityPlace(place)
  return true
}

function bestPlaceNameMatch(
  event: ItineraryEvent,
  candidates: string[],
  places: PlaceResult[]
): { place: PlaceResult; score: number } | null {
  let best: { place: PlaceResult; score: number } | null = null
  places.forEach((place) => {
    if (!categoryCompatible(event, place)) return
    const score = Math.max(
      nameMatchScore(candidates, place.name),
      nameMatchScore(candidates, place.address)
    )
    if (!best || score > best.score) {
      best = { place, score }
    }
  })
  return best
}

export function resolveItineraryEventEntity({
  event,
  dayLabel,
  city,
  date,
  places,
  hotels,
}: ResolverInput): ResolverResult {
  const fallback: ItineraryEventDetail = {
    time: event.time,
    title: event.title,
    subtitle: event.subtitle,
    type: event.type,
    city,
    date,
    day_label: dayLabel,
    price_local: event.price_local,
    duration_minutes: event.duration_minutes,
    coordinates: event.coordinates,
  }

  const candidates = buildNameCandidates(event)
  const explicitVenue = hasExplicitVenue(event, candidates)

  if (event.type === "hotel" || event.type === "flight") {
    const hotelByName = hotels.find(
      (hotel) =>
        nameMatchScore(candidates, hotel.name) >= 70 ||
        nameMatchScore(candidates, hotel.address) >= 70
    )
    if (hotelByName) return { hotel: hotelByName, fallback }

    const hotelByCoords = hotels.find((hotel) => coordsMatch(event.coordinates, hotel.lat, hotel.lng))
    if (hotelByCoords) return { hotel: hotelByCoords, fallback }
    return { fallback }
  }

  const namedPlaceMatch: { place: PlaceResult; score: number } | null = bestPlaceNameMatch(event, candidates, places)
  if (namedPlaceMatch && namedPlaceMatch.score >= 70) {
    return { place: namedPlaceMatch.place, fallback }
  }

  if (explicitVenue) {
    return { fallback }
  }

  const compatibleCoordsMatches = places.filter(
    (place) => categoryCompatible(event, place) && coordsMatch(event.coordinates, place.lat, place.lng)
  )
  if (compatibleCoordsMatches.length === 1) {
    return { place: compatibleCoordsMatches[0], fallback }
  }

  return { fallback }
}
