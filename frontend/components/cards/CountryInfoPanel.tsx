import { CountryInfo } from "@/types"

interface Props {
  data: CountryInfo
}

export function CountryInfoPanel({ data }: Props) {
  if (!data || (data as any).error) return null

  const tiles = [
    { label: "Language",     value: (data.languages ?? []).slice(0, 2).join(", ") || "—" },
    { label: "Currency",     value: (data.currencies ?? []).map((c) => `${c.code} ${c.symbol}`).join(", ") || "—" },
    { label: "Timezone",     value: data.timezone || "—" },
    { label: "Calling code", value: data.calling_code || "—" },
    { label: "Driving",      value: data.driving_side || "—" },
    { label: "Population",   value: data.population || "—" },
  ]

  return (
    <div
      className="my-2 rounded-xl overflow-hidden"
      style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
        <span className="text-2xl leading-none">{data.flag}</span>
        <div>
          <p className="font-semibold text-sm" style={{ color: "var(--text)" }}>{data.name}</p>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            {data.capital} · {data.subregion || data.region}
          </p>
        </div>
      </div>

      {/* 3×2 info grid with manual borders */}
      <div className="grid grid-cols-3">
        {tiles.map((tile, i) => (
          <div
            key={tile.label}
            className="px-3 py-2.5"
            style={{
              borderRight: i % 3 !== 2 ? "1px solid var(--border)" : undefined,
              borderBottom: i < 3 ? "1px solid var(--border)" : undefined,
            }}
          >
            <p className="text-xs mb-0.5" style={{ color: "var(--text-muted)" }}>{tile.label}</p>
            <p className="text-xs font-medium" style={{ color: "var(--text)" }}>{tile.value}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
