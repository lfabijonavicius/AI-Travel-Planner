"use client"

import { HotelResult } from "@/types"
import { useTripStore } from "@/hooks/useTripStore"
import { ArrowRight, Heart, Plus, Star } from "lucide-react"
import { useScrollToLatest } from "@/hooks/useScrollToLatest"
import { useSSE } from "@/hooks/useSSE"
import { ToolCarousel } from "./ToolCarousel"


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
  const cardRef = useScrollToLatest(data)
  const { sendMessage } = useSSE()

  if (!data?.length || (data[0] as any)?.error) {
    return (
      <div className="rounded-xl p-3 my-2 text-xs flex items-center gap-2" style={{ background: "var(--surface-2)", color: "var(--text-muted)", border: "1px solid var(--border)" }}>
        <span>🏨</span> {(data[0] as any)?.error ?? "No hotels found for these dates."}
      </div>
    )
  }

  return (
    <div ref={cardRef}>
      <ToolCarousel
        eyebrow="Stay Options"
        description="Compact hotel picks to compare on price, feel, and map position before you commit."
        followUps={buildHotelFollowUps(data).map((prompt) => ({
          label: prompt,
          onClick: () => sendMessage(prompt),
        }))}
      >
        {data.map((hotel, i) => {
          const isSelected = selectedHotel?.name === hotel.name
          const sym = currencySymbol(hotel.currency)
          return (
            <div
              key={i}
              data-hotel-name={hotel.name}
              className="snap-start shrink-0 w-[252px] rounded-2xl overflow-hidden transition-all"
              style={{
                background: "var(--surface-2)",
                boxShadow: isSelected ? "var(--card-shadow-hover)" : "var(--card-shadow)",
                border: `1px solid ${isSelected ? "rgba(61,140,214,0.4)" : "var(--border-subtle)"}`,
              }}
              onMouseEnter={() => hotel.lat && setHoveredPlace(hotel.name)}
              onMouseLeave={() => setHoveredPlace(null)}
            >
              <div className="relative aspect-[0.96] overflow-hidden" style={{ background: "var(--surface)" }}>
                {hotel.photo_url ? (
                  <img src={hotel.photo_url} alt={hotel.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-4xl">🏨</div>
                )}
                <div
                  className="absolute inset-0"
                  style={{ background: "linear-gradient(to top, rgba(5,10,18,0.92), rgba(5,10,18,0.12) 45%, rgba(5,10,18,0))" }}
                />
                {hotel.review_score ? (
                  <div
                    className="absolute top-3 right-3 px-2 py-1 rounded-full text-[11px] font-bold"
                    style={{ background: "rgba(10,14,22,0.78)", color: "white", border: "1px solid rgba(255,255,255,0.12)" }}
                  >
                    {hotel.review_score}
                  </div>
                ) : null}
                <div
                  className="absolute top-3 left-3 px-2.5 py-1 rounded-full text-[11px] font-semibold"
                  style={{ background: "rgba(10,14,22,0.84)", color: "white", border: "1px solid rgba(255,255,255,0.12)", boxShadow: "0 8px 18px rgba(0,0,0,0.24)" }}
                >
                  {sym}{hotel.price_per_night_gbp}/night
                </div>
                <div className="absolute left-0 right-0 bottom-0 px-4 pb-4 pt-10">
                  <h3 className="font-bold text-base leading-tight text-white line-clamp-2">{hotel.name}</h3>
                  <p className="text-[11px] mt-1" style={{ color: "rgba(255,255,255,0.72)" }}>
                    {hotel.city}
                  </p>
                </div>
              </div>

              <div className="p-4">
                {hotel.stars > 0 && (
                  <div className="flex gap-0.5 mb-2">
                    {Array.from({ length: hotel.stars }).map((_, j) => (
                      <Star key={j} size={10} fill="#f59e0b" color="#f59e0b" />
                    ))}
                  </div>
                )}
                <div className="flex items-center gap-1.5 text-[11px]" style={{ color: "var(--text-muted)" }}>
                  <Heart size={11} />
                  <span>{hotel.review_word || "Solid stay option"} </span>
                </div>
                <p className="mt-2 text-sm font-semibold" style={{ color: "var(--text)" }}>
                  {sym}{hotel.total_price_gbp} total stay
                </p>
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => setSelectedHotel(isSelected ? null : hotel)}
                    className="flex-1 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                    style={{
                      background: isSelected ? "var(--accent)" : "var(--surface)",
                      color: isSelected ? "white" : "var(--text)",
                      border: "1px solid var(--border)",
                    }}
                  >
                    <Plus size={12} />
                    {isSelected ? "Selected" : "Select"}
                  </button>
                  <a
                    href={hotel.booking_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1"
                    style={{ background: "transparent", color: "var(--text)", border: "1px solid var(--border)" }}
                  >
                    Book <ArrowRight size={10} />
                  </a>
                </div>
              </div>
            </div>
          )
        })}
      </ToolCarousel>
    </div>
  )
}

function buildHotelFollowUps(data: HotelResult[]) {
  const prompts: string[] = []
  if (data[0]) prompts.push("Which of these hotels is the best value?")
  if (data.some((hotel) => hotel.stars >= 4)) prompts.push("Which hotel feels most special for the money?")
  if (data.length > 1) prompts.push("Compare the top two hotel options on location and overall tradeoffs.")
  if (data.some((hotel) => hotel.review_score != null)) prompts.push("Which of these has the strongest review signal?")
  return Array.from(new Set(prompts)).slice(0, 4)
}
