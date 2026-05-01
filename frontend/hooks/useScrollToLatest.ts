import { useEffect, useRef } from "react"

/**
 * Scrolls the card into view only if the user is already near the bottom
 * of the chat (i.e. actively following along). If they've scrolled up to
 * read, cards flushing below them will NOT hijack their scroll position.
 */
export function useScrollToLatest<T>(dependency: T) {
  const ref = useRef<HTMLDivElement>(null)
  const hasScrolled = useRef(false)

  useEffect(() => {
    if (!dependency || hasScrolled.current) return
    const el = ref.current
    if (!el) return
    hasScrolled.current = true

    // Find the closest scrollable ancestor
    let scrollEl: HTMLElement | null = el.parentElement
    while (scrollEl && scrollEl.scrollHeight <= scrollEl.clientHeight) {
      scrollEl = scrollEl.parentElement
    }
    if (!scrollEl) return

    // Only scroll if user is within 200px of the bottom (following the stream)
    const distanceFromBottom = scrollEl.scrollHeight - scrollEl.scrollTop - scrollEl.clientHeight
    if (distanceFromBottom > 200) return

    el.scrollIntoView({ behavior: "smooth", block: "nearest" })
  }, [dependency])

  return ref
}
