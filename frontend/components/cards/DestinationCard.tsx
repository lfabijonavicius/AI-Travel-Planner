"use client"

import { DestinationSuggestion } from "@/types"
import { ArrowRight, Compass, Landmark, Sparkles, Trees, Waves, Wallet } from "lucide-react"
import { useTripStore } from "@/hooks/useTripStore"
import { useSSE } from "@/hooks/useSSE"
import { useScrollToLatest } from "@/hooks/useScrollToLatest"
import { ToolCarousel } from "./ToolCarousel"

interface Props {
  data: DestinationSuggestion[]
}

export function DestinationCard({ data }: Props) {
  const cardRef = useScrollToLatest(data)
  const { sendMessage } = useSSE()

  if (!data?.length || (data[0] as unknown as { error?: string })?.error) {
    return (
      <div
        className="rounded-xl p-3 my-2 text-sm"
        style={{ background: "var(--surface-2)", color: "#f87171", border: "1px solid var(--border)" }}
      >
        {(data?.[0] as unknown as { error?: string })?.error ?? "No destinations found"}
      </div>
    )
  }

  return (
    <div ref={cardRef} className="my-4 space-y-4">
      <div
        className="rounded-2xl px-4 py-3"
        style={{
          background: "linear-gradient(135deg, rgba(24,95,165,0.18), rgba(61,140,214,0.08))",
          border: "1px solid rgba(61,140,214,0.24)",
          boxShadow: "var(--card-shadow)",
        }}
      >
        <div className="flex items-center gap-2 mb-1.5">
          <Sparkles size={14} style={{ color: "var(--accent-light)" }} />
          <p className="text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--accent-light)" }}>
            Warm June Directions
          </p>
        </div>
        <p className="text-sm leading-relaxed" style={{ color: "var(--text)" }}>
          Browse a few distinct warm-weather directions, then pick the one whose pace feels right and plan from there.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <RefineButton
          icon={Waves}
          label="More beach"
          onClick={() => sendMessage("Refine these ideas toward more beach, swimming, and easy warm weather in June.")}
        />
        <RefineButton
          icon={Landmark}
          label="More culture"
          onClick={() => sendMessage("Refine these ideas toward culture, food, and walkable cities in June.")}
        />
        <RefineButton
          icon={Trees}
          label="More scenic"
          onClick={() => sendMessage("Refine these ideas toward scenic landscapes, charming towns, and a more relaxing pace in June.")}
        />
        <RefineButton
          icon={Wallet}
          label="Lower budget"
          onClick={() => sendMessage("Refine these ideas toward lower-cost warm destinations for June, ideally easier on budget from London.")}
        />
      </div>

      <ToolCarousel
        followUps={buildFollowUps(data).map((prompt) => ({
          label: prompt,
          onClick: () => sendMessage(prompt),
        }))}
      >
        {data.map((dest, i) => (
          <div key={`${dest.name}-${i}`} className="snap-start shrink-0 w-[252px]">
            <DestinationItem destination={dest} index={i + 1} />
          </div>
        ))}
      </ToolCarousel>
    </div>
  )
}

function DestinationItem({ destination, index }: { destination: DestinationSuggestion; index: number }) {
  const { setTargetLocation, setSelectedDestinationDetail } = useTripStore()
  const { sendMessage } = useSSE()

  function handlePlanThis() {
    sendMessage(`Plan a trip to ${destination.name}, ${destination.country}`, {
      destination: destination.name,
      origin: "LON",
    })
  }

  function handleRefineThis() {
    const framing = destination.headline || destination.plan_title || destination.name
    sendMessage(`Give me more ideas like "${framing}" for ${destination.name}, but refine the vibe and keep it warm-weather focused.`)
  }

  function handleOpenDetail() {
    if (destination.lat && destination.lng) {
      setTargetLocation({ lat: destination.lat, lng: destination.lng })
    }
    setSelectedDestinationDetail(destination)
  }

  const shortDescription = truncate(destination.description, 118)
  const socialLine = destination.rating_count
    ? `Mentioned by ${formatCount(destination.rating_count)} travelers`
    : destination.best_for || destination.why_now

  return (
    <div
      onClick={handleOpenDetail}
      className="rounded-2xl overflow-hidden cursor-pointer transition-all"
      style={{
        background: "var(--surface-2)",
        border: "1px solid var(--border-subtle)",
        boxShadow: "var(--card-shadow)",
      }}
    >
      <div className="relative aspect-[0.96] overflow-hidden" style={{ background: "#1a1e2e" }}>
        {destination.photo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={destination.photo_url} alt={destination.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-4xl opacity-40">🌍</div>
        )}
        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(to top, rgba(5,10,18,0.92), rgba(5,10,18,0.12) 48%, rgba(5,10,18,0))" }}
        />

        <div className="absolute top-3 left-3 flex items-center gap-2">
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
            style={{
              background: "rgba(11,18,30,0.82)",
              color: "white",
              border: "1px solid rgba(255,255,255,0.16)",
              backdropFilter: "blur(8px)",
            }}
          >
            {index}
          </div>
          <div
            className="max-w-[170px] px-2.5 py-1 rounded-full text-[11px] font-semibold truncate"
            style={{
              background: "rgba(11,18,30,0.82)",
              color: "rgba(255,255,255,0.92)",
              border: "1px solid rgba(255,255,255,0.14)",
              backdropFilter: "blur(8px)",
            }}
          >
            {destination.headline || "Trip direction"}
          </div>
        </div>

        {destination.rating != null && (
          <div
            className="absolute top-3 right-3 px-2 py-1 rounded-full text-[11px] font-semibold"
            style={{
              background: "rgba(11,18,30,0.82)",
              color: "white",
              border: "1px solid rgba(255,255,255,0.14)",
              backdropFilter: "blur(8px)",
            }}
          >
            ★ {destination.rating.toFixed(1)}
          </div>
        )}

        <div className="absolute left-0 right-0 bottom-0 px-4 pb-4 pt-10">
          <h3 className="font-bold text-lg leading-tight text-white">{destination.name}</h3>
          <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.72)" }}>
            {destination.region || destination.country}
          </p>
        </div>
      </div>

      <div className="p-4">
        <p className="text-sm leading-relaxed mb-3" style={{ color: "var(--text)" }}>
          {shortDescription}
        </p>

        <div className="space-y-2 mb-3">
          {destination.why_now && <MiniFact label="Why now" value={truncate(destination.why_now, 70)} />}
          {destination.best_for && <MiniFact label="Best for" value={truncate(destination.best_for, 64)} />}
          {destination.tradeoff && <MiniFact label="Tradeoff" value={truncate(destination.tradeoff, 62)} subdued />}
        </div>

        <div className="flex gap-1.5 flex-wrap mb-3">
          {destination.tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="text-[11px] px-2 py-0.5 rounded-full"
              style={{
                background: "rgba(255,255,255,0.04)",
                color: "var(--text-muted)",
                border: "1px solid var(--border)",
              }}
            >
              {tag}
            </span>
          ))}
        </div>

        {socialLine && (
          <p className="text-[11px] mb-3" style={{ color: "var(--text-muted)" }}>
            {socialLine}
          </p>
        )}

        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation()
              handlePlanThis()
            }}
            className="text-xs font-semibold px-3 py-2 rounded-lg cursor-pointer flex items-center gap-1.5"
            style={{
              background: "var(--accent)",
              color: "white",
              boxShadow: "0 2px 8px rgba(24,95,165,0.35)",
            }}
          >
            {destination.plan_title || `Plan ${destination.name}`}
            <ArrowRight size={12} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              handleRefineThis()
            }}
            className="text-xs font-semibold px-3 py-2 rounded-lg cursor-pointer"
            style={{
              background: "transparent",
              color: "var(--text)",
              border: "1px solid var(--border)",
            }}
          >
            Refine
          </button>
        </div>
      </div>
    </div>
  )
}

function MiniFact({ label, value, subdued = false }: { label: string; value: string; subdued?: boolean }) {
  return (
    <div
      className="rounded-xl px-3 py-2"
      style={{
        background: subdued ? "rgba(255,255,255,0.035)" : "rgba(24,95,165,0.07)",
        border: `1px solid ${subdued ? "var(--border)" : "rgba(61,140,214,0.16)"}`,
      }}
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] mb-1" style={{ color: "var(--text-muted)" }}>
        {label}
      </p>
      <p className="text-xs leading-relaxed" style={{ color: "var(--text)" }}>
        {value}
      </p>
    </div>
  )
}

function RefineButton({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof Compass
  label: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="text-xs font-semibold px-3 py-2 rounded-full cursor-pointer transition-all flex items-center gap-1.5"
      style={{
        background: "rgba(255,255,255,0.04)",
        color: "var(--text)",
        border: "1px solid var(--border)",
      }}
    >
      <Icon size={13} style={{ color: "var(--accent-light)" }} />
      {label}
    </button>
  )
}

function buildFollowUps(data: DestinationSuggestion[]) {
  const prompts: string[] = []
  const beach = data.find((d) => d.tags.some((tag) => /beach|island|swim/i.test(tag)))
  const culture = data.find((d) => d.tags.some((tag) => /culture|history|food|city/i.test(tag)))
  const scenic = data.find((d) => d.tags.some((tag) => /adventure|nature|wellness|scenic/i.test(tag)))

  if (beach) prompts.push(`Best beaches in ${beach.name}?`)
  if (culture) prompts.push(`Must-try food in ${culture.name}?`)
  if (scenic) prompts.push(`What makes ${scenic.name} the most scenic option?`)
  if (data[0]) prompts.push(`Which of these is easiest from London?`)

  return Array.from(new Set(prompts)).slice(0, 4)
}

function truncate(value: string | undefined, max: number) {
  if (!value) return ""
  return value.length > max ? `${value.slice(0, max - 1).trimEnd()}…` : value
}

function formatCount(value: number) {
  if (value >= 1000) return `${(value / 1000).toFixed(1).replace(".0", "")}k`
  return `${value}`
}
