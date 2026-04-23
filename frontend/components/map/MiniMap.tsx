"use client"

import { useEffect, useRef } from "react"
import "leaflet/dist/leaflet.css"
import { useTripStore } from "@/hooks/useTripStore"

export function MiniMap() {
  const mapRef = useRef<HTMLDivElement>(null)
  const leafletRef = useRef<any>(null)
  const { places, pinnedPlaceIds, setActiveTab } = useTripStore()

  useEffect(() => {
    if (typeof window === "undefined" || !mapRef.current) return
    if (leafletRef.current) {
      leafletRef.current.remove()
      leafletRef.current = null
    }

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const L = require("leaflet")

    const validPlaces = places.filter((p) => p.lat && p.lng)
    if (!validPlaces.length) return

    const center: [number, number] = [validPlaces[0].lat, validPlaces[0].lng]
    const map = L.map(mapRef.current, {
      center,
      zoom: 12,
      zoomControl: false,
      attributionControl: false,
      dragging: false,
      scrollWheelZoom: false,
    })

    L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      { attribution: "© Esri", maxZoom: 19 }
    ).addTo(map)
    L.tileLayer(
      "https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
      { attribution: "", maxZoom: 19, opacity: 0.8 }
    ).addTo(map)

    const plainPin = L.divIcon({
      className: "",
      html: `<div style="width:16px;height:16px;border-radius:50%;background:white;border:2px solid #185FA5;box-shadow:0 1px 4px rgba(0,0,0,0.4)"></div>`,
      iconSize: [16, 16], iconAnchor: [8, 8],
    })
    const tickPin = L.divIcon({
      className: "",
      html: `<div style="width:16px;height:16px;border-radius:50%;background:#185FA5;border:2px solid #185FA5;display:flex;align-items:center;justify-content:center;color:white;font-size:9px;box-shadow:0 1px 4px rgba(0,0,0,0.4)">✓</div>`,
      iconSize: [16, 16], iconAnchor: [8, 8],
    })

    validPlaces.forEach((place) => {
      const icon = pinnedPlaceIds.has(place.name) ? tickPin : plainPin
      const marker = L.marker([place.lat, place.lng], { icon })
      marker.bindPopup(`<b style="font-size:11px">${place.name}</b>`)
      marker.addTo(map)
    })

    const bounds = L.latLngBounds(validPlaces.map((p) => [p.lat, p.lng]))
    map.fitBounds(bounds, { padding: [20, 20] })

    leafletRef.current = map
    return () => { map.remove(); leafletRef.current = null }
  }, [places, pinnedPlaceIds])

  if (!places.filter((p) => p.lat && p.lng).length) {
    return (
      <div className="w-full h-28 rounded-lg flex items-center justify-center text-xs"
        style={{ background: "var(--surface-2)", color: "var(--border)" }}>
        Map pins appear after places load
      </div>
    )
  }

  return (
    <div
      className="w-full h-28 rounded-lg overflow-hidden cursor-pointer relative"
      style={{ border: "1px solid var(--border)" }}
      onClick={() => {/* map is always visible */}}
    >
      <div ref={mapRef} className="w-full h-full" />
      <div className="absolute inset-0 flex items-end justify-end p-1.5 pointer-events-none">
        <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: "rgba(0,0,0,0.6)", color: "white" }}>
          View map →
        </span>
      </div>
    </div>
  )
}
