"use client"

import dynamic from "next/dynamic"
import { MapPin } from "lucide-react"
import { useTripStore } from "@/hooks/useTripStore"
import { useSSE } from "@/hooks/useSSE"
import { EmptyState } from "@/components/empty/EmptyState"
import { ChatWindow } from "@/components/chat/ChatWindow"
import { ItineraryTimeline } from "@/components/itinerary/ItineraryTimeline"

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
  const { hasStarted, activeTab, setActiveTab, itinerary } = useTripStore()
  const { sendMessage } = useSSE()

  return (
    <div className="flex h-full" style={{ background: "var(--background)" }}>
      {/* ── Left pane ── */}
      <div
        className="flex flex-col h-full flex-shrink-0"
        style={{
          width: "45%",
          background: "var(--surface)",
          borderRight: "1px solid var(--border)",
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
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: "var(--accent)", boxShadow: "0 2px 8px rgba(24,95,165,0.5)" }}
          >
            <MapPin size={13} className="text-white" />
          </div>
          <span className="font-bold text-sm tracking-tight" style={{ color: "var(--text)" }}>
            Voyager
          </span>

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
                      className="ml-1.5 text-xs px-1.5 py-0.5 rounded-full"
                      style={{ background: "var(--accent)", color: "white", fontSize: "10px" }}
                    >
                      {itinerary.days.length}d
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

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

      {/* ── Right pane: always-visible map ── */}
      <div className="flex-1 h-full min-w-0">
        <MapPane />
      </div>
    </div>
  )
}
