"use client"

import { useEffect, useRef } from "react"
import { useTripStore } from "@/hooks/useTripStore"
import { ChatBubble } from "./ChatBubble"
import { ToolCallIndicator } from "./ToolCallIndicator"
import { InlineCardRenderer } from "./InlineCardRenderer"
import { ChatInput } from "./ChatInput"
import { useSSE } from "@/hooks/useSSE"

// Tools that render silently in the right panel — no inline card
const SILENT_TOOLS = new Set(["calculate_budget", "get_currency_exchange", "generate_itinerary"])

export function ChatWindow() {
  const { messages, isStreaming } = useTripStore()
  const { sendMessage } = useSSE()
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto py-5 space-y-4" style={{ scrollbarWidth: "thin" }}>
        <div className="max-w-[680px] mx-auto px-5">
        {messages.map((msg) => (
          <div key={msg.id}>
            <ChatBubble message={msg} />

            {/* Inline tool calls for assistant messages */}
            {msg.role === "assistant" && msg.toolCalls && msg.toolCalls.length > 0 && (
              <div className="mt-2 space-y-1">
                {msg.toolCalls.map((tc, i) => (
                  <div key={`${tc.tool}-${i}`}>
                    <ToolCallIndicator tool={tc.tool} done={tc.output !== undefined} />
                    {tc.output !== undefined && !SILENT_TOOLS.has(tc.tool) && (
                      <InlineCardRenderer tool={tc.tool} output={tc.output} />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}

          <div ref={bottomRef} />
        </div>
      </div>

      <ChatInput onSend={sendMessage} disabled={isStreaming} />
    </div>
  )
}
