"use client"

import { useEffect, useRef, useState } from "react"
import "leaflet/dist/leaflet.css"
import { useTripStore } from "@/hooks/useTripStore"
import { PlaceDetailDrawer } from "./PlaceDetailDrawer"

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

/** Map category → emoji icon for marker */
function categoryIcon(category: string): string {
  const c = (category ?? "").toLowerCase()
  if (c.includes("restaur") || c.includes("food") || c.includes("dining") || c.includes("bistro")) return "🍽"
  if (c.includes("cafe") || c.includes("coffee") || c.includes("bakery")) return "☕"
  if (c.includes("bar") || c.includes("pub") || c.includes("night")) return "🍸"
  if (c.includes("museum") || c.includes("gallery") || c.includes("art")) return "🏛"
  if (c.includes("church") || c.includes("cathedral") || c.includes("temple") || c.includes("monastery")) return "⛪"
  if (c.includes("beach") || c.includes("coast") || c.includes("bay")) return "🏖"
  if (c.includes("park") || c.includes("garden") || c.includes("nature") || c.includes("forest")) return "🌿"
  if (c.includes("market") || c.includes("shop") || c.includes("mall")) return "🛍"
  if (c.includes("sport") || c.includes("stadium") || c.includes("gym")) return "⚽"
  if (c.includes("spa") || c.includes("wellness") || c.includes("thermal")) return "💆"
  if (c.includes("viewpoint") || c.includes("observation") || c.includes("tower")) return "🗼"
  if (c.includes("aquarium") || c.includes("zoo")) return "🐠"
  return "📍"
}

export function MapPane() {
  const mapRef     = useRef<HTMLDivElement>(null)
  const leafletRef = useRef<any>(null)
  const clusterRef = useRef<any>(null)
  const markersRef = useRef<Record<string, any>>({})
  const hotelMarkersRef = useRef<Record<string, any>>({})
  const routeRef   = useRef<any>(null)

  const [budgetOpen,   setBudgetOpen]   = useState(true)
  const [currencyOpen, setCurrencyOpen] = useState(true)

  const {
    places, hotels, pinnedPlaceIds,
    hoveredPlaceId, targetLocation,
    selectedItineraryDay, itinerary,
    budget, currency,
    setSelectedPlaceDetail,
  } = useTripStore()

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
    leafletRef.current = map
    return () => { map.remove(); leafletRef.current = null }
  }, [])

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

    const validPlaces = places.filter((p) => p.lat && p.lng)
    if (!validPlaces.length) return

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
      const icon = L.divIcon({
        className: "",
        html: isPinned
          ? `<div class="voyager-pin" style="width:32px;height:32px;border-radius:50%;background:#185FA5;border:2.5px solid white;display:flex;align-items:center;justify-content:center;font-size:14px;box-shadow:0 2px 12px rgba(24,95,165,0.6)">✓</div>`
          : `<div class="voyager-pin" style="width:32px;height:32px;border-radius:50%;background:#13161f;border:2.5px solid #3d8cd6;display:flex;align-items:center;justify-content:center;font-size:14px;box-shadow:0 2px 10px rgba(0,0,0,0.5)">${icon_emoji}</div>`,
        iconSize: [32, 32], iconAnchor: [16, 16],
      })

      const safeName = place.name.replace(/'/g, "\\'").replace(/"/g, "&quot;")
      const popupHtml = `
        <div style="width:260px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;overflow:hidden">
          <div style="position:relative;height:140px;overflow:hidden;background:#1a1e2e">
            ${place.photo_url
              ? `<img src="${place.photo_url}" style="width:100%;height:100%;object-fit:cover"/>`
              : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:40px">${icon_emoji}</div>`
            }
            <div style="position:absolute;inset:0;background:linear-gradient(to bottom,transparent 50%,rgba(0,0,0,0.7))"></div>
            <span style="position:absolute;top:8px;left:8px;padding:2px 8px;border-radius:20px;background:rgba(0,0,0,0.65);color:rgba(255,255,255,0.9);font-size:10px;text-transform:capitalize">${icon_emoji} ${place.category}</span>
            ${place.price_level ? `<span style="position:absolute;top:8px;right:30px;padding:2px 7px;border-radius:20px;background:rgba(0,0,0,0.65);color:rgba(255,255,255,0.8);font-size:10px">${place.price_level}</span>` : ""}
            ${place.open_now != null ? `<span style="position:absolute;bottom:8px;right:8px;padding:2px 8px;border-radius:20px;font-size:10px;font-weight:600;background:rgba(0,0,0,0.65);color:${place.open_now ? "#22c55e" : "#f87171"}">${place.open_now ? "● Open" : "● Closed"}</span>` : ""}
          </div>
          <div style="padding:12px 14px 14px">
            <div style="font-size:14px;font-weight:700;color:#eceef5;margin-bottom:5px;line-height:1.3">${place.name}</div>
            ${place.rating != null ? `
            <div style="display:flex;align-items:center;gap:6px;margin-bottom:7px">
              ${ratingStarsHtml(place.rating)}
              <span style="font-size:12px;font-weight:600;color:#eceef5">${place.rating}</span>
              <span style="font-size:10px;color:#6b7394">/ 5.0</span>
            </div>` : ""}
            ${place.summary ? `<div style="font-size:11px;color:#9ba3c0;line-height:1.6;margin-bottom:10px">${place.summary.slice(0, 160)}${place.summary.length > 160 ? "…" : ""}</div>` : ""}
            ${place.address ? `<div style="font-size:10px;color:#3d4460;margin-bottom:10px;display:flex;gap:4px"><span>📍</span><span style="line-height:1.4">${place.address}</span></div>` : ""}
            <div style="display:flex;gap:6px">
              <button onclick="window.__voyagerScrollToCard('${safeName}')" style="flex:1;padding:6px 0;border-radius:8px;border:1px solid #252a3d;background:rgba(255,255,255,0.04);color:#9ba3c0;font-size:11px;cursor:pointer">↑ Scroll to card</button>
              <button onclick="window.__voyagerTogglePin('${safeName}')" style="flex:1;padding:6px 0;border-radius:8px;border:1px solid ${isPinned ? "#185FA5" : "#252a3d"};background:${isPinned ? "#185FA5" : "rgba(255,255,255,0.04)"};color:${isPinned ? "white" : "#9ba3c0"};font-size:11px;cursor:pointer">${isPinned ? "✓ Added" : "+ Itinerary"}</button>
            </div>
          </div>
        </div>`

      const marker = L.marker([place.lat, place.lng], { icon })
      marker.bindPopup(popupHtml, { maxWidth: 280, minWidth: 260 })
      marker.on("click", () => {
        ;(window as any).__voyagerOpenDrawer?.(place.name)
      })
      cluster.addLayer(marker)
      markersRef.current[place.name] = marker
    })

    map.addLayer(cluster)
    clusterRef.current = cluster
  }, [places, pinnedPlaceIds])

  // Hotel markers
  useEffect(() => {
    const map = leafletRef.current
    if (!map) return
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const L = require("leaflet")

    Object.values(hotelMarkersRef.current).forEach((m) => map.removeLayer(m))
    hotelMarkersRef.current = {}

    hotels.filter((h) => h.lat && h.lng).forEach((hotel) => {
      const sym = currencySymbol(hotel.currency)
      const icon = L.divIcon({
        className: "",
        html: `<div class="voyager-pin" style="width:34px;height:34px;border-radius:8px;background:#13161f;border:2px solid #185FA5;display:flex;align-items:center;justify-content:center;font-size:16px;box-shadow:0 2px 12px rgba(0,0,0,0.6)">🏨</div>`,
        iconSize: [34, 34], iconAnchor: [17, 17],
      })

      const safeName = hotel.name.replace(/'/g, "\\'").replace(/"/g, "&quot;")
      const popupHtml = `
        <div style="width:270px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;overflow:hidden">
          <div style="position:relative;height:150px;overflow:hidden;background:#1a1e2e">
            ${hotel.photo_url ? `<img src="${hotel.photo_url}" style="width:100%;height:100%;object-fit:cover"/>` : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:40px">🏨</div>`}
            <div style="position:absolute;inset:0;background:linear-gradient(to bottom,transparent 40%,rgba(0,0,0,0.8))"></div>
            <div style="position:absolute;bottom:8px;left:10px">
              <span style="font-size:20px;font-weight:800;color:white">${sym}${hotel.price_per_night_gbp}</span>
              <span style="font-size:11px;color:rgba(255,255,255,0.6)">/night</span>
            </div>
            ${hotel.review_score ? `<div style="position:absolute;top:8px;right:8px;background:#185FA5;color:white;padding:3px 9px;border-radius:6px;font-size:13px;font-weight:700">${hotel.review_score}</div>` : ""}
          </div>
          <div style="padding:12px 14px 14px">
            ${hotel.stars > 0 ? `<div style="margin-bottom:4px">${starsHtml(hotel.stars)}</div>` : ""}
            <div style="font-size:14px;font-weight:700;color:#eceef5;margin-bottom:6px;line-height:1.3">${hotel.name}</div>
            ${hotel.review_score ? `<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px"><div style="background:#185FA5;color:white;padding:2px 9px;border-radius:6px;font-size:13px;font-weight:700">${hotel.review_score}</div><span style="font-size:12px;color:#eceef5;font-weight:500">${hotel.review_word || "Good"}</span></div>` : ""}
            ${hotel.address ? `<div style="font-size:10px;color:#3d4460;margin-bottom:10px;display:flex;gap:4px"><span>📍</span><span style="line-height:1.4">${hotel.address}</span></div>` : ""}
            <div style="display:flex;gap:6px">
              <button onclick="window.__voyagerScrollToCard('${safeName}')" style="flex:1;padding:7px 0;border-radius:8px;border:1px solid #252a3d;background:rgba(255,255,255,0.04);color:#9ba3c0;font-size:12px;cursor:pointer">↑ Scroll to card</button>
              <button onclick="window.__voyagerSelectHotel('${safeName}')" style="flex:0 0 auto;padding:7px 12px;border-radius:8px;border:1px solid #185FA5;background:rgba(24,95,165,0.2);color:#4d9de0;font-size:12px;cursor:pointer">Select</button>
              <a href="${hotel.booking_url}" target="_blank" style="flex:1;padding:7px 0;border-radius:8px;background:#185FA5;color:white;font-size:12px;font-weight:600;text-align:center;text-decoration:none;display:block">Book →</a>
            </div>
          </div>
        </div>`

      const marker = L.marker([hotel.lat, hotel.lng], { icon })
      marker.bindPopup(popupHtml, { maxWidth: 290, minWidth: 270 })
      marker.on("click", () => (window as any).__voyagerScrollToCard?.(hotel.name))
      marker.addTo(map)
      hotelMarkersRef.current[hotel.name] = marker
    })
  }, [hotels])

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

  // Route polyline for selected itinerary day
  useEffect(() => {
    const map = leafletRef.current
    if (routeRef.current && map) { map.removeLayer(routeRef.current); routeRef.current = null }
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
  }, [selectedItineraryDay, itinerary])

  const hasMarkers = places.some((p) => p.lat && p.lng) || hotels.some((h) => h.lat && h.lng)

  return (
    <div className="relative h-full w-full overflow-hidden">
      <div ref={mapRef} className="w-full h-full" />

      {/* ── Rich place detail drawer ── */}
      <PlaceDetailDrawer />

      {/* ── Budget widget ── */}
      {budget && (
        <div className="glass-widget absolute bottom-5 left-4 z-[1000]" style={{ minWidth: "170px" }}>
          <div className="flex items-center justify-between px-3 pt-2.5 pb-1">
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
          <div className="flex items-center justify-between px-3 pt-2.5 pb-1">
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
            Places appear on the map as the agent searches
          </div>
        </div>
      )}
    </div>
  )
}
