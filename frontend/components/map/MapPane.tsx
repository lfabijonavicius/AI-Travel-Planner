"use client"

import { useEffect, useRef, useState } from "react"
import "leaflet/dist/leaflet.css"
import { useTripStore, cancelHoverClose as globalCancelHoverClose, scheduleHoverClose as globalScheduleHoverClose } from "@/hooks/useTripStore"
import { PlaceDetailDrawer } from "./PlaceDetailDrawer"
import { type HoverCardState } from "./MapHoverCard"
import { DestinationDetailPanel } from "./DestinationDetailPanel"
import { categoryIconSvg } from "@/lib/placeIcon"
import { resolveItineraryEventEntity } from "@/lib/itineraryEventResolver"
import { PlaceResult } from "@/types"
import { buildPlaceMiniZones } from "@/lib/placeBrowse"
import { AIRLINE_HUBS, getAirportCoords } from "@/lib/airportData"
import { prefetchPhotos } from "@/lib/photoPrefetch"
import { greatCirclePoints, distanceMeters } from "@/lib/geoUtils"
import {
  buildHotelIcon,
  buildInfoHeroPlaceIcon,
  buildInfoSecondaryPlaceIcon,
  buildInfoZoneIcon,
} from "@/lib/mapMarkerIcons"

function isFiniteWeatherDay(day: { temp_high_c: number; temp_low_c: number } | undefined): boolean {
  return !!day && Number.isFinite(day.temp_high_c) && Number.isFinite(day.temp_low_c)
}

function classifyDiscoveryCategory(category: string) {
  if (/restaurant|food|cafe|bar|bistro|bakery/i.test(category)) return "restaurants"
  if (/landmark|monument|historic|heritage|palace|castle|fortress|citadel|ruins|icon/i.test(category)) return "icons"
  return "attractions"
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"
const discoveryHighlightsCache = new Map<string, PlaceResult[]>()

function discoveryKey(name: string, country?: string) {
  return `${name}::${country || ""}`.toLowerCase()
}

export function MapPane() {
  const mapRef     = useRef<HTMLDivElement>(null)
  const leafletRef = useRef<any>(null)
  const clusterRef = useRef<any>(null)
  const markersRef = useRef<Record<string, any>>({})
  const hotelMarkersRef = useRef<Record<string, any>>({})
  const itineraryMarkersRef = useRef<any[]>([])
  const routeRef   = useRef<any>(null)
  const flightArcRef = useRef<any>(null)
  const discoveryRouteRef = useRef<any[]>([])
  const discoveryOriginRef = useRef<any>(null)
  const discoveryHighlightMarkersRef = useRef<any[]>([])
  const discoveryHighlightDecorRef = useRef<any[]>([])
  const discoveryCityMarkerRef = useRef<any>(null)
  const infoDecorRef = useRef<any[]>([])
  const cityPinMarkerRef = useRef<any>(null)

  const [budgetOpen,   setBudgetOpen]   = useState(false)
  const [currencyOpen, setCurrencyOpen] = useState(false)
  const setHoverCard = useTripStore((s) => s.setHoverCard)

  const {
    places, hotels, pinnedPlaceIds,
    hoveredPlaceId, hoveredFlight, targetLocation,
    selectedItineraryDay, itinerary,
    selectedItineraryEventKey,
    budget, currency, weather,
    selectedHotel,
    destinations,
    discoveryHighlights,
    discoveryHighlightFilter,
    selectedPlaceDetail, selectedHotelDetail, selectedDestinationDetail,
    pinnedDiscoveryDestination,
    setSelectedPlaceDetail, setSelectedHotelDetail, setSelectedItineraryEventDetail, setTargetLocation, setSelectedItineraryDay, setSelectedItineraryEventKey,
    setDiscoveryHighlights, setDiscoveryHighlightsLoading,
    tripContext,
    interactionMode,
    hoveredBrowseSection,
    focusedBrowseSection,
    setFocusedBrowseSection,
    cityPin,
  } = useTripStore()

  const destMarkersRef = useRef<any[]>([])

  const cancelHoverClose = () => globalCancelHoverClose()
  const scheduleHoverClose = () => globalScheduleHoverClose(() => setHoverCard(null), 140)

  const showHoverCardForMarker = (marker: any, target: HoverCardState["target"]) => {
    const map = leafletRef.current
    if (!map || !mapRef.current) return
    const containerPoint = map.latLngToContainerPoint(marker.getLatLng())
    const mapRect = mapRef.current.getBoundingClientRect()
    const x = mapRect.left + containerPoint.x
    const y = mapRect.top + containerPoint.y
    cancelHoverClose()
    setHoverCard({ target, x, y })
  }

  // Global bridges
  useEffect(() => {
    ;(window as any).__voyagerTogglePin = (name: string) => {
      useTripStore.getState().togglePin(name)
    }
    ;(window as any).__voyagerSelectHotel = (name: string) => {
      const store = useTripStore.getState()
      const hotel = store.hotels.find((h) => h.name === name)
      if (hotel) store.setSelectedHotel(store.selectedHotel?.name === name ? null : hotel)
    }
    ;(window as any).__voyagerScrollToCard = (name: string) => {
      const el =
        document.querySelector(`[data-place-name="${CSS.escape(name)}"]`) ??
        document.querySelector(`[data-hotel-name="${CSS.escape(name)}"]`)
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" })
        ;(el as HTMLElement).style.transition = "box-shadow 0.3s"
        ;(el as HTMLElement).style.boxShadow = "0 0 0 2px #3d8cd6, 0 8px 32px rgba(61,140,214,0.3)"
        setTimeout(() => { (el as HTMLElement).style.boxShadow = "" }, 1200)
      }
    }
    ;(window as any).__voyagerOpenDrawer = (name: string) => {
      const store = useTripStore.getState()
      const place = store.places.find((p) => p.name === name)
      if (place) { store.setSelectedPlaceDetail(place); return }
      if (store.cityPin?.name === name) { store.setSelectedPlaceDetail(store.cityPin); return }
      const hotel = store.hotels.find((h) => h.name === name)
      if (hotel) store.setSelectedHotelDetail(hotel)
    }
    return () => {
      delete (window as any).__voyagerTogglePin
      delete (window as any).__voyagerSelectHotel
      delete (window as any).__voyagerScrollToCard
      delete (window as any).__voyagerOpenDrawer
    }
  }, [])

  // Init map
  useEffect(() => {
    if (typeof window === "undefined" || !mapRef.current) return

    const googleKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY
    const darkStyles = [
      { elementType: "geometry", stylers: [{ color: "#1a1f2e" }] },
      { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
      { elementType: "labels.text.fill", stylers: [{ color: "#7a8499" }] },
      { elementType: "labels.text.stroke", stylers: [{ color: "#1a1f2e" }] },
      { featureType: "administrative", elementType: "geometry", stylers: [{ color: "#2e3650" }] },
      { featureType: "administrative.country", elementType: "labels.text.fill", stylers: [{ color: "#8892a4" }] },
      { featureType: "administrative.locality", elementType: "labels.text.fill", stylers: [{ color: "#c8d0e0" }] },
      { featureType: "poi", elementType: "labels.text.fill", stylers: [{ color: "#6b7590" }] },
      { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#1b2535" }] },
      { featureType: "poi.park", elementType: "labels.text.fill", stylers: [{ color: "#4a6070" }] },
      { featureType: "road", elementType: "geometry.fill", stylers: [{ color: "#252d42" }] },
      { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#7a8499" }] },
      { featureType: "road.arterial", elementType: "geometry", stylers: [{ color: "#2d3650" }] },
      { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#1e5fa5" }] },
      { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#163f70" }] },
      { featureType: "road.local", elementType: "labels.text.fill", stylers: [{ color: "#556070" }] },
      { featureType: "transit", elementType: "labels.text.fill", stylers: [{ color: "#6b7590" }] },
      { featureType: "water", elementType: "geometry", stylers: [{ color: "#0d1520" }] },
      { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#2a4a6a" }] },
      { featureType: "landscape", elementType: "geometry", stylers: [{ color: "#1e2535" }] },
      { featureType: "landscape.natural.terrain", stylers: [{ visibility: "on" }, { color: "#161d2c" }] },
    ]

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const L = require("leaflet")
    ;(window as any).L = L

    const map = L.map(mapRef.current, { center: [48, 12], zoom: 4, zoomControl: false, maxZoom: 20 })

    const addGoogleLayer = () => {
      const m = leafletRef.current
      if (!m) return
      const WL = (window as any).L ?? L
      WL.gridLayer.googleMutant({ type: "terrain", styles: darkStyles }).addTo(m)
    }

    const loadGoogleMaps = () => {
      if ((window as any).google?.maps) {
        addGoogleLayer()
      } else if (!document.querySelector('script[src*="maps.googleapis.com"]')) {
        const gScript = document.createElement("script")
        gScript.src = `https://maps.googleapis.com/maps/api/js?key=${googleKey}`
        gScript.async = true
        gScript.onload = addGoogleLayer
        document.head.appendChild(gScript)
      }
    }

    if ((window as any).L?.gridLayer?.googleMutant) {
      loadGoogleMaps()
    } else if (!document.querySelector('script[src*="GoogleMutant"]')) {
      const pluginScript = document.createElement("script")
      pluginScript.src = "https://unpkg.com/leaflet.gridlayer.googlemutant@latest/dist/Leaflet.GoogleMutant.js"
      pluginScript.onload = loadGoogleMaps
      document.head.appendChild(pluginScript)
    } else {
      // Script tag exists but may still be loading — add listener, don't call directly
      document.querySelector('script[src*="GoogleMutant"]')!.addEventListener('load', loadGoogleMaps)
    }

    L.control.zoom({ position: "topright" }).addTo(map)
    map.on("click", () => {
      useTripStore.getState().setFocusedBrowseSection(null)
    })
    map.on("movestart", () => {
      globalCancelHoverClose()
      setHoverCard(null)
    })
    leafletRef.current = map
    return () => { map.remove(); leafletRef.current = null }
  }, [])

  // Discovery highlights for the pinned destination.
  // Uses pinnedDiscoveryDestination (not selectedDestinationDetail) so highlights
  // survive the card being closed — the card and the marker layer are independent.
  useEffect(() => {
    if (interactionMode !== "discovery" || !pinnedDiscoveryDestination) {
      setDiscoveryHighlights([])
      setDiscoveryHighlightsLoading(false)
      return
    }

    const destinationQuery = [pinnedDiscoveryDestination.name, pinnedDiscoveryDestination.country].filter(Boolean).join(", ")
    const cacheKey = discoveryKey(pinnedDiscoveryDestination.name, pinnedDiscoveryDestination.country)
    const cached = discoveryHighlightsCache.get(cacheKey)
    if (cached) {
      setDiscoveryHighlights(cached)
      setDiscoveryHighlightsLoading(false)
      return
    }

    let cancelled = false
    setDiscoveryHighlightsLoading(true)

    async function loadHighlights() {
      try {
        const [iconsRes, attractionsRes, restaurantsRes] = await Promise.all([
          fetch(`${API_URL}/api/places?city=${encodeURIComponent(destinationQuery)}&category=${encodeURIComponent("landmarks and monuments")}&max_results=4`),
          fetch(`${API_URL}/api/places?city=${encodeURIComponent(destinationQuery)}&category=attractions&max_results=5`),
          fetch(`${API_URL}/api/places?city=${encodeURIComponent(destinationQuery)}&category=restaurants&max_results=4`),
        ])
        const [iconsData, attractionsData, restaurantsData] = await Promise.all([
          iconsRes.json(),
          attractionsRes.json(),
          restaurantsRes.json(),
        ])
        const merged = [
          ...(Array.isArray(iconsData) ? iconsData : []),
          ...(Array.isArray(attractionsData) ? attractionsData : []),
          ...(Array.isArray(restaurantsData) ? restaurantsData : []),
        ]
          .filter((place) => place && place.name && place.lat && place.lng && !place.error)
          .reduce((acc: PlaceResult[], place: PlaceResult) => {
            if (acc.some((existing) => existing.name === place.name && existing.lat === place.lat && existing.lng === place.lng)) {
              return acc
            }
            acc.push(place)
            return acc
          }, [])

        discoveryHighlightsCache.set(cacheKey, merged)
        if (!cancelled) {
          setDiscoveryHighlights(merged)
        }
      } catch {
        if (!cancelled) {
          setDiscoveryHighlights([])
        }
      } finally {
        if (!cancelled) {
          setDiscoveryHighlightsLoading(false)
        }
      }
    }

    void loadHighlights()

    return () => {
      cancelled = true
    }
  }, [
    interactionMode,
    pinnedDiscoveryDestination,
    setDiscoveryHighlights,
    setDiscoveryHighlightsLoading,
  ])

  // Place markers + cluster
  useEffect(() => {
    const map = leafletRef.current
    if (!map) return
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const L = require("leaflet")
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require("leaflet.markercluster")

    if (clusterRef.current) { map.removeLayer(clusterRef.current); clusterRef.current = null }
    markersRef.current = {}
    infoDecorRef.current.forEach((layer) => map.removeLayer(layer))
    infoDecorRef.current = []

    if (interactionMode === "discovery") return

    const validPlaces = places.filter((p) => p.lat && p.lng)
    if (!validPlaces.length) return

    if (interactionMode === "info") {
      const infoPlaces = validPlaces.slice(0, 12)
      const zones = buildPlaceMiniZones(infoPlaces)
      const sectionFocus = focusedBrowseSection || hoveredBrowseSection
      const allCentroids = zones.map((zone) => zone.centroid)
      const overallCenter = allCentroids.length
        ? {
            lat: allCentroids.reduce((sum, point) => sum + point.lat, 0) / allCentroids.length,
            lng: allCentroids.reduce((sum, point) => sum + point.lng, 0) / allCentroids.length,
          }
        : null
      const zoneDistances = overallCenter
        ? zones.map((zone) => distanceMeters(zone.centroid, overallCenter))
        : []
      const sortedDistances = [...zoneDistances].sort((a, b) => a - b)
      const medianDistance = sortedDistances.length
        ? sortedDistances[Math.floor(sortedDistances.length / 2)]
        : 0
      const outlierZoneIds = new Set(
        zones
          .filter((zone, index) => {
            const distance = zoneDistances[index] ?? 0
            return distance > Math.max(2800, medianDistance * 1.7) && zone.places.length <= 2
          })
          .map((zone) => zone.id)
      )

      const focusedZones = sectionFocus ? zones.filter((zone) => zone.theme === sectionFocus) : zones
      const includePlaceMarkers = !!sectionFocus

      zones.forEach((zone) => {
        const isFocused = !sectionFocus || zone.theme === sectionFocus
        const isOutlier = outlierZoneIds.has(zone.id)

        if (isOutlier && overallCenter) {
          const outlierConnector = L.polyline(
            [
              [overallCenter.lat, overallCenter.lng],
              [zone.centroid.lat, zone.centroid.lng],
            ],
            {
              color: zone.accent,
              weight: 1,
              opacity: isFocused ? 0.22 : 0.12,
              dashArray: "5 10",
            }
          ).addTo(map)
          infoDecorRef.current.push(outlierConnector)
        }

        const zoneMarker = L.marker([zone.centroid.lat, zone.centroid.lng], {
          zIndexOffset: isFocused ? 320 : 200,
          icon: buildInfoZoneIcon(L, zone, {
            muted: !isFocused,
            badge: isOutlier ? "Outer pick" : null,
          }),
        })
        zoneMarker.on("click", () => {
          setFocusedBrowseSection(zone.theme)
        })
        zoneMarker.on("mouseover", () => {
          const s = useTripStore.getState()
          if (s.selectedPlaceDetail || s.selectedHotelDetail) return
          const heroPlace = zone.places[0]
          if (!heroPlace) return
          showHoverCardForMarker(zoneMarker, { kind: "place", place: heroPlace })
        })
        zoneMarker.on("mouseout", () => {
          scheduleHoverClose()
        })
        zoneMarker.addTo(map)
        infoDecorRef.current.push(zoneMarker)

        if (!includePlaceMarkers || !isFocused) return

        zone.places.forEach((place, index) => {
          const isHero = index === 0
          const connector = L.polyline(
            [
              [zone.centroid.lat, zone.centroid.lng],
              [place.lat, place.lng],
            ],
            {
              color: zone.accent,
              weight: isHero ? 1.6 : 1.05,
              opacity: isHero ? 0.32 : 0.16,
              dashArray: isHero ? "2 6" : "2 10",
            }
          ).addTo(map)
          infoDecorRef.current.push(connector)
        })
      })

      if (includePlaceMarkers) {
        focusedZones.forEach((zone) => {
          zone.places.forEach((place, index) => {
            const isHero = index === 0
            const icon = isHero
              ? buildInfoHeroPlaceIcon(L, place, zone.accent)
              : buildInfoSecondaryPlaceIcon(L, place, zone.accent)
            const marker = L.marker([place.lat, place.lng], {
              icon,
              zIndexOffset: isHero ? 420 : 300,
            })
            marker.on("mouseover", () => {
              showHoverCardForMarker(marker, { kind: "place", place })
            })
            marker.on("mouseout", scheduleHoverClose)
            marker.on("click", () => {
              setHoverCard(null)
              setTargetLocation({ lat: place.lat, lng: place.lng })
              ;(window as any).__voyagerOpenDrawer?.(place.name)
            })
            marker.addTo(map)
            markersRef.current[place.name] = marker
          })
        })
      }

      const boundsPoints = sectionFocus
        ? [
            ...focusedZones.map((zone) => [zone.centroid.lat, zone.centroid.lng] as [number, number]),
            ...focusedZones.flatMap((zone) =>
              zone.places.map((place) => [place.lat, place.lng] as [number, number])
            ),
          ]
        : zones.map((zone) => [zone.centroid.lat, zone.centroid.lng] as [number, number])

      if (boundsPoints.length > 1) {
        const bounds = L.latLngBounds(boundsPoints)
        map.fitBounds(bounds, {
          padding: sectionFocus ? [110, 140] : [100, 120],
          maxZoom: sectionFocus ? 13 : 11,
          animate: true,
          duration: 0.7,
        })
      } else if (boundsPoints.length === 1) {
        map.flyTo(boundsPoints[0], sectionFocus ? 12 : 10, { animate: true, duration: 0.7 })
      }
      return
    }

    const cluster = (L as any).markerClusterGroup({
      maxClusterRadius: 50,
      iconCreateFunction: (c: any) => L.divIcon({
        className: "",
        html: `<div class="voyager-cluster">${c.getChildCount()}</div>`,
        iconSize: [34, 34], iconAnchor: [17, 17],
      }),
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
    })

    validPlaces.forEach((place) => {
      const isPinned = pinnedPlaceIds.has(place.name)
      const shortName = place.name.length > 26 ? place.name.slice(0, 24) + "…" : place.name
      const iconSvg = isPinned
        ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`
        : categoryIconSvg(place.category)
      const icon = L.divIcon({
        className: "",
        html: `
          <div class="vp-wrap vp-place${isPinned ? " is-pinned" : ""}">
            <div class="vp-pin vp-pin--place">
              <span class="vp-icon">${iconSvg}</span>
            </div>
            ${isPinned
              ? `<div class="vp-label vp-label--inline">${shortName.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>`
              : `<div class="vp-label vp-label--hover">${shortName.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>`}
          </div>
        `,
        iconSize: [isPinned ? 240 : 32, 32],
        iconAnchor: [16, 16],
      })

      const marker = L.marker([place.lat, place.lng], { icon })
      marker.on("mouseover", () => {
        showHoverCardForMarker(marker, { kind: "place", place })
      })
      marker.on("mouseout", scheduleHoverClose)
      marker.on("click", () => {
        setHoverCard(null)
        ;(window as any).__voyagerOpenDrawer?.(place.name)
      })
      if (isPinned) {
        marker.addTo(map)
      } else {
        cluster.addLayer(marker)
      }
      markersRef.current[place.name] = marker
    })

    map.addLayer(cluster)
    clusterRef.current = cluster
  }, [
    places,
    pinnedPlaceIds,
    interactionMode,
    hoveredBrowseSection,
    focusedBrowseSection,
    setFocusedBrowseSection,
    setTargetLocation,
  ])

  // Prefetch place + hotel photos so hover cards feel instant
  useEffect(() => {
    const urls: (string | undefined)[] = []
    places.forEach((p) => {
      if (p.photo_urls?.length) {
        urls.push(...p.photo_urls.slice(0, 3))
      } else if (p.photo_url) {
        urls.push(p.photo_url)
      }
    })
    hotels.forEach((h) => {
      if (h.photo_urls?.length) {
        urls.push(...h.photo_urls.slice(0, 3))
      } else if (h.photo_url) {
        urls.push(h.photo_url)
      }
    })
    prefetchPhotos(urls)
  }, [places, hotels])

  // Prefetch discovery + city pin photos
  useEffect(() => {
    const urls: (string | undefined)[] = []
    discoveryHighlights.forEach((p) => {
      if (p.photo_url) urls.push(p.photo_url)
    })
    if (cityPin?.photo_url) urls.push(cityPin.photo_url)
    prefetchPhotos(urls)
  }, [discoveryHighlights, cityPin])

  // Hotel markers
  useEffect(() => {
    const map = leafletRef.current
    if (!map) return
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const L = require("leaflet")

    Object.values(hotelMarkersRef.current).forEach((m) => map.removeLayer(m))
    hotelMarkersRef.current = {}

    if (interactionMode === "lookup" || interactionMode === "discovery") return

    hotels.filter((h) => h.lat && h.lng).forEach((hotel) => {
      const icon = buildHotelIcon(L, hotel, false)

      const marker = L.marker([hotel.lat, hotel.lng], { icon })
      marker.on("mouseover", () => {
        showHoverCardForMarker(marker, { kind: "hotel", hotel })
      })
      marker.on("mouseout", scheduleHoverClose)
      marker.on("click", () => {
        setHoverCard(null)
        ;(window as any).__voyagerOpenDrawer?.(hotel.name)
      })
      marker.addTo(map)
      hotelMarkersRef.current[hotel.name] = marker
    })
  }, [hotels, interactionMode])

  // Close hover card and any lingering tooltips when the drawer opens
  useEffect(() => {
    const open = !!(selectedPlaceDetail || selectedHotelDetail)
    if (!open) return
    cancelHoverClose()
    setHoverCard(null)
    Object.values(markersRef.current).forEach((m) => m.closeTooltip?.())
    Object.values(hotelMarkersRef.current).forEach((m) => m.closeTooltip?.())
  }, [selectedPlaceDetail, selectedHotelDetail])

  // Highlight selected hotel marker
  useEffect(() => {
    if (typeof window === "undefined") return
    if (interactionMode === "lookup") return
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const L = require("leaflet")
    Object.entries(hotelMarkersRef.current).forEach(([name, marker]) => {
      const isSelected = selectedHotel?.name === name
      const hotel = hotels.find((h) => h.name === name)
      if (!hotel) return
      marker.setIcon(buildHotelIcon(L, hotel, isSelected))
    })
  }, [selectedHotel, hotels, interactionMode])

  // Fly to first place on new search
  useEffect(() => {
    const map = leafletRef.current
    if (!map || !targetLocation) return
    map.flyTo([targetLocation.lat, targetLocation.lng], targetLocation.zoom ?? 13, { duration: 1.5 })
  }, [targetLocation])

  // City-level pin
  useEffect(() => {
    const map = leafletRef.current
    if (!map) return
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const L = require("leaflet")

    if (cityPinMarkerRef.current) {
      map.removeLayer(cityPinMarkerRef.current)
      cityPinMarkerRef.current = null
    }
    if (!cityPin?.lat || !cityPin?.lng) return

    const icon = L.divIcon({
      className: "",
      html: `
        <div class="vp-wrap vp-city">
          <div class="vp-pin vp-pin--city">
            <span class="vp-icon">${categoryIconSvg("landmark")}</span>
          </div>
          <div class="vp-label vp-label--city">${cityPin.name.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>
        </div>
      `,
      iconSize: [180, 64],
      iconAnchor: [22, 22],
    })

    const marker = L.marker([cityPin.lat, cityPin.lng], { icon, zIndexOffset: 1000 })
    marker.on("mouseover", () => {
      showHoverCardForMarker(marker, { kind: "place", place: cityPin })
    })
    marker.on("mouseout", scheduleHoverClose)
    marker.on("click", () => {
      ;(window as any).__voyagerOpenDrawer?.(cityPin.name)
    })
    marker.addTo(map)
    cityPinMarkerRef.current = marker
  }, [cityPin])

  // Pulse + fly-to on hover
  useEffect(() => {
    const all = { ...markersRef.current, ...hotelMarkersRef.current }
    Object.values(all).forEach((m) => { const el = m.getElement(); if (el) el.classList.remove("vp-highlight-flash") })
    if (!hoveredPlaceId) return
    const marker = all[hoveredPlaceId]
    if (!marker) return
    const map = leafletRef.current
    if (map) map.flyTo(marker.getLatLng(), Math.max(map.getZoom(), 14), { duration: 0.7, easeLinearity: 0.4 })
    const el = marker.getElement()
    if (el) {
      el.classList.add("vp-highlight-flash")
      // Auto-remove after one cycle so it doesn't loop
      setTimeout(() => el.classList.remove("vp-highlight-flash"), 900)
    }
  }, [hoveredPlaceId])

  // Destination suggestion pins
  useEffect(() => {
    const map = leafletRef.current
    if (!map) return
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const L = require("leaflet")

    destMarkersRef.current.forEach((m) => map.removeLayer(m))
    destMarkersRef.current = []
    discoveryRouteRef.current.forEach((l) => map.removeLayer(l))
    discoveryRouteRef.current = []
    if (discoveryOriginRef.current) {
      map.removeLayer(discoveryOriginRef.current)
      discoveryOriginRef.current = null
    }

    const valid = destinations.filter((d) => d.lat && d.lng)
    if (!valid.length) return

    const originCode = (tripContext.origin || "LON").toUpperCase()
    const originCoords = getAirportCoords(originCode) ?? getAirportCoords("LON")
    const originLabel = originCode === "LON" ? "London" : originCode

    if (originCoords) {
      const originIcon = L.divIcon({
        className: "",
        html: `<div style="display:flex;align-items:center;gap:6px">
          <div style="flex-shrink:0;width:26px;height:26px;border-radius:50%;background:#13161f;border:2px solid rgba(255,255,255,0.85);display:flex;align-items:center;justify-content:center;box-shadow:0 2px 10px rgba(0,0,0,0.45);font-size:12px">✈️</div>
          <div style="padding:4px 9px;border-radius:7px;background:rgba(19,22,31,0.92);backdrop-filter:blur(6px);color:white;font-size:11px;font-weight:700;white-space:nowrap;box-shadow:0 2px 10px rgba(0,0,0,0.4);border:1px solid rgba(255,255,255,0.12)">Origin · ${originLabel}</div>
        </div>`,
        iconSize: [150, 30],
        iconAnchor: [13, 15],
      })
      discoveryOriginRef.current = L.marker(originCoords, { icon: originIcon }).addTo(map)
    }

    const labelPositions = ["right", "top", "bottom", "left"] as const

    valid.forEach((dest, index) => {
      const markerLabel = dest.name
      const labelPosition = labelPositions[index % labelPositions.length]
      const icon = L.divIcon({
        className: "",
        html: `
          <div class="vp-wrap vp-dest vp-dest--${labelPosition}" data-testid="city-marker-${dest.name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "")}">
            <div class="vp-pin vp-pin--dest">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
              ${dest.rating_count ? `<span class="vp-dest__star">★</span>` : ""}
            </div>
            <div class="vp-label vp-label--dest">${markerLabel.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>
          </div>
        `,
        iconSize: [34, 34],
        iconAnchor: [17, 17],
      })
      const marker = L.marker([dest.lat!, dest.lng!], { icon })
      marker.on("click", () => {
        const store = useTripStore.getState()
        store.setTargetLocation({ lat: dest.lat!, lng: dest.lng! })
        store.setSelectedDestinationDetail(dest)
      })
      marker.addTo(map)
      destMarkersRef.current.push(marker)

      if (originCoords) {
        const route = L.polyline(
          [originCoords, [dest.lat!, dest.lng!]],
          { color: "#5ba3e8", weight: 1.5, opacity: 0.28, dashArray: "5 8" }
        ).addTo(map)
        discoveryRouteRef.current.push(route)
      }
    })

    const allPoints = valid.map((d) => [d.lat!, d.lng!] as [number, number])
    if (originCoords) allPoints.push(originCoords)

    if (allPoints.length > 1) {
      const bounds = L.latLngBounds(allPoints)
      map.fitBounds(bounds, { padding: [120, 120], maxZoom: 4, animate: true, duration: 0.8 })
    }
  }, [destinations, tripContext.origin])

  // Selected discovery destination: light up surrounding highlights
  useEffect(() => {
    const map = leafletRef.current
    if (!map) return
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const L = require("leaflet")

    discoveryHighlightMarkersRef.current.forEach((marker) => map.removeLayer(marker))
    discoveryHighlightMarkersRef.current = []
    discoveryHighlightDecorRef.current.forEach((layer) => map.removeLayer(layer))
    discoveryHighlightDecorRef.current = []
    if (discoveryCityMarkerRef.current) {
      map.removeLayer(discoveryCityMarkerRef.current)
      discoveryCityMarkerRef.current = null
    }

    if (interactionMode !== "discovery" || !pinnedDiscoveryDestination?.lat || !pinnedDiscoveryDestination?.lng) return

    const filteredHighlights =
      discoveryHighlightFilter === "all"
        ? discoveryHighlights
        : discoveryHighlights.filter((place) => classifyDiscoveryCategory(place.category) === discoveryHighlightFilter)

    const anchorCoords: [number, number] = [pinnedDiscoveryDestination.lat, pinnedDiscoveryDestination.lng]
    const cityIcon = L.divIcon({
      className: "",
      html: `
        <div class="vp-wrap vp-anchor">
          <div class="vp-pin vp-pin--anchor">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L9.5 8.5 2 9l6 5.5L6.5 22 12 18l5.5 4L16 14.5 22 9l-7.5-.5L12 2z"/></svg>
          </div>
          <div class="vp-label vp-label--anchor">${pinnedDiscoveryDestination.name.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>
        </div>
      `,
      iconSize: [190, 44],
      iconAnchor: [20, 20],
    })
    discoveryCityMarkerRef.current = L.marker(anchorCoords, { icon: cityIcon, zIndexOffset: 600 }).addTo(map)

    filteredHighlights.slice(0, 10).forEach((place) => {
      const kind = classifyDiscoveryCategory(place.category)
      const pinColor = kind === "restaurants" ? "#f59e0b" : kind === "icons" ? "#fbbf24" : "#3d8cd6"
      const icon = L.divIcon({
        className: "",
        html: `
          <div class="vp-wrap vp-highlight vp-highlight--${kind}" data-testid="place-marker-${place.name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "")}">
            <div class="vp-pin vp-pin--highlight">
              <span class="vp-icon">${categoryIconSvg(place.category)}</span>
            </div>
            <div class="vp-label vp-label--hover">${place.name.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>
          </div>
        `,
        iconSize: [200, 32],
        iconAnchor: [16, 16],
      })
      const marker = L.marker([place.lat, place.lng], { icon, zIndexOffset: 450 })
      marker.on("mouseover", () => {
        showHoverCardForMarker(marker, { kind: "place", place })
      })
      marker.on("mouseout", scheduleHoverClose)
      marker.on("click", () => {
        setSelectedPlaceDetail(place)
        setTargetLocation({ lat: place.lat, lng: place.lng })
      })
      marker.addTo(map)
      discoveryHighlightMarkersRef.current.push(marker)

      const connector = L.polyline(
        [anchorCoords, [place.lat, place.lng]],
        {
          color: pinColor,
          weight: kind === "icons" ? 1.6 : 1.25,
          opacity: kind === "icons" ? 0.3 : 0.22,
          dashArray: kind === "icons" ? "2 6" : "4 8",
        }
      ).addTo(map)
      discoveryHighlightDecorRef.current.push(connector)
    })

    const allPoints = [anchorCoords, ...filteredHighlights.map((place) => [place.lat, place.lng] as [number, number])]
    if (allPoints.length > 1) {
      const bounds = L.latLngBounds(allPoints)
      map.fitBounds(bounds, { padding: [90, 110], maxZoom: 12, animate: true, duration: 0.7 })
    } else {
      map.flyTo(anchorCoords, 11, { animate: true, duration: 0.7 })
    }
  }, [
    interactionMode,
    pinnedDiscoveryDestination,
    discoveryHighlights,
    discoveryHighlightFilter,
    setSelectedPlaceDetail,
    setTargetLocation,
  ])

  // Flight arc on hover
  useEffect(() => {
    const map = leafletRef.current
    if (!map) return
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const L = require("leaflet")

    if (flightArcRef.current) {
      flightArcRef.current.forEach((l: any) => map.removeLayer(l))
      flightArcRef.current = null
    }

    if (interactionMode === "lookup") return
    if (!hoveredFlight?.origin || !hoveredFlight.destination) return

    const orig = hoveredFlight.origin.toUpperCase()
    const dest = hoveredFlight.destination.toUpperCase()
    const coordsA = getAirportCoords(orig)
    const coordsB = getAirportCoords(dest)
    if (!coordsA || !coordsB) return

    const waypoints: { code: string; coords: [number, number]; isHub: boolean }[] = [
      { code: orig, coords: coordsA, isHub: false },
    ]

    const airlineCode = (hoveredFlight.airline_code || "").toUpperCase()
    const hubCode = AIRLINE_HUBS[airlineCode]
    const hubCoords = hubCode ? getAirportCoords(hubCode) : undefined
    const hasStops = (hoveredFlight.stops ?? 0) > 0

    if (hasStops && hubCoords && hubCode !== orig && hubCode !== dest) {
      waypoints.push({ code: hubCode!, coords: hubCoords, isHub: true })
    }
    waypoints.push({ code: dest, coords: coordsB, isHub: false })

    const segments: [number, number][][] = []
    for (let i = 0; i < waypoints.length - 1; i++) {
      const a = waypoints[i].coords
      const b = waypoints[i + 1].coords
      segments.push(greatCirclePoints(a[0], a[1], b[0], b[1]))
    }

    const arcLayers = segments.map((pts) =>
      L.polyline(pts, { color: "#5ba3e8", weight: 2, opacity: 0.85, dashArray: "8 5" })
    )

    const endpointIcon = (label: string) => L.divIcon({
      className: "",
      html: `<div style="display:flex;flex-direction:column;align-items:center;gap:3px">
        <div style="width:10px;height:10px;border-radius:50%;background:#5ba3e8;border:2px solid white;box-shadow:0 0 8px rgba(91,163,232,0.8)"></div>
        <div style="background:rgba(0,0,0,0.7);color:white;font-size:10px;font-weight:700;padding:1px 5px;border-radius:4px;white-space:nowrap">${label}</div>
      </div>`,
      iconSize: [40, 30],
      iconAnchor: [20, 5],
    })

    const hubIcon = (label: string) => L.divIcon({
      className: "",
      html: `<div style="display:flex;flex-direction:column;align-items:center;gap:3px">
        <div style="width:14px;height:14px;border-radius:50%;background:rgba(91,163,232,0.15);border:2px dashed #5ba3e8;display:flex;align-items:center;justify-content:center">
          <div style="width:4px;height:4px;border-radius:50%;background:#5ba3e8"></div>
        </div>
        <div style="background:rgba(91,163,232,0.9);color:white;font-size:9px;font-weight:700;padding:1px 5px;border-radius:4px;white-space:nowrap">⇅ ${label}</div>
      </div>`,
      iconSize: [50, 30],
      iconAnchor: [25, 7],
    })

    const planeIcon = (mid: [number, number], next: [number, number]) => {
      const angle = Math.atan2(next[1] - mid[1], next[0] - mid[0]) * (180 / Math.PI)
      return L.divIcon({
        className: "",
        html: `<div style="font-size:18px;transform:rotate(${angle}deg);filter:drop-shadow(0 0 6px rgba(91,163,232,0.9))">✈</div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      })
    }

    const firstSeg = segments[0]
    const planeMid = firstSeg[Math.floor(firstSeg.length / 2)]
    const planeNext = firstSeg[Math.floor(firstSeg.length / 2) + 1] ?? planeMid
    const planeMarker = L.marker(planeMid, { icon: planeIcon(planeMid, planeNext), interactive: false })

    const layers: any[] = [...arcLayers, planeMarker]
    waypoints.forEach((wp) => {
      const icon = wp.isHub ? hubIcon(wp.code) : endpointIcon(wp.code)
      layers.push(L.marker(wp.coords, { icon, interactive: false }))
    })

    layers.forEach((l) => l.addTo(map))
    flightArcRef.current = layers

    const bounds = L.latLngBounds(waypoints.map((w) => w.coords))
    map.fitBounds(bounds, { padding: [60, 60], maxZoom: 7, animate: true, duration: 0.8 })
  }, [hoveredFlight, interactionMode])

  // Route polyline for selected itinerary day
  useEffect(() => {
    const map = leafletRef.current
    if (routeRef.current && map) { map.removeLayer(routeRef.current); routeRef.current = null }
    if (interactionMode === "lookup") return
    if (!selectedItineraryDay || !itinerary || !map) return
    const day = itinerary.days.find((d) => d.day_number === selectedItineraryDay)
    if (!day) return
    const coords = day.events
      .filter((e) => e.coordinates)
      .map((e) => [e.coordinates!.lat, e.coordinates!.lng] as [number, number])
    if (coords.length < 2) return
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const L = require("leaflet")
    const poly = L.polyline(coords, { color: "#3d8cd6", weight: 3, opacity: 0.75, dashArray: "6 5" })
    poly.addTo(map)
    routeRef.current = poly
    map.fitBounds(L.latLngBounds(coords), { padding: [50, 50] })
  }, [selectedItineraryDay, itinerary, interactionMode])

  // Itinerary-aware markers
  useEffect(() => {
    const map = leafletRef.current
    if (!map) return
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const L = require("leaflet")

    itineraryMarkersRef.current.forEach((marker) => map.removeLayer(marker))
    itineraryMarkersRef.current = []

    if (!itinerary || interactionMode === "lookup" || interactionMode === "discovery") return

    const markerEntries = selectedItineraryDay
      ? (itinerary.days.find((day) => day.day_number === selectedItineraryDay)?.events ?? [])
          .filter((event) => event.coordinates)
          .map((event, index) => ({
            key: `${selectedItineraryDay}-${event.time}-${event.title}-${index}`,
            label: `${index + 1}`,
            title: event.title,
            coords: event.coordinates!,
            event,
            day: itinerary.days.find((d) => d.day_number === selectedItineraryDay)!,
          }))
      : itinerary.days
          .map((day) => {
            const firstEvent = day.events.find((event) => event.coordinates)
            if (!firstEvent?.coordinates) return null
            return {
              key: `day-${day.day_number}`,
              label: `${day.day_number}`,
              title: day.label,
              coords: firstEvent.coordinates,
              event: firstEvent,
              day,
            }
          })
          .filter(Boolean)

    markerEntries.forEach((entry) => {
      if (!entry) return
      const isSelected = selectedItineraryEventKey === entry.key
      const icon = L.divIcon({
        className: "",
        html: `
          <div class="vp-wrap vp-day${isSelected ? " is-selected" : ""}">
            <div class="vp-pin vp-pin--day">
              <span class="vp-day__num">${entry.label}</span>
            </div>
            ${isSelected
              ? `<div class="vp-label vp-label--inline">${entry.title.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>`
              : `<div class="vp-label vp-label--hover">${entry.title.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>`}
          </div>
        `,
        iconSize: [220, 32],
        iconAnchor: [16, 16],
      })

      const marker = L.marker([entry.coords.lat, entry.coords.lng], { icon })
      marker.on("click", () => {
        setSelectedItineraryEventKey(entry.key)
        const resolved = resolveItineraryEventEntity({
          event: entry.event,
          dayLabel: entry.day.label,
          city: entry.day.city,
          date: entry.day.date,
          places,
          hotels,
        })

        if (!selectedItineraryDay) setSelectedItineraryDay(entry.day.day_number)

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
      })
      marker.addTo(map)
      itineraryMarkersRef.current.push(marker)
    })
  }, [
    itinerary,
    selectedItineraryDay,
    selectedItineraryEventKey,
    interactionMode,
    places,
    hotels,
    setSelectedHotelDetail,
    setSelectedItineraryEventDetail,
    setSelectedItineraryDay,
    setSelectedItineraryEventKey,
    setSelectedPlaceDetail,
    setTargetLocation,
  ])

  const hasMarkers =
    destinations.some((d) => d.lat && d.lng) ||
    discoveryHighlights.some((p) => p.lat && p.lng) ||
    places.some((p) => p.lat && p.lng) ||
    hotels.some((h) => h.lat && h.lng) ||
    itinerary?.days.some((day) => day.events.some((event) => !!event.coordinates)) ||
    false

  return (
    <div className="relative h-full w-full overflow-hidden">
      <div ref={mapRef} className="w-full h-full" data-testid="map-container" />

      <PlaceDetailDrawer />
      <DestinationDetailPanel />


      {/* Weather chip */}
      {interactionMode !== "discovery" && !selectedDestinationDetail && weather.length > 0 && isFiniteWeatherDay(weather[0]) && (
        <div
          className="glass-widget absolute top-4 left-4 z-[1000]"
          style={{ padding: "8px 14px 8px 12px", display: "flex", alignItems: "center", gap: "10px" }}
        >
          <span style={{ fontSize: "22px", lineHeight: 1 }}>{weather[0].weather_icon}</span>
          <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.2 }}>
            <span style={{ fontSize: "14px", fontWeight: 700, color: "var(--text)" }}>
              {Math.round(weather[0].temp_high_c)}°
              <span style={{ color: "var(--text-muted)", fontWeight: 500, marginLeft: 4, fontSize: "12px" }}>
                / {Math.round(weather[0].temp_low_c)}°
              </span>
            </span>
            <span style={{ fontSize: "10.5px", color: "var(--text-muted)", textTransform: "capitalize", letterSpacing: "0.01em" }}>
              {weather[0].condition}
            </span>
          </div>
        </div>
      )}

      {/* Budget widget */}
      {budget && (
        <div className="glass-widget absolute bottom-5 left-4 z-[1000]" style={{ minWidth: "170px" }}>
          <div className={`flex items-center justify-between px-3 pt-2.5 ${budgetOpen ? "pb-1" : "pb-2.5"}`}>
            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)", letterSpacing: "0.1em" }}>
              Budget
            </p>
            <button onClick={() => setBudgetOpen((v) => !v)} className="text-xs cursor-pointer transition-opacity hover:opacity-70" style={{ color: "var(--text-muted)" }}>
              {budgetOpen ? "−" : "+"}
            </button>
          </div>
          {budgetOpen && (
            <div className="px-3 pb-3">
              {Object.entries(budget.breakdown).map(([k, v]) => (
                <div key={k} className="flex justify-between text-xs mb-1">
                  <span className="capitalize" style={{ color: "var(--text-muted)" }}>{k.replace("_gbp", "")}</span>
                  <span style={{ color: "var(--text)" }}>£{v.toLocaleString()}</span>
                </div>
              ))}
              <div className="border-t mt-1.5 pt-1.5 flex justify-between text-xs font-bold" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
                <span style={{ color: "var(--text)" }}>Total</span>
                <span style={{ color: budget.within_budget === false ? "#f59e0b" : "#22c55e" }}>
                  £{budget.total_gbp.toLocaleString()}
                </span>
              </div>
              {budget.within_budget === false && (
                <p className="text-xs mt-1" style={{ color: "#f59e0b" }}>
                  £{budget.over_by_gbp.toLocaleString()} over
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Currency widget */}
      {currency && (
        <div className="glass-widget absolute bottom-5 right-4 z-[1000]" style={{ minWidth: "155px" }}>
          <div className={`flex items-center justify-between px-3 pt-2.5 ${currencyOpen ? "pb-1" : "pb-2.5"}`}>
            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)", letterSpacing: "0.1em" }}>
              Currency
            </p>
            <button onClick={() => setCurrencyOpen((v) => !v)} className="text-xs cursor-pointer transition-opacity hover:opacity-70" style={{ color: "var(--text-muted)" }}>
              {currencyOpen ? "−" : "+"}
            </button>
          </div>
          {currencyOpen && (
            <div className="px-3 pb-3">
              <p className="text-sm font-bold mb-1.5" style={{ color: "var(--text)" }}>
                1 {currency.base} = {currency.rate} {currency.target}
              </p>
              {Object.entries(currency.conversions).map(([k, v]) => (
                <div key={k} className="flex justify-between text-xs mb-0.5">
                  <span style={{ color: "var(--text-muted)" }}>{k}</span>
                  <span style={{ color: "var(--text)" }}>{v.toLocaleString()} {currency.target}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Empty state */}
      {!hasMarkers && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="glass-widget px-5 py-3 text-sm" style={{ color: "var(--text-muted)" }}>
            {interactionMode === "discovery"
              ? "Choose a destination card to scatter iconic landmarks, sights, and food spots across the map"
              : "Places appear on the map as the agent searches"}
          </div>
        </div>
      )}
    </div>
  )
}
