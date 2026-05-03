const prefetched = new Set<string>()

export function prefetchPhotos(urls: (string | undefined | null)[]): void {
  if (typeof window === "undefined") return

  const fresh = urls.filter((u): u is string => !!u && !prefetched.has(u))
  if (fresh.length === 0) return

  fresh.forEach((url) => {
    prefetched.add(url)
    const img = new Image()
    if ("fetchPriority" in img) {
      ;(img as any).fetchPriority = "low"
    }
    img.decoding = "async"
    img.src = url
  })
}
