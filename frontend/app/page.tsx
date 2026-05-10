"use client"

import dynamic from "next/dynamic"
import { Briefcase, PanelLeftClose, PanelLeftOpen, Zap } from "lucide-react"
import { useTripStore } from "@/hooks/useTripStore"
import { useSSE } from "@/hooks/useSSE"
import { EmptyState } from "@/components/empty/EmptyState"
import { ChatWindow } from "@/components/chat/ChatWindow"
import { ItineraryTimeline } from "@/components/itinerary/ItineraryTimeline"
import { TripHeader } from "@/components/layout/TripHeader"
import { Sidebar } from "@/components/layout/Sidebar"
import { LoginPage } from "@/components/auth/LoginPage"
import { useEffect } from "react"
import { MapHoverCard } from "@/components/map/MapHoverCard"
import { cancelHoverClose, scheduleHoverClose } from "@/hooks/useTripStore"
import { useAuth } from "@/context/AuthContext"

const MapPane = dynamic(
  () => import("@/components/map/MapPane").then((m) => m.MapPane),
  { ssr: false }
)

type Tab = "chat" | "itinerary"

const TABS: { id: Tab; label: string }[] = [
  { id: "chat", label: "Chat" },
  { id: "itinerary", label: "Itinerary" },
]

export default function Home() {
  const { user, loading } = useAuth()
  const {
    hasStarted, activeTab, setActiveTab, itinerary,
    pinnedPlaceIds, selectedFlight, selectedHotel,
    tokenUsage, chatCollapsed, setChatCollapsed,
  } = useTripStore()
  const hoverCard = useTripStore((s) => s.hoverCard)
  const setHoverCard = useTripStore((s) => s.setHoverCard)
  const { sendMessage } = useSSE()

  // Must be before any conditional return
  useEffect(() => {
    const t = setTimeout(() => window.dispatchEvent(new Event("resize")), 320)
    return () => clearTimeout(t)
  }, [chatCollapsed])

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center" style={{ background: "var(--background)" }}>
        <div className="w-6 h-6 rounded-full border-2 animate-spin" style={{ borderColor: "var(--accent)", borderTopColor: "transparent" }} />
      </div>
    )
  }

  if (!user) return <LoginPage />

  const tripItemCount =
    pinnedPlaceIds.size + (selectedFlight ? 1 : 0) + (selectedHotel ? 1 : 0)

  return (
    <div className="flex h-full" style={{ background: "var(--background)" }}>
      {/* ── Sidebar ── */}
      <Sidebar />

      {/* ── Left pane ── */}
      <div
        className="flex flex-col h-full flex-shrink-0 overflow-hidden"
        style={{
          width: chatCollapsed ? "0%" : "45%",
          background: "var(--surface)",
          borderRight: chatCollapsed ? "none" : "1px solid var(--border)",
          transition: "width 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center gap-3 px-5 h-13 flex-shrink-0"
          style={{
            borderBottom: "1px solid var(--border)",
            background: "var(--surface)",
            minHeight: "52px",
          }}
        >
          {hasStarted && (
            <div
              className="flex gap-0.5 ml-3 p-0.5 rounded-lg"
              style={{ background: "var(--background)" }}
            >
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className="px-3 py-1.5 text-xs font-medium rounded-md transition-all cursor-pointer"
                  style={{
                    color: activeTab === tab.id ? "var(--text)" : "var(--text-muted)",
                    background: activeTab === tab.id ? "var(--surface-2)" : "transparent",
                    boxShadow: activeTab === tab.id ? "0 1px 4px rgba(0,0,0,0.3)" : "none",
                  }}
                >
                  {tab.label}
                  {tab.id === "itinerary" && itinerary && (
                    <span
                      className="ml-1.5 px-1.5 py-0.5 rounded-full"
                      style={{ background: "var(--accent)", color: "white", fontSize: "10px" }}
                    >
                      {Math.max(1, itinerary.days.length - 2)}N
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}

          <div className="flex-1" />

          {hasStarted && tokenUsage.input_tokens > 0 && (
            <div
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full"
              title={`${tokenUsage.input_tokens.toLocaleString()} in · ${tokenUsage.output_tokens.toLocaleString()} out`}
              style={{
                background: "var(--surface-2)",
                border: "1px solid var(--border)",
              }}
            >
              <Zap size={10} style={{ color: "#f59e0b" }} />
              <span className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>
                {formatTokens(tokenUsage.input_tokens + tokenUsage.output_tokens)}
              </span>
              <span className="text-xs font-semibold" style={{ color: "var(--accent-light)" }}>
                ${tokenUsage.cost_usd.toFixed(4)}
              </span>
            </div>
          )}

          {hasStarted && tripItemCount > 0 && (
            <div
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full"
              style={{
                background: "var(--surface-2)",
                border: "1px solid var(--border)",
              }}
            >
              <Briefcase size={11} style={{ color: "var(--accent-light)" }} />
              <span className="text-xs font-semibold" style={{ color: "var(--text)" }}>
                Trip
              </span>
              <span
                className="text-xs font-bold px-1.5 rounded-full"
                style={{ background: "var(--accent)", color: "white", minWidth: 18, textAlign: "center" }}
              >
                {tripItemCount}
              </span>
            </div>
          )}

          <button
            onClick={() => setChatCollapsed(true)}
            className="p-1.5 rounded-md cursor-pointer transition-colors"
            style={{ color: "var(--text-muted)" }}
            title="Collapse chat pane"
          >
            <PanelLeftClose size={14} />
          </button>
        </div>

        {/* Trip context header — appears once agent has planned */}
        {hasStarted && activeTab === "chat" && <TripHeader />}

        {/* Content */}
        <div className="flex-1 min-h-0">
          {!hasStarted ? (
            <EmptyState onSend={sendMessage} />
          ) : activeTab === "chat" ? (
            <ChatWindow />
          ) : (
            <ItineraryTimeline />
          )}
        </div>
      </div>

      <MapHoverCard
        state={hoverCard}
        onMouseEnter={cancelHoverClose}
        onMouseLeave={() => scheduleHoverClose(() => setHoverCard(null), 300)}
        onOpenDetail={() => {
          if (!hoverCard) return
          const name = hoverCard.target.kind === "place"
            ? hoverCard.target.place.name
            : hoverCard.target.hotel.name
          setHoverCard(null)
          ;(window as any).__voyagerOpenDrawer?.(name)
        }}
      />

      {/* ── Right pane: always-visible map ── */}
      <div className="flex-1 h-full min-w-0 relative">
        <MapPane />

        {chatCollapsed && (
          <button
            onClick={() => setChatCollapsed(false)}
            className="absolute top-4 left-4 flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer z-[1100]"
            style={{
              background: "var(--surface-2)",
              border: "1px solid var(--border)",
              color: "var(--text)",
              boxShadow: "0 2px 10px rgba(0,0,0,0.4)",
            }}
            title="Show chat pane"
          >
            <PanelLeftOpen size={14} />
            <span className="text-xs font-semibold">Chat</span>
          </button>
        )}
      </div>
    </div>
  )
}

function formatTokens(n: number): string {
  if (n < 1000) return `${n}`
  if (n < 10_000) return `${(n / 1000).toFixed(1)}k`
  return `${Math.round(n / 1000)}k`
}
