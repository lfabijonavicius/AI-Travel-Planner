"use client"

import ReactMarkdown, { defaultUrlTransform } from "react-markdown"
import { useMemo, useState } from "react"
import { ChatMessage } from "@/types"
import { useTripStore } from "@/hooks/useTripStore"

interface Props {
  message: ChatMessage
}

// ── PlaceLink: inline-styled interactive span ─────────────────────────────────

function PlaceLink({ storeName, children }: { storeName: string; children: React.ReactNode }) {
  const { setHoveredPlace, setSelectedPlaceDetail, setSelectedHotelDetail, places, hotels } = useTripStore()
  const [hovered, setHovered] = useState(false)

  function handleClick() {
    const place = places.find((p) => p.name === storeName)
    if (place) {
      setSelectedPlaceDetail(place)
      return
    }
    const hotel = hotels.find((h) => h.name === storeName)
    if (hotel) {
      setSelectedHotelDetail(hotel)
      return
    }
    setHoveredPlace(storeName)
  }

  return (
    <span
      onMouseEnter={() => { setHovered(true); setHoveredPlace(storeName) }}
      onMouseLeave={() => { setHovered(false); setHoveredPlace(null) }}
      onClick={handleClick}
      style={{
        color: hovered ? "#7bbff5" : "#2e8fe0",
        cursor: "pointer",
        textShadow: hovered ? "0 0 10px rgba(91,163,232,0.6)" : "none",
        transition: "color 0.15s, text-shadow 0.15s",
      }}
    >
      {children}
    </span>
  )
}

// ── linkifyPlaces ─────────────────────────────────────────────────────────────
// Replaces place name occurrences with [match](place:storeName) pseudo-links.
// Uses a flexible regex that allows spaces and dash variants (–/—/-) to differ
// between the API name and the agent's prose spelling.

function nameToPattern(name: string): RegExp {
  const escaped = name
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")      // escape regex metacharacters
    .replace(/\s*[-–—]\s*/g, "\\s*[-–—]\\s*")    // flexible dashes
    .replace(/\s+/g, "\\s+")                       // flexible whitespace
  return new RegExp(`(?<!\\[)${escaped}`, "gi")
}

function linkifyPlaces(content: string, names: string[]): string {
  if (!names.length) return content
  const sorted = [...names].sort((a, b) => b.length - a.length)
  let result = content
  for (const name of sorted) {
    const re = nameToPattern(name)
    // Encode the canonical store name in the href; keep the matched text as display
    result = result.replace(re, (match) => `[${match}](place:${encodeURIComponent(name)})`)
  }
  return result
}

/** Pass place: URLs through; sanitize everything else */
function urlTransform(url: string) {
  if (url.startsWith("place:")) return url
  return defaultUrlTransform(url)
}

// ── ChatBubble ────────────────────────────────────────────────────────────────

export function ChatBubble({ message }: Props) {
  const isUser = message.role === "user"
  const { places, hotels } = useTripStore()

  // Build list of all known names (places + hotel for narrative references)
  const knownNames = useMemo(
    () => [...places.map((p) => p.name), ...hotels.map((h) => h.name)].filter(Boolean),
    [places, hotels]
  )

  const processedContent = useMemo(() => {
    if (isUser || !message.content || !knownNames.length) return message.content
    return linkifyPlaces(message.content, knownNames)
  }, [message.content, knownNames, isUser])

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div
          className="max-w-[75%] px-4 py-3 rounded-2xl rounded-tr-sm text-sm"
          style={{ background: "var(--accent)", color: "white" }}
        >
          {message.content}
        </div>
      </div>
    )
  }

  if (!message.content || message.content.trim().length === 0) return null
  if (/^['"`]?\w{1,8}['"`]?$/.test(message.content.trim()) && !message.toolCalls?.length) return null

  return (
    <div className="flex justify-start">
      <div
        className="max-w-[85%] px-4 py-3 rounded-2xl rounded-tl-sm text-sm"
        style={{ background: "var(--surface-2)", color: "var(--text)", lineHeight: "1.625" }}
      >
        <ReactMarkdown
          urlTransform={urlTransform}
          components={{
            h1: ({ children }) => (
              <p className="font-bold text-base mt-3 mb-1.5" style={{ color: "var(--text)" }}>{children}</p>
            ),
            h2: ({ children }) => (
              <div className="mt-4 mb-2 pb-1.5" style={{ borderBottom: "1px solid var(--border)" }}>
                <p className="font-bold text-sm" style={{ color: "var(--accent-light)" }}>{children}</p>
              </div>
            ),
            h3: ({ children }) => (
              <p className="font-semibold text-sm mt-2 mb-1" style={{ color: "var(--text)" }}>{children}</p>
            ),
            p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
            hr: () => <div className="my-3" style={{ borderTop: "1px solid var(--border)" }} />,
            strong: ({ children }) => (
              <strong className="font-semibold" style={{ color: "var(--text)" }}>{children}</strong>
            ),
            em: ({ children }) => <em style={{ color: "var(--text-muted)" }}>{children}</em>,
            a: ({ href, children }) => {
              if (href?.startsWith("place:")) {
                const storeName = decodeURIComponent(href.slice(6))
                return <PlaceLink storeName={storeName}>{children}</PlaceLink>
              }
              return (
                <a href={href} target="_blank" rel="noopener noreferrer"
                  style={{ color: "var(--accent-light)", textDecoration: "underline" }}>
                  {children}
                </a>
              )
            },
            ul: ({ children }) => <ul className="list-disc pl-5 space-y-0.5 mb-2">{children}</ul>,
            ol: ({ children }) => <ol className="list-decimal pl-5 space-y-0.5 mb-2">{children}</ol>,
            li: ({ children }) => <li className="text-sm">{children}</li>,
            code: ({ children }) => (
              <code className="px-1 rounded text-xs" style={{ background: "var(--surface)", color: "var(--text-muted)" }}>
                {children}
              </code>
            ),
            img: () => null,
          }}
        >
          {processedContent}
        </ReactMarkdown>
      </div>
    </div>
  )
}
