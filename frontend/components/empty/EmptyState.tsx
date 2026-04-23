"use client"

import { useState } from "react"
import { MapPin } from "lucide-react"

const SUGGESTIONS = [
  "Plan a week in Tokyo, budget £2,400",
  "Weekend in Barcelona for 2",
  "Surprise me — somewhere warm in June",
]

interface Props {
  onSend: (text: string) => void
}

export function EmptyState({ onSend }: Props) {
  const [input, setInput] = useState("")

  function submit(text: string) {
    const trimmed = text.trim()
    if (!trimmed) return
    onSend(trimmed)
    setInput("")
  }

  return (
    <div className="flex flex-col items-center justify-center h-full gap-8 px-6">
      {/* Logo */}
      <div className="flex flex-col items-center gap-3">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
          style={{ background: "var(--accent)" }}>
          <MapPin size={28} className="text-white" />
        </div>
        <h1 className="text-3xl font-semibold tracking-tight" style={{ color: "var(--text)" }}>
          Voyager
        </h1>
        <p style={{ color: "var(--text-muted)" }} className="text-sm">
          Describe a trip — I'll handle flights, hotels, places, and a full itinerary.
        </p>
      </div>

      {/* Suggestion chips */}
      <div className="flex flex-wrap gap-2 justify-center max-w-lg">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            onClick={() => submit(s)}
            className="px-4 py-2 rounded-full text-sm transition-colors cursor-pointer"
            style={{
              background: "var(--surface-2)",
              color: "var(--text-muted)",
              border: "1px solid var(--border)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = "var(--text)"
              e.currentTarget.style.borderColor = "var(--accent)"
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = "var(--text-muted)"
              e.currentTarget.style.borderColor = "var(--border)"
            }}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Input */}
      <div className="w-full max-w-xl">
        <div className="flex gap-2 p-1 rounded-2xl" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <input
            className="flex-1 bg-transparent px-4 py-3 text-sm outline-none placeholder-[var(--text-muted)]"
            style={{ color: "var(--text)" }}
            placeholder="Where to?"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit(input)}
            autoFocus
          />
          <button
            onClick={() => submit(input)}
            disabled={!input.trim()}
            className="px-5 py-2 rounded-xl text-sm font-medium text-white transition-opacity disabled:opacity-40 cursor-pointer"
            style={{ background: "var(--accent)" }}
          >
            Plan
          </button>
        </div>
      </div>
    </div>
  )
}
