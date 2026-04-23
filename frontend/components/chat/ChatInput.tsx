"use client"

import { useState } from "react"
import { SendHorizontal } from "lucide-react"

interface Props {
  onSend: (text: string) => void
  disabled?: boolean
}

export function ChatInput({ onSend, disabled }: Props) {
  const [input, setInput] = useState("")

  function submit() {
    const trimmed = input.trim()
    if (!trimmed || disabled) return
    onSend(trimmed)
    setInput("")
  }

  return (
    <div className="p-4 border-t" style={{ borderColor: "var(--border)" }}>
      <div className="flex gap-2 p-1 rounded-2xl" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <input
          className="flex-1 bg-transparent px-4 py-3 text-sm outline-none placeholder-[var(--text-muted)]"
          style={{ color: "var(--text)" }}
          placeholder="Follow up or refine your trip..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && submit()}
          disabled={disabled}
        />
        <button
          onClick={submit}
          disabled={!input.trim() || disabled}
          className="px-4 py-2 rounded-xl transition-opacity disabled:opacity-40 cursor-pointer"
          style={{ background: "var(--accent)" }}
        >
          <SendHorizontal size={16} className="text-white" />
        </button>
      </div>
    </div>
  )
}
