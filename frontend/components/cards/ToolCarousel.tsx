"use client"

import { useEffect, useRef } from "react"

interface ToolCarouselProps {
  eyebrow?: string
  title?: string
  description?: string
  followUps?: { label: string; onClick: () => void }[]
  children: React.ReactNode
}

export function ToolCarousel({ eyebrow, title, description, followUps, children }: ToolCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollLeft = 0
  }, [])

  return (
    <div className="my-4 space-y-4">
      {(eyebrow || title || description) && (
        <div
          className="rounded-2xl px-4 py-3"
          style={{
            background: "linear-gradient(135deg, rgba(24,95,165,0.18), rgba(61,140,214,0.08))",
            border: "1px solid rgba(61,140,214,0.24)",
            boxShadow: "var(--card-shadow)",
          }}
        >
          {eyebrow && (
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--accent-light)" }}>
              {eyebrow}
            </p>
          )}
          {title && (
            <p className="text-sm font-semibold leading-relaxed" style={{ color: "var(--text)" }}>
              {title}
            </p>
          )}
          {description && (
            <p className={`text-sm leading-relaxed ${title ? "mt-1" : ""}`} style={{ color: "var(--text)" }}>
              {description}
            </p>
          )}
        </div>
      )}

      <div className="relative">
        <div
          ref={scrollRef}
          className="flex gap-4 overflow-x-auto pb-2 snap-x snap-mandatory"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {children}
        </div>
      </div>

      {!!followUps?.length && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--text-muted)" }}>
            You might want to ask
          </p>
          <div className="flex flex-wrap gap-2">
            {followUps.map((item) => (
              <button
                key={item.label}
                onClick={item.onClick}
                className="text-xs px-3 py-1.5 rounded-full cursor-pointer transition-all"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  color: "var(--text)",
                  border: "1px solid var(--border)",
                }}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
