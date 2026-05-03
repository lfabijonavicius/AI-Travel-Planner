"use client"

import { useState, useEffect } from "react"
import { Camera, ChevronLeft, ChevronRight } from "lucide-react"

interface MediaGalleryProps {
  urls: string[]
  alt: string
  badgeLabel?: string | null
  statusLabel?: { text: string; color: string } | null
}

function tileButton({
  url,
  index,
  altText,
  className,
  showOverlayCount,
  active = false,
  onClick,
}: {
  url: string
  index: number
  altText: string
  className: string
  showOverlayCount?: number
  active?: boolean
  onClick: (index: number) => void
}) {
  return (
    <button
      key={`${url}-${index}`}
      onClick={() => onClick(index)}
      className={`relative overflow-hidden cursor-pointer transition-transform hover:scale-[1.01] ${className}`}
      style={{
        border: active ? "2px solid rgba(255,255,255,0.82)" : "1px solid rgba(255,255,255,0.08)",
        boxShadow: active ? "0 10px 22px rgba(0,0,0,0.24)" : "none",
      }}
    >
      <img src={url} alt={altText} className="h-full w-full object-cover" />
      <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(0,0,0,0.26), rgba(0,0,0,0.04))" }} />
      {showOverlayCount ? (
        <div className="absolute inset-0 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.42)", color: "white" }}>
          <span className="text-base font-semibold">+{showOverlayCount}</span>
        </div>
      ) : null}
    </button>
  )
}

function GalleryLayout({
  urls,
  idx,
  alt,
  onSelect,
}: {
  urls: string[]
  idx: number
  alt: string
  onSelect: (index: number) => void
}) {
  const currentUrl = urls[idx]
  const remainingUrls = urls.filter((_, i) => i !== idx)
  const totalCount = urls.length

  if (totalCount === 1) {
    return (
      <div className="h-full w-full p-1.5">
        <div className="relative h-full overflow-hidden rounded-[24px]">
          <img src={currentUrl} alt={alt} className="h-full w-full object-cover" />
          <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.08), rgba(0,0,0,0.46))" }} />
        </div>
      </div>
    )
  }

  if (totalCount === 2) {
    return (
      <div className="grid h-full w-full grid-cols-2 gap-1.5 bg-black/20 p-1.5">
        {urls.map((url, index) =>
          tileButton({ url, index, altText: `${alt} ${index + 1}`, className: "rounded-[24px]", active: index === idx, onClick: onSelect })
        )}
      </div>
    )
  }

  if (totalCount === 3) {
    return (
      <div className="grid h-full w-full grid-cols-3 gap-1.5 bg-black/20 p-1.5">
        {urls.map((url, index) =>
          tileButton({ url, index, altText: `${alt} ${index + 1}`, className: "rounded-[22px]", active: index === idx, onClick: onSelect })
        )}
      </div>
    )
  }

  if (totalCount === 4) {
    return (
      <div className="grid h-full w-full grid-cols-2 grid-rows-2 gap-1.5 bg-black/20 p-1.5">
        {urls.map((url, index) =>
          tileButton({ url, index, altText: `${alt} ${index + 1}`, className: "rounded-[22px]", active: index === idx, onClick: onSelect })
        )}
      </div>
    )
  }

  const sideTiles = remainingUrls.slice(0, 4).map((url) => ({ url, index: urls.indexOf(url) }))
  const extraCount = remainingUrls.length - 4
  return (
    <div className="grid h-full w-full grid-cols-[1.45fr_1fr] gap-1.5 bg-black/20 p-1.5">
      {tileButton({ url: currentUrl, index: idx, altText: alt, className: "rounded-[24px]", active: true, onClick: onSelect })}
      <div className="grid grid-cols-2 grid-rows-2 gap-1.5">
        {sideTiles.map((tile, tileIndex) =>
          tileButton({
            url: tile.url,
            index: tile.index,
            altText: `${alt} ${tile.index + 1}`,
            className: "rounded-2xl",
            showOverlayCount: tileIndex === 3 && extraCount > 0 ? extraCount : undefined,
            onClick: onSelect,
          })
        )}
      </div>
    </div>
  )
}

export function MediaGallery({ urls, alt, badgeLabel, statusLabel }: MediaGalleryProps) {
  const [idx, setIdx] = useState(0)
  useEffect(() => { setIdx(0) }, [urls])

  if (!urls.length) {
    return (
      <div className="w-full h-full flex items-center justify-center text-5xl" style={{ background: "linear-gradient(135deg, #182233, #0f1521)" }}>
        📍
      </div>
    )
  }

  const totalCount = urls.length

  return (
    <div className="relative h-full w-full overflow-hidden">
      <GalleryLayout urls={urls} idx={idx} alt={alt} onSelect={setIdx} />

      <div className="absolute left-4 top-4 flex items-center gap-2">
        {badgeLabel ? (
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold capitalize" style={{ background: "rgba(0,0,0,0.7)", color: "white", border: "1px solid rgba(255,255,255,0.1)" }}>
            {badgeLabel}
          </span>
        ) : null}
        {totalCount > 1 ? (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold" style={{ background: "rgba(0,0,0,0.7)", color: "white", border: "1px solid rgba(255,255,255,0.1)" }}>
            <Camera size={12} />
            {totalCount} photos
          </span>
        ) : null}
      </div>

      {totalCount > 1 ? (
        <>
          <button
            onClick={() => setIdx((i) => (i - 1 + totalCount) % totalCount)}
            className="absolute left-4 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full flex items-center justify-center cursor-pointer"
            style={{ background: "rgba(0,0,0,0.55)", color: "white", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.12)" }}
          >
            <ChevronLeft size={15} />
          </button>
          <button
            onClick={() => setIdx((i) => (i + 1) % totalCount)}
            className="absolute right-4 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full flex items-center justify-center cursor-pointer"
            style={{ background: "rgba(0,0,0,0.55)", color: "white", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.12)" }}
          >
            <ChevronRight size={15} />
          </button>
          <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-1.5">
            {urls.map((_, index) => (
              <button
                key={`gallery-dot-${index}`}
                onClick={() => setIdx(index)}
                className="h-2.5 rounded-full cursor-pointer transition-all"
                style={{
                  width: index === idx ? "18px" : "8px",
                  background: index === idx ? "white" : "rgba(255,255,255,0.45)",
                  border: "1px solid rgba(255,255,255,0.18)",
                }}
              />
            ))}
          </div>
        </>
      ) : null}

      {statusLabel ? (
        <span
          className="absolute bottom-4 right-4 px-2.5 py-1 rounded-full text-xs font-semibold"
          style={{ background: "rgba(0,0,0,0.7)", color: statusLabel.color, border: "1px solid rgba(255,255,255,0.1)" }}
        >
          {statusLabel.text}
        </span>
      ) : null}
    </div>
  )
}
