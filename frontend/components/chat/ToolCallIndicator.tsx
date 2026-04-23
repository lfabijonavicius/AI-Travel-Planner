const TOOL_LABELS: Record<string, string> = {
  search_flights:       "Searching flights",
  search_hotels:        "Searching hotels",
  get_weather_forecast: "Checking weather",
  get_currency_exchange:"Getting exchange rates",
  get_country_info:     "Looking up country info",
  search_places:        "Finding places to visit",
  calculate_budget:     "Calculating budget",
  generate_itinerary:   "Building your itinerary…",
}

interface Props {
  tool: string
  done?: boolean
}

export function ToolCallIndicator({ tool, done }: Props) {
  const label = TOOL_LABELS[tool] ?? tool

  return (
    <div className="flex items-center gap-2.5 py-1 px-1">
      {done ? (
        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: "#22c55e" }} />
      ) : (
        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 tool-pulse" style={{ background: "var(--accent-light)" }} />
      )}
      <span className="text-xs" style={{ color: done ? "var(--text-muted)" : "var(--accent-light)", opacity: done ? 0.6 : 1 }}>
        {label}{!done && ""}
      </span>
      {!done && (
        <div className="flex gap-0.5 ml-0.5">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="w-1 h-1 rounded-full tool-pulse"
              style={{
                background: "var(--accent-light)",
                opacity: 0.6,
                animationDelay: `${i * 0.2}s`,
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}
