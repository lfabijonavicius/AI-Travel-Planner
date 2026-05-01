"use client"

import { useEffect, useRef, useState } from "react"
import "leaflet/dist/leaflet.css"
import { useTripStore } from "@/hooks/useTripStore"
import { PlaceDetailDrawer } from "./PlaceDetailDrawer"
import { DestinationDetailPanel } from "./DestinationDetailPanel"
import { categoryIcon } from "@/lib/placeIcon"
import { resolveItineraryEventEntity } from "@/lib/itineraryEventResolver"
import { PlaceResult } from "@/types"
import { buildPlaceMiniZones, classifyPlaceBrowseKind } from "@/lib/placeBrowse"

const CURRENCY_SYMBOLS: Record<string, string> = {
  GBP: "£", EUR: "€", USD: "$", JPY: "¥", CHF: "Fr",
  SEK: "kr", NOK: "kr", DKK: "kr", PLN: "zł", CZK: "Kč",
  HUF: "Ft", TRY: "₺", AED: "د.إ", THB: "฿", SGD: "S$",
}
function currencySymbol(code: string) {
  return CURRENCY_SYMBOLS[code?.toUpperCase()] ?? code ?? "£"
}

function starsHtml(n: number, max = 5) {
  const full = Math.min(Math.round(n), max)
  return `<span style="color:#f59e0b;font-size:11px;letter-spacing:1px">${"★".repeat(full)}${"☆".repeat(max - full)}</span>`
}
function ratingStarsHtml(rating: number) {
  const full = Math.floor(rating)
  const half = rating - full >= 0.25
  const empty = 5 - full - (half ? 1 : 0)
  return `<span style="color:#f59e0b;font-size:11px;letter-spacing:0.5px">${"★".repeat(full)}${half ? "⯨" : ""}${"☆".repeat(empty)}</span>`
}


// IATA code → [lat, lng]
const AIRPORT_COORDS: Record<string, [number, number]> = {
  // UK & Ireland
  LHR:[51.47,-0.46],LGW:[51.15,-0.18],STN:[51.88,0.24],LTN:[51.87,-0.37],
  LCY:[51.50,0.05],MAN:[53.35,-2.27],BHX:[52.45,-1.73],LPL:[53.33,-2.85],
  EDI:[55.95,-3.37],GLA:[55.87,-4.43],BRS:[51.38,-2.72],NCL:[54.99,-1.69],
  BHD:[54.62,-5.87],LON:[51.51,-0.13],
  // Europe
  CDG:[49.01,2.55],ORY:[48.72,2.36],PAR:[48.86,2.35],
  AMS:[52.31,4.76],BRU:[50.90,4.48],
  FRA:[50.03,8.57],MUC:[48.35,11.79],BER:[52.36,13.50],DUS:[51.29,6.77],
  HAM:[53.63,9.99],STR:[48.69,9.22],CGN:[50.86,7.14],
  FCO:[41.80,12.25],MXP:[45.63,8.72],VCE:[45.50,12.35],NAP:[40.88,14.29],
  ROM:[41.90,12.50],MIL:[45.47,9.19],
  MAD:[40.49,-3.57],BCN:[41.30,2.08],PMI:[39.55,2.74],SVQ:[37.42,-5.90],
  VLC:[39.49,-0.48],AGP:[36.67,-4.50],
  LIS:[38.78,-9.14],OPO:[41.24,-8.68],
  ZRH:[47.46,8.55],GVA:[46.24,6.11],BSL:[47.59,7.53],
  VIE:[48.11,16.57],PRG:[50.10,14.27],BUD:[47.44,19.26],
  WAW:[52.17,20.97],KRK:[50.08,19.78],GDN:[54.38,18.47],
  ARN:[59.65,17.92],CPH:[55.62,12.66],OSL:[60.19,11.10],HEL:[60.32,24.96],
  TLL:[59.41,24.83],RIX:[56.92,23.97],VNO:[54.63,25.29],KUN:[54.96,24.08],
  ATH:[37.94,23.95],SKG:[40.52,22.97],HER:[35.34,25.18],CFU:[39.60,19.91],
  IST:[41.26,28.74],SAW:[40.90,29.31],ADB:[38.29,27.16],AYT:[36.90,30.80],
  BEG:[44.82,20.29],SOF:[42.70,23.41],OTP:[44.57,26.10],
  DUB:[53.43,-6.24],ORK:[51.84,-8.49],SNN:[52.70,-8.92],
  // Middle East & Africa
  DXB:[25.25,55.36],AUH:[24.44,54.65],DOH:[25.27,51.61],
  TLV:[31.99,34.90],AMM:[31.72,35.99],BEY:[33.82,35.49],
  CAI:[30.12,31.41],CMN:[33.37,-7.59],TUN:[36.85,10.23],
  NBO:[-1.32,36.93],ADD:[-8.97,38.80],JNB:[-26.13,28.24],CPT:[-33.97,18.60],
  LOS:[6.58,3.32],ACC:[5.61,-0.17],DAK:[14.74,-17.49],
  // Asia
  DEL:[28.56,77.10],BOM:[19.09,72.87],BLR:[13.20,77.70],MAA:[12.99,80.17],
  CCU:[22.65,88.45],HYD:[17.23,78.43],
  CMB:[7.18,79.88],KTM:[27.70,85.36],DAC:[23.84,90.40],
  KHI:[24.91,67.16],ISB:[33.62,73.10],LHE:[31.52,74.40],
  SIN:[1.36,103.99],KUL:[2.75,101.71],CGK:[-6.13,106.66],
  BKK:[13.69,100.75],HKT:[8.11,98.31],CNX:[18.77,98.96],
  SGN:[10.82,106.66],HAN:[21.22,105.81],RGN:[16.91,96.13],
  MNL:[14.51,121.02],CEB:[10.31,123.98],
  PEK:[40.08,116.60],PVG:[31.14,121.80],CAN:[23.39,113.30],
  CTU:[30.57,103.95],XIY:[34.44,108.75],SHA:[31.19,121.34],
  HKG:[22.31,113.92],MFM:[22.15,113.59],
  ICN:[37.46,126.44],GMP:[37.56,126.80],SEL:[37.57,126.98],
  HND:[35.55,139.78],NRT:[35.77,140.39],TYO:[35.68,139.69],
  NGO:[34.86,136.80],KIX:[34.43,135.24],CTS:[42.78,141.69],
  TPE:[25.08,121.23],KHH:[22.58,120.35],
  // Americas
  JFK:[40.64,-73.78],EWR:[40.69,-74.17],LGA:[40.78,-73.87],NYC:[40.71,-74.01],
  BOS:[42.36,-71.01],ORD:[41.97,-87.91],MDW:[41.79,-87.75],
  LAX:[33.94,-118.41],SFO:[37.62,-122.38],LAS:[36.08,-115.15],
  MIA:[25.80,-80.29],ATL:[33.64,-84.43],DFW:[32.90,-97.04],
  IAH:[29.98,-95.34],SEA:[47.45,-122.31],DEN:[39.86,-104.67],
  PHX:[33.44,-112.01],DTW:[42.21,-83.35],MSP:[44.88,-93.22],
  YYZ:[43.68,-79.63],YVR:[49.19,-123.18],YUL:[45.47,-73.74],
  MEX:[19.44,-99.07],GDL:[20.52,-103.31],CUN:[21.04,-86.87],
  BOG:[4.70,-74.15],LIM:[-12.02,-77.11],SCL:[-33.39,-70.79],
  GRU:[-23.43,-46.47],GIG:[-22.81,-43.25],EZE:[-34.82,-58.54],
  // Pacific & Oceania
  SYD:[-33.95,151.18],MEL:[-37.67,144.84],BNE:[-27.38,153.12],
  PER:[-31.94,115.97],ADL:[-34.95,138.53],AKL:[-37.01,174.79],
  CHC:[-43.49,172.53],WLG:[-41.33,174.81],NAN:[-17.76,177.44],
}

function buildHotelIcon(L: any, hotel: { name: string; price_per_night_gbp: number; currency: string }, isSelected: boolean) {
  const sym = CURRENCY_SYMBOLS[(hotel.currency ?? "").toUpperCase()] ?? hotel.currency ?? "£"
  const iconSize = isSelected ? 38 : 32
  const iconStyle = isSelected
    ? `flex-shrink:0;width:${iconSize}px;height:${iconSize}px;border-radius:9px;background:#185FA5;border:2.5px solid white;display:flex;align-items:center;justify-content:center;font-size:17px;box-shadow:0 0 0 5px rgba(61,140,214,0.3),0 4px 20px rgba(24,95,165,0.7)`
    : `flex-shrink:0;width:${iconSize}px;height:${iconSize}px;border-radius:8px;background:#13161f;border:2px solid #185FA5;display:flex;align-items:center;justify-content:center;font-size:15px;box-shadow:0 2px 12px rgba(0,0,0,0.6)`
  const labelBg = isSelected ? "#185FA5" : "rgba(19,22,31,0.92)"
  const labelBorder = isSelected ? "rgba(255,255,255,0.3)" : "rgba(24,95,165,0.5)"
  const priceLabel = `<div style="padding:4px 9px;border-radius:7px;background:${labelBg};backdrop-filter:blur(6px);color:white;font-size:12px;font-weight:700;white-space:nowrap;box-shadow:0 2px 10px rgba(0,0,0,0.4);border:1px solid ${labelBorder};letter-spacing:-0.01em">${sym}${hotel.price_per_night_gbp}</div>`
  const nameLabel = isSelected
    ? `<div style="max-width:150px;padding:3px 8px;border-radius:6px;background:rgba(0,0,0,0.75);color:rgba(255,255,255,0.92);font-size:10px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;border:1px solid rgba(255,255,255,0.1);margin-top:3px">${hotel.name.length > 20 ? hotel.name.slice(0, 18) + "…" : hotel.name}</div>`
    : ""
  const labelStack = nameLabel
    ? `<div style="display:flex;flex-direction:column;gap:2px">${priceLabel}${nameLabel}</div>`
    : priceLabel
  const anchor = Math.floor(iconSize / 2)
  return L.divIcon({
    className: "",
    html: `<div style="display:flex;align-items:center;gap:6px">
      <div class="voyager-pin" style="${iconStyle}">🏨</div>
      ${labelStack}
    </div>`,
    iconSize: [220, iconSize + (isSelected ? 24 : 4)],
    iconAnchor: [anchor, anchor],
  })
}

// IATA airline code → primary hub airport code (used to route stopover arcs)
const AIRLINE_HUBS: Record<string, string> = {
  SU: "SVO", BA: "LHR", LH: "FRA", JL: "HND", NH: "NRT",
  EK: "DXB", QR: "DOH", TK: "IST", AF: "CDG", KL: "AMS",
  IB: "MAD", FR: "DUB", U2: "LGW", VS: "LHR",
  AA: "DFW", UA: "ORD", DL: "ATL",
  CX: "HKG", SQ: "SIN", QF: "SYD",
  CZ: "CAN", MU: "PVG", ZH: "SZX", CA: "PEK", MH: "KUL",
  OZ: "ICN", KE: "ICN", CI: "TPE",
  WY: "MCT", W9: "BUD",
  ET: "ADD", KQ: "NBO", SA: "JNB", MS: "CAI",
  AI: "DEL", "6E": "DEL", TG: "BKK", VN: "SGN", PR: "MNL",
}

// Moscow SVO is outside the original AIRPORT_COORDS — add the hub airports we reference
const HUB_COORDS: Record<string, [number, number]> = {
  SVO: [55.97, 37.41],
  SZX: [22.64, 113.81],
  MCT: [23.59, 58.28],
}

function getAirportCoords(code: string): [number, number] | undefined {
  return AIRPORT_COORDS[code] ?? HUB_COORDS[code]
}

function greatCirclePoints(lat1: number, lng1: number, lat2: number, lng2: number, n = 60): [number, number][] {
  const toR = (d: number) => (d * Math.PI) / 180
  const toD = (r: number) => (r * 180) / Math.PI
  const φ1 = toR(lat1), λ1 = toR(lng1), φ2 = toR(lat2), λ2 = toR(lng2)
  const dσ = Math.acos(
    Math.max(-1, Math.min(1, Math.sin(φ1) * Math.sin(φ2) + Math.cos(φ1) * Math.cos(φ2) * Math.cos(λ2 - λ1)))
  )
  if (dσ < 0.0001) return [[lat1, lng1], [lat2, lng2]]
  return Array.from({ length: n + 1 }, (_, i) => {
    const t = i / n
    const A = Math.sin((1 - t) * dσ) / Math.sin(dσ)
    const B = Math.sin(t * dσ) / Math.sin(dσ)
    const x = A * Math.cos(φ1) * Math.cos(λ1) + B * Math.cos(φ2) * Math.cos(λ2)
    const y = A * Math.cos(φ1) * Math.sin(λ1) + B * Math.cos(φ2) * Math.sin(λ2)
    const z = A * Math.sin(φ1) + B * Math.sin(φ2)
    return [toD(Math.atan2(z, Math.sqrt(x * x + y * y))), toD(Math.atan2(y, x))] as [number, number]
  })
}

function isFiniteWeatherDay(day: { temp_high_c: number; temp_low_c: number } | undefined): boolean {
  return !!day && Number.isFinite(day.temp_high_c) && Number.isFinite(day.temp_low_c)
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"
const discoveryHighlightsCache = new Map<string, PlaceResult[]>()

function discoveryKey(name: string, country?: string) {
  return `${name}::${country || ""}`.toLowerCase()
}

function classifyDiscoveryCategory(category: string) {
  if (/restaurant|food|cafe|bar|bistro|bakery/i.test(category)) return "restaurants"
  if (/landmark|monument|historic|heritage|palace|castle|fortress|citadel|ruins|icon/i.test(category)) return "icons"
  return "attractions"
}

function distanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
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

function buildInfoPlaceIcon(L: any, place: PlaceResult, accent: string) {
  const glyph = categoryIcon(place.category)
  const kind = classifyPlaceBrowseKind(place)
  const pinColor = accent || (kind === "restaurants" ? "#f59e0b" : kind === "icons" ? "#fbbf24" : "#3d8cd6")
  return L.divIcon({
    className: "",
    html: `<div style="display:flex;align-items:center;gap:6px">
      <div class="voyager-pin" style="flex-shrink:0;width:28px;height:28px;border-radius:999px;background:rgba(15,22,35,0.95);border:2px solid ${pinColor};display:flex;align-items:center;justify-content:center;font-size:13px;box-shadow:0 4px 16px rgba(0,0,0,0.45)">${glyph}</div>
      <div style="max-width:160px;padding:4px 9px;border-radius:8px;background:rgba(15,22,35,0.94);backdrop-filter:blur(8px);color:white;font-size:11px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;box-shadow:0 2px 10px rgba(0,0,0,0.36);border:1px solid rgba(255,255,255,0.12)">${place.name}</div>
    </div>`,
    iconSize: [210, 28],
    iconAnchor: [14, 14],
  })
}

function buildInfoHeroPlaceIcon(L: any, place: PlaceResult, accent: string) {
  const glyph = categoryIcon(place.category)
  return L.divIcon({
    className: "",
    html: `<div style="display:flex;align-items:center;gap:7px">
      <div class="voyager-pin" style="flex-shrink:0;width:34px;height:34px;border-radius:999px;background:rgba(15,22,35,0.98);border:2px solid ${accent};display:flex;align-items:center;justify-content:center;font-size:15px;box-shadow:0 0 0 6px ${accent}22,0 8px 22px rgba(0,0,0,0.46)">${glyph}</div>
      <div style="max-width:170px;padding:5px 10px;border-radius:9px;background:rgba(15,22,35,0.96);backdrop-filter:blur(10px);color:white;font-size:11px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;box-shadow:0 8px 22px rgba(0,0,0,0.35);border:1px solid ${accent}44">${place.name}</div>
    </div>`,
    iconSize: [220, 34],
    iconAnchor: [17, 17],
  })
}

function buildInfoSecondaryPlaceIcon(L: any, place: PlaceResult, accent: string) {
  const glyph = categoryIcon(place.category)
  return L.divIcon({
    className: "",
    html: `<div class="voyager-pin" style="width:20px;height:20px;border-radius:999px;background:rgba(15,22,35,0.94);border:2px solid ${accent};display:flex;align-items:center;justify-content:center;font-size:10px;box-shadow:0 4px 12px rgba(0,0,0,0.4)">${glyph}</div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  })
}

function buildInfoZoneIcon(
  L: any,
  zone: {
    title: string
    subtitle: string
    accent: string
  },
  options?: {
    muted?: boolean
    badge?: string | null
  }
) {
  const muted = options?.muted ?? false
  const badge = options?.badge
  return L.divIcon({
    className: "",
    html: `<div style="display:flex;flex-direction:column;align-items:flex-start;gap:4px;opacity:${muted ? 0.45 : 1}">
      <div style="padding:5px 10px;border-radius:10px;background:rgba(15,22,35,0.96);backdrop-filter:blur(10px);color:white;font-size:11px;font-weight:800;white-space:nowrap;box-shadow:0 8px 24px rgba(0,0,0,0.34);border:1px solid ${zone.accent}44">${zone.title}</div>
      <div style="display:flex;align-items:center;gap:6px;margin-left:6px">
        <div style="padding:2px 7px;border-radius:999px;background:${zone.accent}18;color:${zone.accent};font-size:10px;font-weight:700;border:1px solid ${zone.accent}33">${zone.subtitle}</div>
        ${badge ? `<div style="padding:2px 7px;border-radius:999px;background:rgba(255,255,255,0.06);color:rgba(255,255,255,0.76);font-size:10px;font-weight:700;border:1px solid rgba(255,255,255,0.12)">${badge}</div>` : ""}
      </div>
    </div>`,
    iconSize: [190, 44],
    iconAnchor: [12, 12],
  })
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

  const [budgetOpen,   setBudgetOpen]   = useState(false)
  const [currencyOpen, setCurrencyOpen] = useState(false)

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
    setSelectedPlaceDetail, setSelectedHotelDetail, setSelectedItineraryEventDetail, setTargetLocation, setSelectedItineraryDay, setSelectedItineraryEventKey,
    setDiscoveryHighlights, setDiscoveryHighlightsLoading,
    tripContext,
    interactionMode,
    hoveredBrowseSection,
    focusedBrowseSection,
    setFocusedBrowseSection,
  } = useTripStore()

  const destMarkersRef = useRef<any[]>([])

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
    /** Scroll the left pane to the card for this place/hotel */
    ;(window as any).__voyagerScrollToCard = (name: string) => {
      const el =
        document.querySelector(`[data-place-name="${CSS.escape(name)}"]`) ??
        document.querySelector(`[data-hotel-name="${CSS.escape(name)}"]`)
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" })
        // Brief highlight flash
        ;(el as HTMLElement).style.transition = "box-shadow 0.3s"
        ;(el as HTMLElement).style.boxShadow = "0 0 0 2px #3d8cd6, 0 8px 32px rgba(61,140,214,0.3)"
        setTimeout(() => { (el as HTMLElement).style.boxShadow = "" }, 1200)
      }
    }
    /** Open the rich detail drawer for a place by name */
    ;(window as any).__voyagerOpenDrawer = (name: string) => {
      const store = useTripStore.getState()
      const place = store.places.find((p) => p.name === name)
      if (place) { store.setSelectedPlaceDetail(place); return }
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
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const L = require("leaflet")
    const map = L.map(mapRef.current, { center: [48, 12], zoom: 4, zoomControl: false })
    L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
      { attribution: "© CartoDB", subdomains: "abcd", maxZoom: 19 }
    ).addTo(map)
    L.control.zoom({ position: "topright" }).addTo(map)
    map.on("click", () => {
      useTripStore.getState().setFocusedBrowseSection(null)
    })
    leafletRef.current = map
    return () => { map.remove(); leafletRef.current = null }
  }, [])

  // Discovery highlights for the selected destination
  useEffect(() => {
    if (interactionMode !== "discovery" || !selectedDestinationDetail) {
      setDiscoveryHighlights([])
      setDiscoveryHighlightsLoading(false)
      return
    }

    const destinationQuery = [selectedDestinationDetail.name, selectedDestinationDetail.country].filter(Boolean).join(", ")
    const cacheKey = discoveryKey(selectedDestinationDetail.name, selectedDestinationDetail.country)
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
    selectedDestinationDetail,
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
        const zoneCircle = L.circle([zone.centroid.lat, zone.centroid.lng], {
          radius: zone.radiusMeters,
          color: zone.accent,
          weight: isFocused ? 1.1 : 0.8,
          opacity: isFocused ? 0.26 : 0.08,
          fillColor: zone.accent,
          fillOpacity: isFocused ? (isOutlier ? 0.04 : 0.08) : 0.03,
          dashArray: isOutlier ? "6 8" : undefined,
        }).addTo(map)
        infoDecorRef.current.push(zoneCircle)

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
            const reviewWord = place.rating != null
              ? (place.rating >= 4.5 ? "Excellent" : place.rating >= 4.0 ? "Very Good" : place.rating >= 3.5 ? "Good" : "Decent")
              : ""
            const kind = classifyPlaceBrowseKind(place)
            const tooltipHtml = `
              <div class="voyager-quickview">
                <div class="qv-photo">
                  ${place.photo_url
                    ? `<img src="${place.photo_url}" alt=""/>`
                    : `<div class="qv-photo-empty">${categoryIcon(place.category)}</div>`
                  }
                  <span class="qv-tag">${categoryIcon(place.category)} ${kind === "restaurants" ? "Food" : kind === "icons" ? "Iconic place" : "Sight"}</span>
                  ${place.rating != null ? `<span class="qv-rating"><span class="qv-star">★</span>${place.rating.toFixed(1)}</span>` : ""}
                  ${place.open_now === true
                    ? `<span class="qv-status is-open">Open now</span>`
                    : place.open_now === false
                      ? `<span class="qv-status is-closed">Closed</span>`
                      : ""}
                </div>
                <div class="qv-body">
                  <div class="qv-title">${place.name}</div>
                  <div class="qv-meta">
                    ${place.rating != null ? `<span>${reviewWord}</span><span class="qv-dot">·</span>` : ""}
                    ${place.price_level ? `<span class="qv-price">${place.price_level}</span>` : `<span style="opacity:0.7">Open detail</span>`}
                  </div>
                  <div class="qv-hint"><span>Open detail</span><span>→</span></div>
                </div>
              </div>`

            const marker = L.marker([place.lat, place.lng], {
              icon,
              zIndexOffset: isHero ? 420 : 300,
            })
            marker.bindTooltip(tooltipHtml, {
              direction: "top",
              offset: [0, -8],
              className: "voyager-quickview-wrap",
              opacity: 1,
              sticky: false,
            })
            marker.on("tooltipopen", () => {
              const s = useTripStore.getState()
              if (s.selectedPlaceDetail || s.selectedHotelDetail) marker.closeTooltip()
            })
            marker.on("click", () => {
              marker.closeTooltip()
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
      const icon_emoji = categoryIcon(place.category)
      const shortName = place.name.length > 26 ? place.name.slice(0, 24) + "…" : place.name
      const pinCircle = isPinned
        ? `<div class="voyager-pin" style="flex-shrink:0;width:32px;height:32px;border-radius:50%;background:#185FA5;border:2.5px solid white;display:flex;align-items:center;justify-content:center;font-size:14px;box-shadow:0 2px 12px rgba(24,95,165,0.6)">✓</div>`
        : `<div class="voyager-pin" style="flex-shrink:0;width:32px;height:32px;border-radius:50%;background:#13161f;border:2.5px solid #3d8cd6;display:flex;align-items:center;justify-content:center;font-size:14px;box-shadow:0 2px 10px rgba(0,0,0,0.5)">${icon_emoji}</div>`
      const labelHtml = isPinned
        ? `<div style="padding:4px 9px;border-radius:7px;background:rgba(24,95,165,0.92);backdrop-filter:blur(6px);color:white;font-size:11px;font-weight:600;white-space:nowrap;box-shadow:0 2px 10px rgba(0,0,0,0.4);border:1px solid rgba(255,255,255,0.15);letter-spacing:-0.01em">${shortName}</div>`
        : ""
      const icon = L.divIcon({
        className: "",
        html: `<div style="display:flex;align-items:center;gap:6px">${pinCircle}${labelHtml}</div>`,
        iconSize: [isPinned ? 240 : 32, 34],
        iconAnchor: [16, 17],
      })

      const reviewWord = place.rating != null
        ? (place.rating >= 4.5 ? "Excellent" : place.rating >= 4.0 ? "Very Good" : place.rating >= 3.5 ? "Good" : "Decent")
        : ""
      const tooltipHtml = `
        <div class="voyager-quickview">
          <div class="qv-photo">
            ${place.photo_url
              ? `<img src="${place.photo_url}" alt=""/>`
              : `<div class="qv-photo-empty">${icon_emoji}</div>`
            }
            <span class="qv-tag">${icon_emoji} ${place.category}</span>
            ${place.rating != null ? `<span class="qv-rating"><span class="qv-star">★</span>${place.rating.toFixed(1)}</span>` : ""}
            ${place.open_now === true
              ? `<span class="qv-status is-open">Open now</span>`
              : place.open_now === false
                ? `<span class="qv-status is-closed">Closed</span>`
                : ""}
          </div>
          <div class="qv-body">
            <div class="qv-title">${place.name}</div>
            <div class="qv-meta">
              ${place.rating != null ? `<span>${reviewWord}</span><span class="qv-dot">·</span>` : ""}
              ${place.price_level ? `<span class="qv-price">${place.price_level}</span>` : `<span style="opacity:0.7">View details</span>`}
            </div>
            <div class="qv-hint"><span>Click for details</span><span>→</span></div>
          </div>
        </div>`

      const marker = L.marker([place.lat, place.lng], { icon })
      marker.bindTooltip(tooltipHtml, {
        direction: "top",
        offset: [0, -8],
        className: "voyager-quickview-wrap",
        opacity: 1,
        sticky: false,
      })
      marker.on("tooltipopen", () => {
        const s = useTripStore.getState()
        if (s.selectedPlaceDetail || s.selectedHotelDetail) marker.closeTooltip()
      })
      marker.on("click", () => {
        marker.closeTooltip()
        ;(window as any).__voyagerOpenDrawer?.(place.name)
      })
      // Pinned places bypass the cluster so the tick pin is always visible
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
      const sym = currencySymbol(hotel.currency)
      const icon = buildHotelIcon(L, hotel, false)

      const tooltipHtml = `
        <div class="voyager-quickview">
          <div class="qv-photo">
            ${hotel.photo_url
              ? `<img src="${hotel.photo_url}" alt=""/>`
              : `<div class="qv-photo-empty">🏨</div>`
            }
            <span class="qv-tag">🏨 Hotel</span>
            ${hotel.review_score != null
              ? `<span class="qv-rating"><span class="qv-star">★</span>${hotel.review_score}</span>`
              : ""}
          </div>
          <div class="qv-body">
            <div class="qv-title">${hotel.name}</div>
            <div class="qv-meta">
              ${hotel.stars > 0 ? `<span class="qv-stars">${"★".repeat(hotel.stars)}</span><span class="qv-dot">·</span>` : ""}
              <span class="qv-price">${sym}${hotel.price_per_night_gbp}</span>
              <span style="opacity:0.7">/night</span>
            </div>
            <div class="qv-hint"><span>Click for details</span><span>→</span></div>
          </div>
        </div>`

      const marker = L.marker([hotel.lat, hotel.lng], { icon })
      marker.bindTooltip(tooltipHtml, {
        direction: "top",
        offset: [0, -10],
        className: "voyager-quickview-wrap",
        opacity: 1,
        sticky: false,
      })
      marker.on("tooltipopen", () => {
        const s = useTripStore.getState()
        if (s.selectedPlaceDetail || s.selectedHotelDetail) marker.closeTooltip()
      })
      marker.on("click", () => {
        marker.closeTooltip()
        ;(window as any).__voyagerOpenDrawer?.(hotel.name)
      })
      marker.addTo(map)
      hotelMarkersRef.current[hotel.name] = marker
    })
  }, [hotels, interactionMode])

  // Close any open tooltips immediately when the drawer opens
  useEffect(() => {
    const open = !!(selectedPlaceDetail || selectedHotelDetail)
    if (!open) return
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
    map.flyTo([targetLocation.lat, targetLocation.lng], 13, { duration: 1.5 })
  }, [targetLocation])

  // Pulse + fly-to on hover
  useEffect(() => {
    const all = { ...markersRef.current, ...hotelMarkersRef.current }
    Object.values(all).forEach((m) => { const el = m.getElement(); if (el) el.classList.remove("pulse-pin") })
    if (!hoveredPlaceId) return
    const marker = all[hoveredPlaceId]
    if (!marker) return
    const map = leafletRef.current
    if (map) map.flyTo(marker.getLatLng(), Math.max(map.getZoom(), 14), { duration: 0.7, easeLinearity: 0.4 })
    const el = marker.getElement()
    if (el) el.classList.add("pulse-pin")
  }, [hoveredPlaceId])

  // Destination suggestion pins
  useEffect(() => {
    const map = leafletRef.current
    if (!map) return
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const L = require("leaflet")

    // Clear previous destination markers
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
      const socialLine = dest.rating_count
        ? `<div style="display:flex;align-items:center;margin-left:2px">
            <span style="width:14px;height:14px;border-radius:50%;background:#f59e0b;color:#1b2334;font-size:9px;font-weight:800;display:flex;align-items:center;justify-content:center">★</span>
          </div>`
        : ""
      const labelPosition = labelPositions[index % labelPositions.length]
      const labelPositionStyle =
        labelPosition === "top"
          ? "left:50%;transform:translateX(-50%);bottom:calc(100% + 4px);text-align:center;"
          : labelPosition === "bottom"
            ? "left:50%;transform:translateX(-50%);top:calc(100% + 4px);text-align:center;"
            : labelPosition === "left"
              ? "right:calc(100% + 4px);top:50%;transform:translateY(-50%);text-align:right;"
              : "left:calc(100% + 4px);top:50%;transform:translateY(-50%);text-align:left;"
      const icon = L.divIcon({
        className: "",
        html: `<div style="position:relative;display:flex;align-items:center;justify-content:center;width:34px;height:34px">
          <div style="width:34px;height:34px;border-radius:999px;background:rgba(15,22,35,0.94);border:1px solid rgba(255,255,255,0.12);display:flex;align-items:center;justify-content:center;box-shadow:0 2px 12px rgba(0,0,0,0.46);padding:0 6px;gap:2px">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="color:white;flex-shrink:0"><path d="M18.75 9c0 3.735-6.75 12.75-6.75 12.75S5.25 12.735 5.25 9a6.75 6.75 0 0 1 13.5 0Z"></path><path d="M12 11.25a2.25 2.25 0 1 0 0-4.5 2.25 2.25 0 0 0 0 4.5Z"></path></svg>
            ${socialLine}
          </div>
          <div style="position:absolute;${labelPositionStyle}max-width:132px;padding:3px 8px;border-radius:6px;background:rgba(15,22,35,0.94);backdrop-filter:blur(8px);color:white;font-size:11px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;box-shadow:0 2px 10px rgba(0,0,0,0.36);border:1px solid rgba(255,255,255,0.12)">${markerLabel}</div>
        </div>`,
        iconSize: [170, 62],
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
          {
            color: "#5ba3e8",
            weight: 1.5,
            opacity: 0.28,
            dashArray: "5 8",
          }
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

    if (interactionMode !== "discovery" || !selectedDestinationDetail?.lat || !selectedDestinationDetail?.lng) return

    const filteredHighlights =
      discoveryHighlightFilter === "all"
        ? discoveryHighlights
        : discoveryHighlights.filter((place) => classifyDiscoveryCategory(place.category) === discoveryHighlightFilter)

    const anchorCoords: [number, number] = [selectedDestinationDetail.lat, selectedDestinationDetail.lng]
    const cityIcon = L.divIcon({
      className: "",
      html: `<div style="display:flex;align-items:center;gap:8px">
        <div style="width:40px;height:40px;border-radius:999px;background:linear-gradient(135deg,#185FA5,#3d8cd6);border:2px solid rgba(255,255,255,0.88);display:flex;align-items:center;justify-content:center;box-shadow:0 0 0 7px rgba(61,140,214,0.18),0 10px 28px rgba(24,95,165,0.42);font-size:16px">✦</div>
        <div style="padding:6px 10px;border-radius:9px;background:rgba(15,22,35,0.96);backdrop-filter:blur(10px);color:white;font-size:12px;font-weight:700;white-space:nowrap;box-shadow:0 6px 18px rgba(0,0,0,0.35);border:1px solid rgba(255,255,255,0.12)">${selectedDestinationDetail.name}</div>
      </div>`,
      iconSize: [190, 44],
      iconAnchor: [20, 20],
    })
    discoveryCityMarkerRef.current = L.marker(anchorCoords, { icon: cityIcon, zIndexOffset: 600 }).addTo(map)

    const halo = L.circle(anchorCoords, {
      radius: 2600,
      color: "#3d8cd6",
      weight: 1,
      opacity: 0.22,
      fillColor: "#185FA5",
      fillOpacity: 0.08,
    }).addTo(map)
    discoveryHighlightDecorRef.current.push(halo)

    filteredHighlights.slice(0, 10).forEach((place) => {
      const glyph = categoryIcon(place.category)
      const kind = classifyDiscoveryCategory(place.category)
      const pinColor = kind === "restaurants" ? "#f59e0b" : kind === "icons" ? "#fbbf24" : "#3d8cd6"
      const pinSize = kind === "icons" ? 32 : 28
      const label = kind === "restaurants" ? "Food" : kind === "icons" ? "Iconic place" : "Sight"
      const tooltipHtml = `
        <div class="voyager-quickview">
          <div class="qv-photo">
            ${place.photo_url ? `<img src="${place.photo_url}" alt=""/>` : `<div class="qv-photo-empty">${glyph}</div>`}
            <span class="qv-tag">${glyph} ${label}</span>
            ${place.rating != null ? `<span class="qv-rating"><span class="qv-star">★</span>${place.rating.toFixed(1)}</span>` : ""}
          </div>
          <div class="qv-body">
            <div class="qv-title">${place.name}</div>
            <div class="qv-meta">
              <span>${kind === "restaurants" ? "Worth eating at" : kind === "icons" ? "Signature stop" : "Worth exploring"}</span>
              ${place.price_level ? `<span class="qv-dot">·</span><span class="qv-price">${place.price_level}</span>` : ""}
            </div>
            <div class="qv-hint"><span>Open detail</span><span>→</span></div>
          </div>
        </div>`
      const icon = L.divIcon({
        className: "",
        html: `<div style="display:flex;align-items:center;gap:6px">
          <div style="width:${pinSize}px;height:${pinSize}px;border-radius:999px;background:${kind === "icons" ? "linear-gradient(135deg,rgba(251,191,36,0.22),rgba(245,158,11,0.1))" : "rgba(15,22,35,0.95)"};border:2px solid ${pinColor};display:flex;align-items:center;justify-content:center;box-shadow:${kind === "icons" ? "0 0 0 5px rgba(251,191,36,0.12),0 8px 22px rgba(0,0,0,0.5)" : "0 4px 16px rgba(0,0,0,0.45)"};font-size:${kind === "icons" ? "15px" : "13px"}">${glyph}</div>
        </div>`,
        iconSize: [pinSize, pinSize],
        iconAnchor: [Math.floor(pinSize / 2), Math.floor(pinSize / 2)],
      })
      const marker = L.marker([place.lat, place.lng], { icon, zIndexOffset: 450 })
      marker.bindTooltip(tooltipHtml, {
        direction: "top",
        offset: [0, -8],
        className: "voyager-quickview-wrap",
        opacity: 1,
        sticky: false,
      })
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
    selectedDestinationDetail,
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

    // Clear previous arc + endpoint markers
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

    // Build waypoints: origin → [hub stops] → destination
    const waypoints: { code: string; coords: [number, number]; isHub: boolean }[] = [
      { code: orig, coords: coordsA, isHub: false },
    ]

    const airlineCode = (hoveredFlight.airline_code || "").toUpperCase()
    const hubCode = AIRLINE_HUBS[airlineCode]
    const hubCoords = hubCode ? getAirportCoords(hubCode) : undefined
    const hasStops = (hoveredFlight.stops ?? 0) > 0

    // Route through airline hub if flight has stops and hub is different from origin/destination
    if (hasStops && hubCoords && hubCode !== orig && hubCode !== dest) {
      waypoints.push({ code: hubCode!, coords: hubCoords, isHub: true })
    }
    waypoints.push({ code: dest, coords: coordsB, isHub: false })

    // Build combined arc across all segments
    const segments: [number, number][][] = []
    for (let i = 0; i < waypoints.length - 1; i++) {
      const a = waypoints[i].coords
      const b = waypoints[i + 1].coords
      segments.push(greatCirclePoints(a[0], a[1], b[0], b[1]))
    }

    const arcLayers = segments.map((pts) =>
      L.polyline(pts, {
        color: "#5ba3e8",
        weight: 2,
        opacity: 0.85,
        dashArray: "8 5",
      })
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

    // Fit map to show all waypoints
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

  // Itinerary-aware markers: day summaries when unfiltered, event markers when a day is selected
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
        html: `<div style="display:flex;align-items:center;gap:6px">
          <div style="width:${isSelected ? "36px" : "32px"};height:${isSelected ? "36px" : "32px"};border-radius:999px;background:${isSelected ? "#3d8cd6" : "#185FA5"};border:2px solid white;display:flex;align-items:center;justify-content:center;color:white;font-size:13px;font-weight:800;box-shadow:${isSelected ? "0 0 0 6px rgba(61,140,214,0.22),0 2px 16px rgba(24,95,165,0.65)" : "0 2px 10px rgba(24,95,165,0.55)"}">${entry.label}</div>
          <div style="padding:4px 9px;border-radius:8px;background:${isSelected ? "rgba(61,140,214,0.96)" : "rgba(24,95,165,0.92)"};color:white;font-size:11px;font-weight:700;white-space:nowrap;max-width:160px;overflow:hidden;text-overflow:ellipsis;border:1px solid rgba(255,255,255,0.18);box-shadow:0 2px 10px rgba(0,0,0,0.35)">${entry.title}</div>
        </div>`,
        iconSize: [210, isSelected ? 36 : 32],
        iconAnchor: [isSelected ? 18 : 16, isSelected ? 18 : 16],
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
      <div ref={mapRef} className="w-full h-full" />

      {/* ── Rich place detail drawer ── */}
      <PlaceDetailDrawer />

      {/* ── Compact destination detail preview ── */}
      <DestinationDetailPanel />

      {/* ── Weather chip (destination forecast) ── */}
      {interactionMode !== "discovery" && !selectedDestinationDetail && weather.length > 0 && isFiniteWeatherDay(weather[0]) && (
        <div
          className="glass-widget absolute top-4 left-4 z-[1000]"
          style={{
            padding: "8px 14px 8px 12px",
            display: "flex",
            alignItems: "center",
            gap: "10px",
          }}
        >
          <span style={{ fontSize: "22px", lineHeight: 1 }}>{weather[0].weather_icon}</span>
          <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.2 }}>
            <span style={{ fontSize: "14px", fontWeight: 700, color: "var(--text)" }}>
              {Math.round(weather[0].temp_high_c)}°
              <span style={{ color: "var(--text-muted)", fontWeight: 500, marginLeft: 4, fontSize: "12px" }}>
                / {Math.round(weather[0].temp_low_c)}°
              </span>
            </span>
            <span
              style={{
                fontSize: "10.5px",
                color: "var(--text-muted)",
                textTransform: "capitalize",
                letterSpacing: "0.01em",
              }}
            >
              {weather[0].condition}
            </span>
          </div>
        </div>
      )}

      {/* ── Budget widget ── */}
      {budget && (
        <div className="glass-widget absolute bottom-5 left-4 z-[1000]" style={{ minWidth: "170px" }}>
          <div className={`flex items-center justify-between px-3 pt-2.5 ${budgetOpen ? "pb-1" : "pb-2.5"}`}>
            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)", letterSpacing: "0.1em" }}>
              Budget
            </p>
            <button
              onClick={() => setBudgetOpen((v) => !v)}
              className="text-xs cursor-pointer transition-opacity hover:opacity-70"
              style={{ color: "var(--text-muted)" }}
            >
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

      {/* ── Currency widget ── */}
      {currency && (
        <div className="glass-widget absolute bottom-5 right-4 z-[1000]" style={{ minWidth: "155px" }}>
          <div className={`flex items-center justify-between px-3 pt-2.5 ${currencyOpen ? "pb-1" : "pb-2.5"}`}>
            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)", letterSpacing: "0.1em" }}>
              Currency
            </p>
            <button
              onClick={() => setCurrencyOpen((v) => !v)}
              className="text-xs cursor-pointer transition-opacity hover:opacity-70"
              style={{ color: "var(--text-muted)" }}
            >
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
