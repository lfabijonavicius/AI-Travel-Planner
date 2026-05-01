"use client"

import { PlaceResult } from "@/types"

export interface PlaceBrowseTheme {
  key: string
  title: string
  hint: string
  zoneLabel: string
  accent: string
  rank: number
}

export interface PlaceBrowseSection {
  key: string
  title: string
  hint: string
  accent: string
  places: PlaceResult[]
}

export interface PlaceMiniZone {
  key: string
  title: string
  hint: string
  accent: string
  center: { lat: number; lng: number }
  radiusKm: number
  places: PlaceResult[]
}

const THEME_DEFS: PlaceBrowseTheme[] = [
  {
    key: "medina",
    title: "Street Life & Markets",
    hint: "The atmosphere-heavy anchors that make the city feel immediate.",
    zoneLabel: "Medina Core",
    accent: "#f59e0b",
    rank: 0,
  },
  {
    key: "history",
    title: "Architecture & History",
    hint: "Palaces, monuments, and centuries-old landmarks worth prioritizing.",
    zoneLabel: "Historic Monuments",
    accent: "#fbbf24",
    rank: 1,
  },
  {
    key: "gardens",
    title: "Gardens & Design",
    hint: "Calmer, more visual pockets that balance the busier historic core.",
    zoneLabel: "Gardens & Design",
    accent: "#34d399",
    rank: 2,
  },
  {
    key: "culture",
    title: "Museums & Culture",
    hint: "Art, craft, and cultural stops that deepen the destination beyond the icons.",
    zoneLabel: "Museums & Culture",
    accent: "#3d8cd6",
    rank: 3,
  },
  {
    key: "food",
    title: "Food & Local Flavor",
    hint: "Places worth shaping a meal stop or evening around.",
    zoneLabel: "Food Pocket",
    accent: "#f97316",
    rank: 4,
  },
  {
    key: "highlights",
    title: "Walkable Highlights",
    hint: "Strong all-round stops to compare on the map when no tighter theme dominates.",
    zoneLabel: "Walkable Highlights",
    accent: "#60a5fa",
    rank: 5,
  },
]

function placeText(place: PlaceResult) {
  return `${place.name} ${place.category || ""} ${place.summary || ""} ${place.address || ""}`.toLowerCase()
}

function hasAny(text: string, keywords: string[]) {
  return keywords.some((keyword) => text.includes(keyword))
}

export function getBrowseThemeForPlace(place: PlaceResult): PlaceBrowseTheme {
  const text = placeText(place)

  if (hasAny(text, ["restaurant", "food", "cafe", "bar", "bistro", "bakery", "dining", "brunch", "rooftop"])) {
    return THEME_DEFS[4]
  }
  if (hasAny(text, ["square", "market", "souk", "medina", "bazaar", "plaza", "fnaa", "street performers", "old town"])) {
    return THEME_DEFS[0]
  }
  if (hasAny(text, ["garden", "jardin", "majorelle", "park", "design", "yves saint laurent", "botanical", "grove"])) {
    return THEME_DEFS[2]
  }
  if (hasAny(text, ["museum", "gallery", "art", "craft", "exhibit", "cultural center"])) {
    return THEME_DEFS[3]
  }
  if (hasAny(text, ["palace", "mosque", "madrasa", "madrasah", "fortress", "castle", "citadel", "monument", "historic", "heritage", "tower", "gate", "ruins", "cathedral", "temple", "mausoleum"])) {
    return THEME_DEFS[1]
  }

  return THEME_DEFS[5]
}

export function groupPlacesForBrowse(places: PlaceResult[]): PlaceBrowseSection[] {
  const groups = new Map<string, PlaceBrowseSection>()

  places.forEach((place) => {
    const theme = getBrowseThemeForPlace(place)
    const group = groups.get(theme.key)
    if (group) {
      group.places.push(place)
      return
    }
    groups.set(theme.key, {
      key: theme.key,
      title: theme.title,
      hint: theme.hint,
      accent: theme.accent,
      places: [place],
    })
  })

  return Array.from(groups.values())
    .sort((a, b) => {
      const themeA = THEME_DEFS.find((theme) => theme.key === a.key)?.rank ?? 99
      const themeB = THEME_DEFS.find((theme) => theme.key === b.key)?.rank ?? 99
      if (themeA !== themeB) return themeA - themeB
      return b.places.length - a.places.length
    })
    .map((group) => ({
      ...group,
      places: group.places.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0)),
    }))
}

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const toRad = (degrees: number) => (degrees * Math.PI) / 180
  const earthRadiusKm = 6371
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * earthRadiusKm * Math.asin(Math.sqrt(h))
}

function centroid(places: PlaceResult[]) {
  const lat = places.reduce((sum, place) => sum + place.lat, 0) / places.length
  const lng = places.reduce((sum, place) => sum + place.lng, 0) / places.length
  return { lat, lng }
}

function inferClusterTheme(places: PlaceResult[]) {
  const counts = new Map<string, { theme: PlaceBrowseTheme; count: number }>()
  places.forEach((place) => {
    const theme = getBrowseThemeForPlace(place)
    const current = counts.get(theme.key)
    counts.set(theme.key, { theme, count: (current?.count ?? 0) + 1 })
  })
  return Array.from(counts.values()).sort((a, b) => b.count - a.count || a.theme.rank - b.theme.rank)[0]?.theme ?? THEME_DEFS[5]
}

export function clusterPlacesIntoMiniZones(places: PlaceResult[]): PlaceMiniZone[] {
  const clusters: PlaceResult[][] = []
  const sorted = [...places].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))

  sorted.forEach((place) => {
    let bestIndex = -1
    let bestDistance = Number.POSITIVE_INFINITY

    clusters.forEach((cluster, index) => {
      const center = centroid(cluster)
      const distance = haversineKm({ lat: place.lat, lng: place.lng }, center)
      if (distance < 1.3 && distance < bestDistance) {
        bestDistance = distance
        bestIndex = index
      }
    })

    if (bestIndex === -1) {
      clusters.push([place])
      return
    }

    clusters[bestIndex].push(place)
  })

  return clusters
    .map((cluster, index) => {
      const center = centroid(cluster)
      const radiusKm = Math.max(
        0.35,
        ...cluster.map((place) => haversineKm({ lat: place.lat, lng: place.lng }, center))
      )
      const theme = inferClusterTheme(cluster)
      return {
        key: `${theme.key}-${index}`,
        title: cluster.length > 1 ? theme.zoneLabel : cluster[0].name,
        hint: theme.hint,
        accent: theme.accent,
        center,
        radiusKm,
        places: cluster.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0)),
      }
    })
    .sort((a, b) => b.places.length - a.places.length)
}
