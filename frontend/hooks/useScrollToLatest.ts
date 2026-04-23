import { useEffect, useRef } from "react"

/**
 * Returns a ref that scrolls smoothly into view when data arrives.
 * Fires only when dependency changes from falsy to truthy (i.e. when a tool result lands).
 */
export function useScrollToLatest<T>(dependency: T) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!dependency) return
    if (!ref.current) return
    ref.current.scrollIntoView({ behavior: "smooth", block: "start" })
  }, [dependency])

  return ref
}
