"use client"

import { useEffect, useRef, useState } from "react"
import "leaflet/dist/leaflet.css"
import "leaflet.markercluster/dist/MarkerCluster.css"
import "leaflet.markercluster/dist/MarkerCluster.Default.css"
import { useTripStore } from "@/hooks/useTripStore"
import { PlaceResult } from "@/types"
import { X, Star, MapPin, Clock, Plus, Check } from "lucide-react"

function PlaceDetailPanel({
  place,
  onClose,
}: {
  place: PlaceResult
  onClose: () => void
}) {
  const { pinnedPlaceIds, togglePin } = useTripStore()
  const isPinned = pinnedPlaceIds.has(place.name)

  return (
    <div
      className="flex flex-col h-full overflow-y-auto flex-shrink-0"
      style={{
        width: "340px",
        background: "var(--surface)",
        borderLeft: "1px solid var(--border)",
      }}
    >
      {/* Photo */}
      <div className="relative h-48 flex-shrink-0" style={{ background: "var(--surface-2)" }}>
        {place.photo_url ? (
          <img src={place.photo_url} alt={place.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <MapPin size={32} style={{ color: "var(--border)" }} />
          </div>
        )}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 w-7 h-7 rounded-full flex items-center justify-center cursor-pointer"
          style={{ background: "rgba(0,0,0,0.6)", color: "white" }}
        >
          <X size={14} />
        </button>
        <div
          className="absolute bottom-3 left-3 px-2 py-0.5 rounded-full text-xs font-medium capitalize"
          style={{ background: "rgba(0,0,0,0.6)", color: "white" }}
        >
          {place.category}
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-3 flex-1">
        <div>
          <h2 className="text-base font-semibold" style={{ color: "var(--text)" }}>
            {place.name}
          </h2>
          <div className="flex items-center gap-3 mt-1">
            {place.rating && (
              <div className="flex items-center gap-1">
                <Star size={12} fill="#f59e0b" color="#f59e0b" />
                <span className="text-sm font-medium" style={{ color: "var(--text)" }}>
                  {place.rating}
                </span>
              </div>
            )}
            {place.open_now !== null && place.open_now !== undefined && (
              <div className="flex items-center gap-1">
                <Clock size={11} style={{ color: place.open_now ? "#22c55e" : "#f87171" }} />
                <span className="text-xs" style={{ color: place.open_now ? "#22c55e" : "#f87171" }}>
                  {place.open_now ? "Open now" : "Closed"}
                </span>
              </div>
            )}
          </div>
        </div>

        {place.address && (
          <div className="flex items-start gap-2">
            <MapPin size={13} className="flex-shrink-0 mt-0.5" style={{ color: "var(--text-muted)" }} />
            <p className="text-xs leading-snug" style={{ color: "var(--text-muted)" }}>
              {place.address}
            </p>
          </div>
        )}

        {place.summary && (
          <p className="text-sm leading-relaxed" style={{ color: "var(--text)" }}>
            {place.summary}
          </p>
        )}

        <button
          onClick={() => togglePin(place.name)}
          className="w-full py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition-colors cursor-pointer"
          style={{
            background: isPinned ? "var(--accent)" : "var(--surface-2)",
            color: isPinned ? "white" : "var(--text)",
            border: `1px solid ${isPinned ? "var(--accent)" : "var(--border)"}`,
          }}
        >
          {isPinned ? <Check size={15} /> : <Plus size={15} />}
          {isPinned ? "Added to itinerary" : "Add to itinerary"}
        </button>
      </div>
    </div>
  )
}

export function MapTab() {
  const mapRef = useRef<HTMLDivElement>(null)
  const leafletRef = useRef<any>(null)
  const markersRef = useRef<Record<string, any>>({})
  const { places, pinnedPlaceIds, togglePin } = useTripStore()
  const [selectedPlace, setSelectedPlace] = useState<PlaceResult | null>(null)

  useEffect(() => {
    if (typeof window === "undefined" || !mapRef.current) return
    if (leafletRef.current) {
      leafletRef.current.remove()
      leafletRef.current = null
    }
    markersRef.current = {}

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const L = require("leaflet")
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require("leaflet.markercluster")

    const validPlaces = places.filter((p) => p.lat && p.lng)
    if (!validPlaces.length) return

    const map = L.map(mapRef.current, {
      center: [validPlaces[0].lat, validPlaces[0].lng],
      zoom: 13,
    })

    L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      { attribution: "© Esri", maxZoom: 19 }
    ).addTo(map)
    L.tileLayer(
      "https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
      { attribution: "", maxZoom: 19, opacity: 0.9 }
    ).addTo(map)

    const clusterGroup = (L as any).markerClusterGroup({ maxClusterRadius: 40 })

    validPlaces.forEach((place) => {
      const isPinned = pinnedPlaceIds.has(place.name)
      const icon = L.divIcon({
        className: "",
        html: isPinned
          ? `<div style="width:30px;height:30px;border-radius:50%;background:#185FA5;border:2.5px solid white;display:flex;align-items:center;justify-content:center;color:white;font-size:15px;box-shadow:0 2px 8px rgba(0,0,0,0.5)">✓</div>`
          : `<div style="width:30px;height:30px;border-radius:50%;background:white;border:2.5px solid #185FA5;box-shadow:0 2px 8px rgba(0,0,0,0.4)"></div>`,
        iconSize: [30, 30],
        iconAnchor: [15, 15],
      })

      const marker = L.marker([place.lat, place.lng], { icon })
      marker.on("click", () => setSelectedPlace(place))
      clusterGroup.addLayer(marker)
      markersRef.current[place.name] = marker
    })

    map.addLayer(clusterGroup)

    const bounds = L.latLngBounds(validPlaces.map((p) => [p.lat, p.lng]))
    map.fitBounds(bounds, { padding: [40, 40] })

    leafletRef.current = map
    return () => { map.remove(); leafletRef.current = null }
  }, [places, pinnedPlaceIds])

  // Re-center map when detail panel opens/closes
  useEffect(() => {
    setTimeout(() => leafletRef.current?.invalidateSize(), 320)
  }, [selectedPlace])

  if (!places.filter((p) => p.lat && p.lng).length) {
    return (
      <div className="flex items-center justify-center h-full text-sm" style={{ color: "var(--text-muted)" }}>
        Plan a trip first — places will appear on the map as the agent searches.
      </div>
    )
  }

  return (
    <div className="flex h-full">
      {/* Map */}
      <div ref={mapRef} className="flex-1 h-full" />

      {/* Slide-in detail panel */}
      {selectedPlace && (
        <PlaceDetailPanel
          place={selectedPlace}
          onClose={() => setSelectedPlace(null)}
        />
      )}
    </div>
  )
}
