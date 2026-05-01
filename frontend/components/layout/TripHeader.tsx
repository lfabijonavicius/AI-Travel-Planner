"use client"

import { MapPin, Calendar, Users, Wallet, Sparkles } from "lucide-react"
import { useTripStore } from "@/hooks/useTripStore"

function tripWord(days: number): string {
  if (days <= 0) return "Trip"
  if (days <= 3) return "Weekend Getaway"
  if (days <= 6) return "City Break"
  if (days <= 9) return "Adventure"
  return "Journey"
}

function formatDate(iso: string | undefined): string | null {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null
  try {
    const dt = new Date(iso + "T12:00:00")
    if (Number.isNaN(dt.getTime())) return null
    return dt.toLocaleDateString("en-GB", { day: "numeric", month: "short" })
  } catch {
    return null
  }
}

export function TripHeader() {
  const { itinerary, countryInfo, hotels, tripContext, flights, weather, budget } = useTripStore()

  const destination =
    itinerary?.destination ||
    tripContext.destination ||
    hotels[0]?.city ||
    null

  if (!destination) return null

  const days = itinerary?.days?.length ?? weather.length ?? 0
  const title = `${destination} ${tripWord(days)}`
  const flag = countryInfo?.flag ?? ""
  const party = tripContext.party_size ?? null
  const userBudget = tripContext.budget_gbp ?? budget?.budget_gbp ?? null

  const startDate =
    formatDate(itinerary?.days?.[0]?.date) ||
    formatDate(tripContext.start_date) ||
    formatDate(flights[0]?.departure_date) ||
    formatDate(weather[0]?.date)
  const endDate =
    formatDate(itinerary?.days?.[days - 1]?.date) ||
    formatDate(tripContext.end_date) ||
    formatDate(flights[0]?.return_date) ||
    formatDate(weather[weather.length - 1]?.date)
  const dateRange = startDate && endDate ? `${startDate} – ${endDate}` : null

  const durationText =
    dateRange ?? (days > 0 ? `${days} days` : flights.length ? "Dates pending" : null)

  return (
    <div
      className="px-5 py-4 flex-shrink-0"
      style={{
        borderBottom: "1px solid var(--border)",
        background: "linear-gradient(180deg, var(--surface-2) 0%, var(--surface) 100%)",
      }}
    >
      <div className="flex items-start gap-2 mb-3">
        <Sparkles size={16} style={{ color: "var(--accent-light)", marginTop: 4 }} />
        <div className="min-w-0 flex-1">
          <h1
            className="text-lg font-bold truncate flex items-center gap-2"
            style={{ color: "var(--text)", letterSpacing: "-0.01em" }}
          >
            <span className="truncate">{title}</span>
            {flag && <span className="text-base flex-shrink-0">{flag}</span>}
          </h1>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
            Trip to {destination}
          </p>
        </div>
      </div>

      <div className="flex gap-1.5 flex-wrap">
        <Pill icon={MapPin}>{destination}</Pill>
        {durationText && <Pill icon={Calendar}>{durationText}</Pill>}
        {party != null && (
          <Pill icon={Users}>
            {party} traveler{party !== 1 ? "s" : ""}
          </Pill>
        )}
        {userBudget != null && <Pill icon={Wallet}>£{userBudget.toLocaleString()}</Pill>}
      </div>
    </div>
  )
}

function Pill({
  icon: Icon,
  children,
}: {
  icon: typeof MapPin
  children: React.ReactNode
}) {
  return (
    <div
      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        color: "var(--text)",
      }}
    >
      <Icon size={11} style={{ color: "var(--text-muted)" }} />
      <span className="font-medium">{children}</span>
    </div>
  )
}
