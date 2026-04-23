"use client"

import { HotelResult } from "@/types"
import { useTripStore } from "@/hooks/useTripStore"
import { Star, ArrowRight } from "lucide-react"


const CURRENCY_SYMBOLS: Record<string, string> = {
  GBP: "£", EUR: "€", USD: "$", JPY: "¥", CHF: "Fr",
  SEK: "kr", NOK: "kr", DKK: "kr", PLN: "zł", CZK: "Kč",
  HUF: "Ft", TRY: "₺", AED: "د.إ", THB: "฿", SGD: "S$",
}

function currencySymbol(code: string) {
  return CURRENCY_SYMBOLS[code?.toUpperCase()] ?? code ?? "£"
}

interface Props {
  data: HotelResult[]
}

export function HotelCard({ data }: Props) {
  const { selectedHotel, setSelectedHotel, setHoveredPlace } = useTripStore()

  if (!data?.length || (data[0] as any)?.error) {
    return (
      <div className="rounded-xl p-3 my-2 text-xs flex items-center gap-2" style={{ background: "var(--surface-2)", color: "var(--text-muted)", border: "1px solid var(--border)" }}>
        <span>🏨</span> {(data[0] as any)?.error ?? "No hotels found for these dates."}
      </div>
    )
  }

  return (
    <div className="my-2 grid grid-cols-2 gap-2">
      {data.map((hotel, i) => {
        const isSelected = selectedHotel?.name === hotel.name
        const sym = currencySymbol(hotel.currency)
        return (
          <div
            key={i}
            data-hotel-name={hotel.name}
            className="rounded-xl overflow-hidden transition-all"
            style={{
              background: "var(--surface-2)",
              boxShadow: isSelected ? "var(--card-shadow-hover)" : "var(--card-shadow)",
              border: `1px solid ${isSelected ? "rgba(61,140,214,0.4)" : "var(--border-subtle)"}`,
            }}
            onMouseEnter={() => hotel.lat && setHoveredPlace(hotel.name)}
            onMouseLeave={() => setHoveredPlace(null)}
          >
            {/* Aspect-ratio photo with overlaid badges */}
            <div className="relative aspect-[16/9] overflow-hidden" style={{ background: "var(--surface)" }}>
              {hotel.photo_url ? (
                <img src={hotel.photo_url} alt={hotel.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-2xl">🏨</div>
              )}

              {/* Review score — top-right */}
              {hotel.review_score ? (
                <div
                  className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded text-xs font-bold"
                  style={{ background: "var(--accent)", color: "white" }}
                >
                  {hotel.review_score}
                </div>
              ) : null}

              {/* Price badge — bottom-left */}
              <div
                className="absolute bottom-1.5 left-1.5 px-2 py-1 rounded-md"
                style={{ background: "rgba(0,0,0,0.70)" }}
              >
                <span className="text-sm font-bold" style={{ color: "white" }}>{sym}{hotel.price_per_night_gbp}</span>
                <span className="text-xs ml-0.5" style={{ color: "rgba(255,255,255,0.65)" }}>/night</span>
              </div>
            </div>

            {/* Info */}
            <div className="p-2.5 space-y-1.5">
              <p className="text-xs font-medium leading-snug line-clamp-2" style={{ color: "var(--text)" }}>{hotel.name}</p>
              {hotel.stars > 0 && (
                <div className="flex gap-0.5">
                  {Array.from({ length: hotel.stars }).map((_, j) => (
                    <Star key={j} size={9} fill="#f59e0b" color="#f59e0b" />
                  ))}
                </div>
              )}
              <div className="flex gap-1.5 pt-0.5">
                <button
                  onClick={() => setSelectedHotel(isSelected ? null : hotel)}
                  className="flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer"
                  style={{
                    background: isSelected ? "var(--accent)" : "var(--surface)",
                    color: isSelected ? "white" : "var(--text-muted)",
                    border: "1px solid var(--border)",
                  }}
                >
                  {isSelected ? "Selected ✓" : "Select"}
                </button>
                <a
                  href={hotel.booking_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 py-1.5 rounded-lg text-xs font-medium flex items-center justify-center gap-1"
                  style={{ background: "var(--surface)", color: "var(--text-muted)", border: "1px solid var(--border)" }}
                >
                  Book <ArrowRight size={10} />
                </a>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
