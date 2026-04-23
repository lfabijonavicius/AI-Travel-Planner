"use client"

import { MapPin, Plus } from "lucide-react"

export function Sidebar() {
  return (
    <aside
      className="flex flex-col h-full w-[220px] flex-shrink-0 border-r"
      style={{ background: "var(--surface)", borderColor: "var(--border)" }}
    >
      {/* Brand */}
      <div className="flex items-center gap-2 px-4 py-5 border-b" style={{ borderColor: "var(--border)" }}>
        <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "var(--accent)" }}>
          <MapPin size={14} className="text-white" />
        </div>
        <span className="font-semibold text-sm" style={{ color: "var(--text)" }}>Voyager</span>
      </div>

      {/* New trip */}
      <div className="px-3 py-3">
        <button
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors cursor-pointer"
          style={{ color: "var(--text-muted)", border: "1px dashed var(--border)" }}
          onMouseEnter={(e) => e.currentTarget.style.borderColor = "var(--accent)"}
          onMouseLeave={(e) => e.currentTarget.style.borderColor = "var(--border)"}
        >
          <Plus size={14} />
          New trip
        </button>
      </div>

      {/* Saved trips placeholder */}
      <div className="flex-1 px-3 py-2">
        <p className="text-xs px-2 mb-2" style={{ color: "var(--text-muted)" }}>Recent</p>
        <p className="text-xs px-2" style={{ color: "var(--border)" }}>No saved trips yet</p>
      </div>
    </aside>
  )
}
