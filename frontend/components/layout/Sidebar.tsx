"use client"

import { MapPin, Plus, LogOut, Plane, ChevronLeft, ChevronRight } from "lucide-react"
import { useAuth } from "@/context/AuthContext"
import { useTrips, type Trip } from "@/hooks/useTrips"
import { useTripStore } from "@/hooks/useTripStore"
import { useAutoSave } from "@/hooks/useAutoSave"
import { useEffect, useRef, useState } from "react"

export function Sidebar() {
  const { user, signOut } = useAuth()
  const { trips, loading, createTrip, loadTrip, refetch } = useTrips()
  const currentTripId = useTripStore((s) => s.currentTripId)
  const resetForNewTrip = useTripStore((s) => s.resetForNewTrip)
  const setCurrentTripId = useTripStore((s) => s.setCurrentTripId)
  const ensuredRef = useRef(false)
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => window.dispatchEvent(new Event("resize")), 270)
    return () => clearTimeout(t)
  }, [collapsed])

  useAutoSave(refetch)

  useEffect(() => {
    if (!user || loading || ensuredRef.current) return
    ensuredRef.current = true
    if (currentTripId) return
    if (trips.length > 0) {
      setCurrentTripId(trips[0].id)
    } else {
      createTrip("New Trip").then((trip) => {
        if (trip) setCurrentTripId(trip.id)
      })
    }
  }, [user, loading])

  const handleNewTrip = async () => {
    const trip = await createTrip("New Trip")
    if (trip) resetForNewTrip(trip.id)
  }

  const handleSelectTrip = async (trip: Trip) => {
    if (trip.id === currentTripId) return
    await loadTrip(trip.id)
  }

  const avatarUrl = user?.user_metadata?.avatar_url as string | undefined
  const email = user?.email ?? ""
  const displayName = (user?.user_metadata?.full_name as string | undefined) ?? email.split("@")[0]

  return (
    <aside
      className="flex flex-col h-full flex-shrink-0 relative"
      style={{
        width: collapsed ? "48px" : "220px",
        background: "var(--surface)",
        borderRight: "1px solid var(--border)",
        transition: "width 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
        overflow: "hidden",
      }}
    >
      {/* Brand / collapse toggle */}
      <div
        className="flex items-center px-3 py-4 flex-shrink-0"
        style={{ borderBottom: "1px solid var(--border)", minHeight: "56px" }}
      >
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="flex items-center gap-2 cursor-pointer rounded-md transition-opacity hover:opacity-80"
          style={{ background: "none", border: "none", padding: 0 }}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: "var(--accent)", boxShadow: "0 2px 8px rgba(24,95,165,0.5)" }}
          >
            <MapPin size={13} className="text-white" />
          </div>
          {!collapsed && (
            <span className="font-bold text-sm tracking-tight whitespace-nowrap" style={{ color: "var(--text)" }}>
              Voyager
            </span>
          )}
        </button>

        {!collapsed && (
          <button
            onClick={() => setCollapsed(true)}
            className="ml-auto p-1 rounded-md cursor-pointer transition-colors"
            style={{ color: "var(--text-muted)", background: "none", border: "none" }}
            title="Collapse sidebar"
            onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text)")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
          >
            <ChevronLeft size={14} />
          </button>
        )}
      </div>

      {/* User profile */}
      <div
        className="flex items-center gap-2.5 px-3 py-3 flex-shrink-0"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        {avatarUrl ? (
          <img src={avatarUrl} alt={displayName} className="w-7 h-7 rounded-full flex-shrink-0" title={collapsed ? displayName : undefined} />
        ) : (
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold text-white"
            style={{ background: "var(--accent)" }}
            title={collapsed ? displayName : undefined}
          >
            {displayName[0]?.toUpperCase()}
          </div>
        )}
        {!collapsed && (
          <>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold truncate" style={{ color: "var(--text)" }}>
                {displayName}
              </p>
              <p className="text-xs truncate" style={{ color: "var(--text-muted)", fontSize: "10px" }}>
                {email}
              </p>
            </div>
            <button
              onClick={signOut}
              className="p-1 rounded-md transition-colors cursor-pointer flex-shrink-0"
              style={{ color: "var(--text-muted)" }}
              title="Sign out"
              onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text)")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
            >
              <LogOut size={13} />
            </button>
          </>
        )}
      </div>

      {/* New trip */}
      <div className="px-2 pt-3 pb-2 flex-shrink-0">
        <button
          onClick={handleNewTrip}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer"
          style={{ color: "var(--text-muted)", border: "1px dashed var(--border)" }}
          title={collapsed ? "New trip" : undefined}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = "var(--accent)"
            e.currentTarget.style.color = "var(--accent-light)"
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "var(--border)"
            e.currentTarget.style.color = "var(--text-muted)"
          }}
        >
          <Plus size={13} />
          {!collapsed && "New trip"}
        </button>
      </div>

      {/* Trip history */}
      {!collapsed && (
        <div className="flex-1 overflow-y-auto px-3 pb-3">
          {trips.length === 0 ? (
            <p className="text-xs px-2 pt-1" style={{ color: "var(--border)" }}>No saved trips yet</p>
          ) : (
            <div className="flex flex-col gap-0.5">
              <p className="text-xs px-2 pb-1.5 pt-1 font-medium" style={{ color: "var(--text-muted)" }}>
                Recent
              </p>
              {trips.map((trip) => {
                const isActive = trip.id === currentTripId
                return (
                  <button
                    key={trip.id}
                    onClick={() => handleSelectTrip(trip)}
                    className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left transition-all cursor-pointer"
                    style={{
                      background: isActive ? "var(--surface-2)" : "transparent",
                      border: isActive ? "1px solid var(--border)" : "1px solid transparent",
                      color: isActive ? "var(--text)" : "var(--text-muted)",
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive) e.currentTarget.style.background = "var(--surface-2)"
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) e.currentTarget.style.background = "transparent"
                    }}
                  >
                    <Plane size={11} style={{ flexShrink: 0, color: isActive ? "var(--accent-light)" : "inherit" }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">
                        {trip.title}
                      </p>
                      {trip.destination && (
                        <p className="truncate" style={{ fontSize: "10px", color: "var(--text-muted)" }}>
                          {trip.destination}
                        </p>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Collapsed: trip icons */}
      {collapsed && (
        <div className="flex-1 overflow-y-auto py-2 px-2 flex flex-col gap-1">
          {trips.map((trip) => {
            const isActive = trip.id === currentTripId
            return (
              <button
                key={trip.id}
                onClick={() => handleSelectTrip(trip)}
                className="w-full flex items-center justify-center p-2 rounded-lg cursor-pointer transition-all"
                title={trip.title}
                style={{
                  background: isActive ? "var(--surface-2)" : "transparent",
                  border: isActive ? "1px solid var(--border)" : "1px solid transparent",
                  color: isActive ? "var(--accent-light)" : "var(--text-muted)",
                }}
                onMouseEnter={(e) => {
                  if (!isActive) e.currentTarget.style.background = "var(--surface-2)"
                }}
                onMouseLeave={(e) => {
                  if (!isActive) e.currentTarget.style.background = "transparent"
                }}
              >
                <Plane size={13} />
              </button>
            )
          })}
        </div>
      )}
    </aside>
  )
}
