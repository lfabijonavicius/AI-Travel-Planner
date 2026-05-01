import { WeatherDay } from "@/types"
import { useScrollToLatest } from "@/hooks/useScrollToLatest"

interface Props {
  data: WeatherDay[]
}

export function WeatherStrip({ data }: Props) {
  const cardRef = useScrollToLatest(data)
  const safeDays = data.filter(
    (day) =>
      !!day &&
      typeof day.date === "string" &&
      Number.isFinite(day.temp_high_c) &&
      Number.isFinite(day.temp_low_c)
  )

  if (!safeDays.length || (data[0] as any)?.error) {
    return null
  }

  return (
    <div ref={cardRef} className="my-2 rounded-xl overflow-hidden" style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
      <div className="grid" style={{ gridTemplateColumns: `repeat(${Math.min(safeDays.length, 7)}, 1fr)` }}>
        {safeDays.slice(0, 7).map((day) => {
          const isRainy = day.precipitation_probability >= 60
          return (
            <div
              key={day.date}
              className="flex flex-col items-center py-3 px-1 text-center"
              style={{
                background: isRainy ? "rgba(24,95,165,0.08)" : "transparent",
                borderLeft: "1px solid var(--border)",
              }}
            >
              <p className="text-xs mb-1" style={{ color: "var(--text-muted)" }}>
                {new Date(day.date + "T12:00:00").toLocaleDateString("en-GB", { weekday: "short" })}
              </p>
              <p className="text-xl mb-1">{day.weather_icon}</p>
              <p className="text-xs font-semibold" style={{ color: "var(--text)" }}>{Math.round(day.temp_high_c)}°</p>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>{Math.round(day.temp_low_c)}°</p>
              {day.precipitation_probability > 0 && (
                <p className="text-xs mt-1" style={{ color: isRainy ? "#60a5fa" : "var(--text-muted)" }}>
                  {day.precipitation_probability}%
                </p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
