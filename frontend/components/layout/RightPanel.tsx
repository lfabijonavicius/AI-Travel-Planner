"use client"

import dynamic from "next/dynamic"
import { useTripStore } from "@/hooks/useTripStore"

const MiniMap = dynamic(() => import("@/components/map/MiniMap").then((m) => m.MiniMap), { ssr: false })

export function RightPanel() {
  const { budget, currency } = useTripStore()

  return (
    <aside
      className="flex flex-col h-full w-[240px] flex-shrink-0 border-l overflow-y-auto"
      style={{ background: "var(--surface)", borderColor: "var(--border)" }}
    >
      {/* Budget tracker */}
      <section className="p-4 border-b" style={{ borderColor: "var(--border)" }}>
        <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--text-muted)" }}>
          Budget
        </h3>
        {budget ? (
          <div className="space-y-2">
            {Object.entries(budget.breakdown).map(([key, val]) => (
              <div key={key} className="space-y-0.5">
                <div className="flex justify-between text-xs">
                  <span style={{ color: "var(--text-muted)" }} className="capitalize">
                    {key.replace("_gbp", "")}
                  </span>
                  <span style={{ color: "var(--text)" }}>£{val.toLocaleString()}</span>
                </div>
                <div className="h-0.5 rounded-full overflow-hidden" style={{ background: "var(--border)" }}>
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.min(100, (val / budget.total_gbp) * 100)}%`,
                      background: "var(--accent)",
                    }}
                  />
                </div>
              </div>
            ))}
            <div className="border-t pt-2 mt-1 flex justify-between text-sm font-semibold" style={{ borderColor: "var(--border)" }}>
              <span style={{ color: "var(--text)" }}>Total</span>
              <span style={{ color: budget.within_budget === false ? "#f59e0b" : "#22c55e" }}>
                £{budget.total_gbp.toLocaleString()}
              </span>
            </div>
            {budget.within_budget === false && (
              <p className="text-xs" style={{ color: "#f59e0b" }}>
                £{budget.over_by_gbp.toLocaleString()} over budget
              </p>
            )}
            {budget.within_budget === true && budget.budget_gbp && (
              <p className="text-xs" style={{ color: "#22c55e" }}>
                £{(budget.budget_gbp - budget.total_gbp).toLocaleString()} remaining
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {["Flights", "Hotel", "Activities", "Food"].map((l) => (
              <div key={l} className="flex justify-between text-xs">
                <span style={{ color: "var(--text-muted)" }}>{l}</span>
                <span style={{ color: "var(--border)" }}>—</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Currency */}
      <section className="p-4 border-b" style={{ borderColor: "var(--border)" }}>
        <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--text-muted)" }}>
          Currency
        </h3>
        {currency ? (
          <div className="space-y-1.5">
            <div className="flex items-baseline gap-1">
              <span className="text-base font-semibold" style={{ color: "var(--text)" }}>
                1 {currency.base}
              </span>
              <span style={{ color: "var(--text-muted)" }} className="text-xs">
                = {currency.rate} {currency.target}
              </span>
            </div>
            {Object.entries(currency.conversions).map(([k, v]) => (
              <div key={k} className="flex justify-between text-xs">
                <span style={{ color: "var(--text-muted)" }}>{k}</span>
                <span style={{ color: "var(--text)" }}>{v.toLocaleString()} {currency.target}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs" style={{ color: "var(--border)" }}>—</p>
        )}
      </section>

      {/* MiniMap */}
      <section className="p-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--text-muted)" }}>
          Map
        </h3>
        <MiniMap />
      </section>
    </aside>
  )
}
