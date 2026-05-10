"use client"

import { useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { getSupabase } from "@/lib/supabase"

export default function AuthCallback() {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const code = searchParams.get("code")
    const supabase = getSupabase()

    if (code) {
      supabase.auth.exchangeCodeForSession(code).then(() => {
        router.replace("/")
      })
    } else {
      router.replace("/")
    }
  }, [])

  return (
    <div
      className="flex h-full items-center justify-center gap-3"
      style={{ background: "var(--background)", color: "var(--text-muted)" }}
    >
      <div
        className="w-5 h-5 rounded-full border-2 animate-spin"
        style={{ borderColor: "var(--accent)", borderTopColor: "transparent" }}
      />
      <span className="text-sm">Signing in…</span>
    </div>
  )
}
