"use client"

import { PlaceReview } from "@/types"

export function RatingStars({ rating, size = 14 }: { rating: number; size?: number }) {
  const full = Math.round(rating)
  return (
    <span style={{ color: "#f59e0b", letterSpacing: "1px", fontSize: `${size}px` }}>
      {"★".repeat(full)}{"☆".repeat(5 - full)}
    </span>
  )
}

export function ReviewCard({ review }: { review: PlaceReview }) {
  return (
    <div
      className="rounded-2xl p-3.5"
      style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))", border: "1px solid var(--border-subtle)" }}
    >
      <div className="flex items-center gap-3 mb-2.5">
        {review.author_photo ? (
          <img src={review.author_photo} alt={review.author} className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
        ) : (
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold"
            style={{ background: "var(--accent)", color: "white" }}
          >
            {review.author.charAt(0).toUpperCase()}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold truncate" style={{ color: "var(--text)" }}>{review.author}</p>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>{review.relative_time}</p>
        </div>
        {review.rating != null && <RatingStars rating={review.rating} size={11} />}
      </div>
      <p className="text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>{review.text}</p>
    </div>
  )
}

export function DetailSection({
  id,
  eyebrow,
  title,
  children,
}: {
  id?: string
  eyebrow: string
  title?: string
  children: React.ReactNode
}) {
  return (
    <section
      id={id}
      className="rounded-2xl px-4 py-4"
      style={{ background: "var(--surface-2)", border: "1px solid var(--border-subtle)" }}
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] mb-2" style={{ color: "var(--accent-light)" }}>
        {eyebrow}
      </p>
      {title ? (
        <p className="text-sm font-semibold mb-2" style={{ color: "var(--text)" }}>{title}</p>
      ) : null}
      {children}
    </section>
  )
}

export function MetricCard({
  label,
  value,
  tone = "default",
}: {
  label: string
  value: React.ReactNode
  tone?: "default" | "accent" | "warm" | "success"
}) {
  const toneStyles =
    tone === "accent"
      ? { border: "1px solid rgba(61,140,214,0.22)", background: "rgba(61,140,214,0.08)" }
      : tone === "warm"
        ? { border: "1px solid rgba(245,158,11,0.22)", background: "rgba(245,158,11,0.08)" }
        : tone === "success"
          ? { border: "1px solid rgba(34,197,94,0.22)", background: "rgba(34,197,94,0.08)" }
          : { border: "1px solid var(--border-subtle)", background: "var(--surface-3)" }

  return (
    <div className="rounded-xl px-3 py-2.5" style={toneStyles}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] mb-1" style={{ color: "var(--text-muted)" }}>{label}</p>
      <div className="text-sm font-semibold leading-snug" style={{ color: "var(--text)" }}>{value}</div>
    </div>
  )
}

export function DrawerNavPill({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="rounded-full px-3 py-1.5 text-[11px] font-semibold cursor-pointer transition-all hover:translate-y-[-1px]"
      style={{ background: "rgba(255,255,255,0.04)", color: "var(--text)", border: "1px solid var(--border-subtle)" }}
    >
      {label}
    </button>
  )
}

export function DrawerTab({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="border-b-2 px-0 pb-2 pt-1 text-sm font-medium cursor-pointer transition-colors"
      style={{
        color: active ? "var(--text)" : "var(--text-muted)",
        borderColor: active ? "rgba(255,255,255,0.92)" : "transparent",
      }}
    >
      {label}
    </button>
  )
}

export function AskPrompt({ prompt, onClick }: { prompt: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full rounded-2xl px-4 py-3 text-left cursor-pointer transition-all hover:translate-y-[-1px]"
      style={{
        background: "linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))",
        border: "1px solid var(--border-subtle)",
      }}
    >
      <span className="text-sm leading-relaxed" style={{ color: "var(--text)" }}>{prompt}</span>
    </button>
  )
}
