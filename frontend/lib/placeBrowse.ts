import { PlaceResult } from "@/types"

export type PlaceBrowseTheme =
  | "markets_street_life"
  | "architecture_history"
  | "gardens_design"
  | "museums_culture"
  | "food_local_flavor"
  | "views_waterfront"
  | "nightlife_after_dark"
  | "walkable_highlights"

export interface PlaceBrowseSection {
  id: PlaceBrowseTheme
  title: string
  blurb: string
  accent: string
  places: PlaceResult[]
}

export interface PlaceMiniZone {
  id: string
  title: string
  subtitle: string
  theme: PlaceBrowseTheme
  accent: string
  centroid: { lat: number; lng: number }
  radiusMeters: number
  places: PlaceResult[]
}

const THEME_META: Record<
  PlaceBrowseTheme,
  { title: string; blurb: string; accent: string; order: number }
> = {
  markets_street_life: {
    title: "Street Life & Markets",
    blurb: "The loud, local, walk-through-the-crowd layer of the city.",
    accent: "#f97316",
    order: 1,
  },
  architecture_history: {
    title: "Architecture & History",
    blurb: "The signature monuments and heritage anchors worth opening first.",
    accent: "#fbbf24",
    order: 0,
  },
  gardens_design: {
    title: "Gardens & Design",
    blurb: "Calmer, more visual stops with space to slow the pace down.",
    accent: "#22c55e",
    order: 2,
  },
  museums_culture: {
    title: "Museums & Culture",
    blurb: "Indoor culture stops when you want depth instead of just atmosphere.",
    accent: "#a78bfa",
    order: 3,
  },
  food_local_flavor: {
    title: "Food & Local Flavor",
    blurb: "Places that are worth building a meal or neighborhood detour around.",
    accent: "#ef4444",
    order: 4,
  },
  views_waterfront: {
    title: "Views & Scenic Edges",
    blurb: "The skyline, waterfront, or lookout layer of the destination.",
    accent: "#38bdf8",
    order: 5,
  },
  nightlife_after_dark: {
    title: "After Dark",
    blurb: "Cocktails, music, and late energy when the city shifts gear.",
    accent: "#ec4899",
    order: 6,
  },
  walkable_highlights: {
    title: "Walkable Highlights",
    blurb: "Strong all-round stops that don’t fit a narrower bucket cleanly.",
    accent: "#3d8cd6",
    order: 7,
  },
}

const THEME_CLUSTER_RADIUS_METERS: Record<PlaceBrowseTheme, number> = {
  markets_street_life: 1200,
  architecture_history: 1400,
  gardens_design: 1900,
  museums_culture: 1300,
  food_local_flavor: 1000,
  views_waterfront: 2200,
  nightlife_after_dark: 1000,
  walkable_highlights: 1500,
}

function scorePlace(place: PlaceResult) {
  return (place.rating ?? 0) * 10 + (place.summary ? 1 : 0) + (place.photo_url ? 1 : 0)
}

function themeText(place: PlaceResult) {
  return [place.name, place.category, place.summary, place.address]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
}

export function inferPlaceBrowseTheme(place: PlaceResult): PlaceBrowseTheme {
  const text = themeText(place)

  if (/\b(restaurant|food|dining|cafe|bakery|bistro|tapas|brunch|tea house|rooftop dinner|barbecue)\b/.test(text)) {
    return "food_local_flavor"
  }
  if (/\b(bar|pub|cocktail|club|music|nightlife|late|speakeasy|wine)\b/.test(text)) {
    return "nightlife_after_dark"
  }
  if (/\b(market|souk|souks|medina|square|plaza|bazaar|street|lanes|alley|jemaa|fnaa|ramblas)\b/.test(text)) {
    return "markets_street_life"
  }
  if (/\b(garden|gardens|park|botanic|botanical|majorelle|jardin|design|courtyard oasis|landscape)\b/.test(text)) {
    return "gardens_design"
  }
  if (/\b(museum|gallery|art|culture|theatre|theater|opera|foundation|exhibition)\b/.test(text)) {
    return "museums_culture"
  }
  if (/\b(viewpoint|tower|lookout|beach|coast|waterfront|marina|harbour|harbor|bay|sunset|panoramic)\b/.test(text)) {
    return "views_waterfront"
  }
  if (/\b(landmark|monument|historic|history|heritage|palace|castle|fortress|citadel|ruins|mosque|cathedral|church|temple|madrasa|madrasah|basilica|archaeological)\b/.test(text)) {
    return "architecture_history"
  }
  return "walkable_highlights"
}

export function classifyPlaceBrowseKind(place: PlaceResult): "restaurants" | "icons" | "attractions" {
  const theme = inferPlaceBrowseTheme(place)
  if (theme === "food_local_flavor" || theme === "nightlife_after_dark") return "restaurants"
  if (theme === "architecture_history" || theme === "markets_street_life") return "icons"
  return "attractions"
}

export function buildPlaceBrowseSections(places: PlaceResult[]): PlaceBrowseSection[] {
  const grouped = new Map<PlaceBrowseTheme, PlaceResult[]>()

  places.forEach((place) => {
    const theme = inferPlaceBrowseTheme(place)
    const existing = grouped.get(theme) ?? []
    existing.push(place)
    grouped.set(theme, existing)
  })

  return Array.from(grouped.entries())
    .map(([theme, items]) => ({
      id: theme,
      title: THEME_META[theme].title,
      blurb: THEME_META[theme].blurb,
      accent: THEME_META[theme].accent,
      places: [...items].sort((a, b) => scorePlace(b) - scorePlace(a)),
    }))
    .sort((a, b) => {
      const byOrder = THEME_META[a.id].order - THEME_META[b.id].order
      if (byOrder !== 0) return byOrder
      return scorePlace(b.places[0]) - scorePlace(a.places[0])
    })
}

function haversineMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const toRad = (value: number) => (value * Math.PI) / 180
  const r = 6371000
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)
  const x =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLng / 2) * Math.sin(dLng / 2) * Math.cos(lat1) * Math.cos(lat2)
  const c = 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x))
  return r * c
}

function centroidForPlaces(places: PlaceResult[]) {
  const lat = places.reduce((sum, place) => sum + place.lat, 0) / places.length
  const lng = places.reduce((sum, place) => sum + place.lng, 0) / places.length
  return { lat, lng }
}

function compassSuffix(
  point: { lat: number; lng: number },
  center: { lat: number; lng: number }
) {
  const latDelta = point.lat - center.lat
  const lngDelta = point.lng - center.lng
  if (Math.abs(latDelta) < 0.015 && Math.abs(lngDelta) < 0.015) return "Central"
  if (Math.abs(latDelta) >= Math.abs(lngDelta)) return latDelta < 0 ? "South" : "North"
  return lngDelta < 0 ? "West" : "East"
}

function zoneBaseTitle(theme: PlaceBrowseTheme, places: PlaceResult[]) {
  const text = places.map((place) => themeText(place)).join(" ")
  if (theme === "markets_street_life") {
    if (/\b(medina|souk|souks|jemaa|fnaa|bazaar)\b/.test(text)) return "Medina Pulse"
    if (/\b(square|plaza|ramblas)\b/.test(text)) return "Old-Town Crossroads"
    return "Street-Life Pocket"
  }
  if (theme === "architecture_history") {
    if (/\b(palace|bahia|badi)\b/.test(text)) return "Palace Circuit"
    if (/\b(mosque|cathedral|church|madrasa|madrasah|temple)\b/.test(text)) return "Historic Core"
    if (/\b(fortress|citadel|ruins|castle)\b/.test(text)) return "Heritage Edge"
    return "Architecture & History"
  }
  if (theme === "gardens_design") {
    if (/\b(garden|majorelle|jardin|botanic)\b/.test(text)) return "Garden Calm"
    if (/\b(design)\b/.test(text)) return "Design Pocket"
    return "Green Pocket"
  }
  if (theme === "museums_culture") return "Culture Pocket"
  if (theme === "food_local_flavor") return "Local Tables"
  if (theme === "views_waterfront") return "Scenic Edge"
  if (theme === "nightlife_after_dark") return "After-Dark Pocket"
  return "Walkable Highlights"
}

export function buildPlaceMiniZones(places: PlaceResult[]): PlaceMiniZone[] {
  const sections = buildPlaceBrowseSections(places)
  const allCoords = places.filter((place) => Number.isFinite(place.lat) && Number.isFinite(place.lng))
  const overallCenter = allCoords.length ? centroidForPlaces(allCoords) : { lat: 0, lng: 0 }

  return sections.flatMap((section) => {
    const threshold = THEME_CLUSTER_RADIUS_METERS[section.id]
    const clusters: PlaceResult[][] = []

    section.places.forEach((place) => {
      let bestIndex = -1
      let bestDistance = Number.POSITIVE_INFINITY

      clusters.forEach((cluster, index) => {
        const center = centroidForPlaces(cluster)
        const distance = haversineMeters(center, { lat: place.lat, lng: place.lng })
        if (distance < bestDistance) {
          bestDistance = distance
          bestIndex = index
        }
      })

      if (bestIndex >= 0 && bestDistance <= threshold) {
        clusters[bestIndex].push(place)
        return
      }
      clusters.push([place])
    })

    return clusters.map((cluster, index) => {
      const centroid = centroidForPlaces(cluster)
      const baseTitle = zoneBaseTitle(section.id, cluster)
      const needsSuffix = clusters.length > 1
      const title = needsSuffix ? `${baseTitle} · ${compassSuffix(centroid, overallCenter)}` : baseTitle
      const maxDistance = cluster.reduce((max, place) => {
        const distance = haversineMeters(centroid, { lat: place.lat, lng: place.lng })
        return Math.max(max, distance)
      }, 0)
      const radiusMeters = Math.max(450, Math.min(2200, maxDistance + 260))
      return {
        id: `${section.id}-${index}`,
        title,
        subtitle: `${cluster.length} ${cluster.length === 1 ? "stop" : "stops"}`,
        theme: section.id,
        accent: section.accent,
        centroid,
        radiusMeters,
        places: cluster,
      }
    })
  })
}

function trailingQuestion(original: string) {
  const matches = original.match(/[^.?!\n]*\?/g)
  if (!matches?.length) return null
  return matches[matches.length - 1].trim()
}

export function buildBrowseMessageMarkdown(places: PlaceResult[], originalContent: string) {
  const sections = buildPlaceBrowseSections(places).slice(0, 3)
  if (!sections.length) return originalContent

  const intro =
    sections.length > 1
      ? "Open the map first. These picks make more sense as a few tight clusters than as one long checklist."
      : "Open the map first. The cards below are the strongest quick-entry points for this destination."

  const bullets = sections.map((section) => `- **${section.title}**: ${section.blurb}`)
  const question =
    trailingQuestion(originalContent) ||
    (sections.some((section) => section.id === "food_local_flavor")
      ? "Want me to narrow this to the best first 3 stops or a stronger food-only cut?"
      : "Want me to narrow this to the essential landmarks, best food nearby, or the easiest first 3 stops?")

  return `${intro}\n\n${bullets.join("\n")}\n\n${question}`
}
