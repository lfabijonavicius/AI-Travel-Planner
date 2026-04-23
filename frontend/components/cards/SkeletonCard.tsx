interface SkeletonCardProps {
  type: "flight" | "hotel" | "place" | "weather" | "country"
}

const heights: Record<SkeletonCardProps["type"], string> = {
  flight:  "88px",
  hotel:   "120px",
  place:   "100px",
  weather: "80px",
  country: "120px",
}

export function SkeletonCard({ type }: SkeletonCardProps) {
  return (
    <div
      className="skeleton"
      style={{
        height: heights[type],
        marginTop: "8px",
        marginBottom: "8px",
      }}
    />
  )
}
