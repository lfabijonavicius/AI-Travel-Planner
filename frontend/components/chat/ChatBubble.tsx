"use client"

import ReactMarkdown, { defaultUrlTransform } from "react-markdown"
import { useMemo, useRef } from "react"
import { ChatMessage, PlaceResult } from "@/types"
import { useTripStore, cancelHoverClose, scheduleHoverClose } from "@/hooks/useTripStore"
import { categoryIcon } from "@/lib/placeIcon"
import { buildBrowseMessageMarkdown } from "@/lib/placeBrowse"

interface Props {
  message: ChatMessage
}

// ── PlaceLink: inline-styled interactive span ─────────────────────────────────

function PlaceLink({ storeName, children }: { storeName: string; children: React.ReactNode }) {
  const {
    setHoveredPlace, setSelectedPlaceDetail, setSelectedHotelDetail,
    places, hotels, pinnedPlaceIds,
    showHoverCardAtPoint, setHoverCard,
  } = useTripStore()
  const anchorRef = useRef<HTMLSpanElement>(null)

  const place = places.find((p) => p.name === storeName)
  const hotel = hotels.find((h) => h.name === storeName)
  const isPinned = pinnedPlaceIds.has(storeName)
  const icon = hotel ? "🏨" : place ? categoryIcon(place.category) : "📍"

  function handleMouseEnter() {
    setHoveredPlace(storeName)
    const node = anchorRef.current
    if (!node) return
    const rect = node.getBoundingClientRect()
    // Left-align card with the link; MapHoverCard adds CARD_OFFSET (14) to x
    const x = Math.max(0, rect.left - 14)
    // Show card above the link when there's room (card is ~420px tall).
    // MapHoverCard renders at top = state.y - 130, so back-calculate state.y:
    //   above: card.top = rect.top - 428  → state.y = rect.top - 298
    //   below: card.top = rect.bottom + 8 → state.y = rect.bottom + 138
    const y = rect.top >= 450 ? rect.top - 298 : rect.bottom + 138
    cancelHoverClose()
    if (place) {
      showHoverCardAtPoint({ kind: "place", place }, x, y)
    } else if (hotel) {
      showHoverCardAtPoint(
        {
          kind: "hotel",
          hotel: {
            name: hotel.name,
            photo_url: hotel.photo_url,
            photo_urls: (hotel as any).photo_urls,
            review_score: hotel.review_score,
            stars: hotel.stars,
            price_per_night_gbp: hotel.price_per_night_gbp,
            currency: hotel.currency,
          },
        },
        x,
        y
      )
    }
  }

  function handleMouseLeave() {
    setHoveredPlace(null)
    scheduleHoverClose(() => setHoverCard(null), 500)
  }

  function handleClick() {
    if (place) { setSelectedPlaceDetail(place); return }
    if (hotel) { setSelectedHotelDetail(hotel); return }
    setHoveredPlace(storeName)
  }

  return (
    <span
      ref={anchorRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
      style={{
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
        gap: "4px",
        padding: "1px 7px 1px 6px",
        borderRadius: "6px",
        background: "rgba(61,140,214,0.10)",
        border: "1px solid rgba(61,140,214,0.28)",
        color: "#b8daf5",
        cursor: "pointer",
        fontSize: "0.92em",
        fontWeight: 500,
        lineHeight: "1.5",
        transition: "all 0.15s",
        whiteSpace: "nowrap",
      }}
    >
      <span style={{ fontSize: "0.9em", opacity: 0.85 }}>{icon}</span>
      <span>{children}</span>
      {isPinned && (
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: "14px",
            height: "14px",
            borderRadius: "50%",
            background: "#185FA5",
            color: "white",
            fontSize: "9px",
            fontWeight: 700,
            marginLeft: "1px",
          }}
        >
          ✓
        </span>
      )}
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
  const protectedPattern = /(\[[^\]]+\]\([^)]+\)|`[^`]*`)/g
  const isProtectedSegment = (segment: string) =>
    /^(\[[^\]]+\]\([^)]+\)|`[^`]*`)$/.test(segment)
  const parts = content.split(protectedPattern)

  return parts
    .map((part) => {
      if (!part) return part
      if (isProtectedSegment(part)) return part

      let result = part
      for (const name of sorted) {
        const re = nameToPattern(name)
        result = result.replace(re, (match) => `[${match}](place:${encodeURIComponent(name)})`)
      }
      return result
    })
    .join("")
}

/** Pass place: URLs through; sanitize everything else */
function urlTransform(url: string) {
  if (url.startsWith("place:")) return url
  return defaultUrlTransform(url)
}

// ── stripToolJson ─────────────────────────────────────────────────────────────
// Removes raw JSON blobs that the agent occasionally echoes into its text
// output. Handles both object form {…} and array form […] using bracket-depth
// scanning so it works when the JSON is followed immediately by prose.
function stripToolJson(content: string): string {
  let result = content

  // Strip leading JSON array (e.g. suggest_destinations output)
  // Match [{...}] at the very start where content contains destination-like markers
  result = result.replace(/^\s*(\[\s*\{[^]*?\}\s*\])(?=\s*\S|$)/, (match) => {
    if (match.includes('"country"') || match.includes('"tags"') || match.includes('"description"')) {
      return ""
    }
    return match
  }).trim()

  // Strip object-form JSON (itinerary / other tool outputs embedded mid-text)
  const markers = ['"trip_id"', '"day_number"', '"destination":"', '"tags":[']
  for (const marker of markers) {
    let idx = result.indexOf(marker)
    while (idx !== -1) {
      // Walk back to the opening { or [
      let start = idx
      while (start > 0 && result[start] !== "{" && result[start] !== "[") start--
      if (result[start] !== "{" && result[start] !== "[") break
      const opener = result[start]
      const closer = opener === "{" ? "}" : "]"
      // Scan forward with depth counter to find matching closer
      let depth = 0
      let end = -1
      for (let i = start; i < result.length; i++) {
        if (result[i] === opener) depth++
        else if (result[i] === closer) { depth--; if (depth === 0) { end = i; break } }
      }
      // Only strip if we found the complete closer (depth reached 0)
      if (end === -1) break
      result = (result.slice(0, start) + result.slice(end + 1)).trim()
      idx = result.indexOf(marker)
    }
  }
  return result
}

function looksLikeTransientToolJson(content: string): boolean {
  const trimmed = content.trim()
  if (!trimmed) return false

  const jsonLikeStart =
    trimmed.startsWith("[{") ||
    trimmed.startsWith('{"') ||
    trimmed.startsWith('[{"') ||
    trimmed.startsWith('["') ||
    trimmed.startsWith("[\n{")

  if (!jsonLikeStart) return false

  return (
    trimmed.includes('"name"') ||
    trimmed.includes('"country"') ||
    trimmed.includes('"headline"') ||
    trimmed.includes('"description"') ||
    trimmed.includes('"tags"') ||
    trimmed.includes('"trip_id"') ||
    trimmed.includes('"day_number"')
  )
}

function extractBrowsePlaces(message: ChatMessage): PlaceResult[] {
  const toolOutputs = message.toolCalls ?? []
  return toolOutputs.flatMap((toolCall) => {
    if (toolCall.tool !== "search_places" || !Array.isArray(toolCall.output)) return []
    return toolCall.output.filter(
      (item): item is PlaceResult =>
        !!item &&
        typeof item === "object" &&
        typeof (item as PlaceResult).name === "string" &&
        Number.isFinite((item as PlaceResult).lat) &&
        Number.isFinite((item as PlaceResult).lng)
    )
  })
}

function isBrowseInfoMessage(message: ChatMessage) {
  if (!message.toolCalls?.length) return false
  const hasPlaces = message.toolCalls.some(
    (toolCall) => toolCall.tool === "search_places" && Array.isArray(toolCall.output)
  )
  const hasPlanningTools = message.toolCalls.some((toolCall) =>
    ["generate_itinerary", "search_flights", "search_hotels", "calculate_budget"].includes(toolCall.tool)
  )
  return hasPlaces && !hasPlanningTools
}

// ── ChatBubble ────────────────────────────────────────────────────────────────

export function ChatBubble({ message }: Props) {
  const isUser = message.role === "user"
  const { places, hotels, destinations, countryInfo } = useTripStore()
  const browsePlaces = useMemo(() => extractBrowsePlaces(message), [message])

  // Build list of all known names (places + hotels + destinations + country) for narrative references
  const knownNames = useMemo(
    () => [
      ...places.map((p) => p.name),
      ...hotels.map((h) => h.name),
      ...destinations.map((d) => d.name),
      ...destinations.map((d) => d.country).filter((c): c is string => !!c),
      ...(countryInfo?.name ? [countryInfo.name] : []),
    ].filter(Boolean),
    [places, hotels, destinations, countryInfo]
  )

  const processedContent = useMemo(() => {
    if (isUser || !message.content) return message.content
    // Strip raw itinerary JSON blobs using bracket-depth scanning
    let stripped = stripToolJson(message.content)
    if (isBrowseInfoMessage(message) && browsePlaces.length >= 3) {
      stripped = buildBrowseMessageMarkdown(browsePlaces, stripped)
    }
    if (!knownNames.length) return stripped
    return linkifyPlaces(stripped, knownNames)
  }, [message, message.content, knownNames, isUser, browsePlaces])

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div
          className="max-w-[64%] px-4 py-3 rounded-2xl rounded-tr-sm text-sm"
          style={{ background: "var(--accent)", color: "white" }}
        >
          {message.content}
        </div>
      </div>
    )
  }

  if (!message.content || message.content.trim().length === 0) return null
  if (looksLikeTransientToolJson(message.content)) return null
  if (!processedContent || processedContent.trim().length === 0) return null
  if (/^['"`]?\w{1,8}['"`]?$/.test(message.content.trim()) && !message.toolCalls?.length) return null

  return (
    <div className="flex justify-start">
      <div
        className="max-w-[78%] px-4 py-3 rounded-2xl rounded-tl-sm text-sm"
        style={{ background: "var(--surface-2)", color: "var(--text)", lineHeight: "1.625" }}
      >
        <ReactMarkdown
          urlTransform={urlTransform}
          components={{
            h1: ({ children }) => (
              <p className="font-bold text-lg mt-3 mb-2" style={{ color: "var(--text)", letterSpacing: "-0.01em" }}>{children}</p>
            ),
            h2: ({ children }) => (
              <p className="font-bold text-[15px] mt-4 mb-2" style={{ color: "var(--text)", letterSpacing: "-0.005em" }}>{children}</p>
            ),
            h3: ({ children }) => (
              <p className="font-semibold text-sm mt-3 mb-1.5" style={{ color: "var(--text)" }}>{children}</p>
            ),
            p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
            hr: () => <div className="my-4" style={{ borderTop: "1px solid var(--border)" }} />,
            strong: ({ children }) => (
              <strong className="font-semibold" style={{ color: "var(--text)" }}>{children}</strong>
            ),
            em: ({ children }) => (
              <em style={{ color: "var(--text-muted)", fontSize: "0.8em", fontStyle: "italic" }}>
                {children}
              </em>
            ),
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
            ul: ({ children }) => (
              <ul className="pl-1 mb-2.5 space-y-1.5" style={{ listStyle: "none" }}>{children}</ul>
            ),
            ol: ({ children }) => (
              <ol className="list-decimal pl-5 mb-2.5 space-y-1.5">{children}</ol>
            ),
            li: ({ children }) => (
              <li
                className="text-sm leading-relaxed pl-4 relative"
                style={{ color: "var(--text)" }}
              >
                <span
                  style={{
                    position: "absolute",
                    left: 4,
                    top: "0.55em",
                    width: 4,
                    height: 4,
                    borderRadius: "50%",
                    background: "var(--accent-light)",
                    opacity: 0.7,
                  }}
                />
                {children}
              </li>
            ),
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
