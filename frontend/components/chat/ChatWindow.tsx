"use client"

import { useEffect, useRef } from "react"
import { useTripStore } from "@/hooks/useTripStore"
import { ChatBubble } from "./ChatBubble"
import { ToolCallIndicator } from "./ToolCallIndicator"
import { InlineCardRenderer } from "./InlineCardRenderer"
import { ChatInput } from "./ChatInput"
import { ItineraryConfirmBar } from "./ItineraryConfirmBar"
import { useSSE } from "@/hooks/useSSE"
import { SkeletonCard } from "@/components/cards/SkeletonCard"

// Tools that render silently in the right panel — no inline card
const SILENT_TOOLS = new Set(["calculate_budget", "get_currency_exchange", "generate_itinerary"])
const LOW_CHROME_TOOLS = new Set(["suggest_destinations"])

const SKELETON_TYPE_MAP: Record<string, "flight" | "hotel" | "weather" | "place" | "country"> = {
  search_flights:       "flight",
  search_hotels:        "hotel",
  get_weather_forecast: "weather",
  search_places:        "place",
  get_country_info:     "country",
}

export function ChatWindow() {
  const { messages, isStreaming, activeSkeletons } = useTripStore()
  const { sendMessage } = useSSE()
  const bottomRef = useRef<HTMLDivElement>(null)
  const prevMessageCount = useRef(messages.length)

  useEffect(() => {
    const newCount = messages.length
    if (newCount > prevMessageCount.current) {
      prevMessageCount.current = newCount
      bottomRef.current?.scrollIntoView({ behavior: "smooth" })
    }
  }, [messages.length])

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto py-5 space-y-4" style={{ scrollbarWidth: "thin" }}>
        <div className="max-w-[680px] mx-auto px-5">
        {messages.filter((msg) => !msg.hidden).map((msg) => {
          return (
            <div key={msg.id}>
              <ChatBubble message={msg} />

              {/* Inline tool calls for assistant messages */}
              {msg.role === "assistant" && msg.toolCalls && msg.toolCalls.length > 0 && (
                <div className="mt-2 space-y-1">
                  {msg.toolCalls.map((tc, i) => (
                    <div key={`${tc.tool}-${i}`}>
                      {!LOW_CHROME_TOOLS.has(tc.tool) && (
                        <ToolCallIndicator tool={tc.tool} done={tc.output !== undefined} inputs={tc.inputs} />
                      )}
                      {tc.output !== undefined && !SILENT_TOOLS.has(tc.tool) && (
                        <InlineCardRenderer tool={tc.tool} output={tc.output} />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}

          {/* Skeleton cards for tools currently running */}
          {Object.entries(activeSkeletons).map(([tool, active]) => {
            if (!active) return null
            const skeletonType = SKELETON_TYPE_MAP[tool]
            if (!skeletonType) return null
            return <SkeletonCard key={tool} type={skeletonType} />
          })}

          <div ref={bottomRef} />
        </div>
      </div>

      <ItineraryConfirmBar onConfirm={(msg) => sendMessage(msg, {}, true)} />
      <ChatInput onSend={sendMessage} disabled={isStreaming} />
    </div>
  )
}
