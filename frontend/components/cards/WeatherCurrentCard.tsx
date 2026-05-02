"use client"

import { CurrentWeather } from "@/types"
import { useScrollToLatest } from "@/hooks/useScrollToLatest"
import { Droplets, Wind } from "lucide-react"

interface Props {
  data: CurrentWeather
}

export function WeatherCurrentCard({ data }: Props) {
  const cardRef = useScrollToLatest(data)

  if (!data || (data as any).error || typeof data.temp_c !== "number") return null

  const rangeSpan = data.temp_max_c - data.temp_min_c
  const showRange = rangeSpan > 0.5
  const fillPct = showRange
    ? Math.round(((data.temp_c - data.temp_min_c) / rangeSpan) * 100)
    : 50

  return (
    <div
      ref={cardRef}
      className="my-2 rounded-xl overflow-hidden"
      style={{
        background: "var(--surface-2)",
        border: "1px solid var(--border)",
        boxShadow: "var(--card-shadow)",
      }}
    >
      {/* Header */}
      <div
        className="px-4 py-2 flex items-center"
        style={{
          background: "linear-gradient(135deg, rgba(24,95,165,0.18), rgba(61,140,214,0.08))",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <span className="text-xs font-medium tracking-wide uppercase" style={{ color: "var(--text-muted)" }}>
          Current Weather
        </span>
        <span className="text-xs ml-auto" style={{ color: "var(--text-dim)" }}>
          {data.city}
        </span>
      </div>

      {/* Body */}
      <div className="flex items-stretch">
        {/* Left — hero temp */}
        <div
          className="flex flex-col items-center justify-center px-6 py-5 gap-1"
          style={{ minWidth: 120 }}
        >
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center mb-1"
            style={{ background: "rgba(61,140,214,0.08)", border: "1px solid rgba(61,140,214,0.15)" }}
          >
            <span className="text-3xl leading-none">{data.weather_icon}</span>
          </div>
          <p
            className="text-3xl font-bold leading-none tracking-tight"
            style={{ color: "var(--text)" }}
          >
            {Math.round(data.temp_c)}°
          </p>
          <p className="text-xs text-center mt-0.5" style={{ color: "var(--text-muted)", maxWidth: 88 }}>
            {data.condition}
          </p>
        </div>

        {/* Divider */}
        <div className="w-px my-4" style={{ background: "var(--border)" }} />

        {/* Right — stats */}
        <div className="flex flex-col justify-center gap-3 px-5 py-4 flex-1">
          {/* Feels like */}
          <div className="flex items-center justify-between">
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>Feels like</span>
            <span className="text-xs font-semibold" style={{ color: "var(--text)" }}>
              {Math.round(data.feels_like_c)}°C
            </span>
          </div>

          {/* Temp range */}
          {showRange ? (
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>Range</span>
                <span className="text-xs font-semibold" style={{ color: "var(--text)" }}>
                  {Math.round(data.temp_min_c)}° – {Math.round(data.temp_max_c)}°
                </span>
              </div>
              <div className="h-1 rounded-full overflow-hidden" style={{ background: "var(--border)" }}>
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.min(Math.max(fillPct, 6), 94)}%`,
                    background: "linear-gradient(90deg, #185fa5, #60a5fa)",
                  }}
                />
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>High / Low</span>
              <span className="text-xs font-semibold" style={{ color: "var(--text)" }}>
                {Math.round(data.temp_max_c)}° / {Math.round(data.temp_min_c)}°
              </span>
            </div>
          )}

          {/* Humidity + Wind row */}
          <div
            className="flex items-center gap-3 pt-1"
            style={{ borderTop: "1px solid var(--border-subtle)" }}
          >
            <div className="flex items-center gap-1.5">
              <Droplets size={11} style={{ color: "var(--accent-light)" }} />
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                {data.humidity_pct}%
              </span>
            </div>
            <div className="w-px h-3" style={{ background: "var(--border)" }} />
            <div className="flex items-center gap-1.5">
              <Wind size={11} style={{ color: "var(--text-dim)" }} />
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                {data.wind_speed_ms} m/s
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
