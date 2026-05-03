export function greatCirclePoints(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
  n = 60
): [number, number][] {
  const toR = (d: number) => (d * Math.PI) / 180
  const toD = (r: number) => (r * 180) / Math.PI
  const φ1 = toR(lat1), λ1 = toR(lng1), φ2 = toR(lat2), λ2 = toR(lng2)
  const dσ = Math.acos(
    Math.max(-1, Math.min(1, Math.sin(φ1) * Math.sin(φ2) + Math.cos(φ1) * Math.cos(φ2) * Math.cos(λ2 - λ1)))
  )
  if (dσ < 0.0001) return [[lat1, lng1], [lat2, lng2]]
  return Array.from({ length: n + 1 }, (_, i) => {
    const t = i / n
    const A = Math.sin((1 - t) * dσ) / Math.sin(dσ)
    const B = Math.sin(t * dσ) / Math.sin(dσ)
    const x = A * Math.cos(φ1) * Math.cos(λ1) + B * Math.cos(φ2) * Math.cos(λ2)
    const y = A * Math.cos(φ1) * Math.sin(λ1) + B * Math.cos(φ2) * Math.sin(λ2)
    const z = A * Math.sin(φ1) + B * Math.sin(φ2)
    return [toD(Math.atan2(z, Math.sqrt(x * x + y * y))), toD(Math.atan2(y, x))] as [number, number]
  })
}

export function distanceMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const toRad = (value: number) => (value * Math.PI) / 180
  const r = 6371000
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)
  const x =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLng / 2) * Math.sin(dLng / 2) * Math.cos(lat1) * Math.cos(lat2)
  const c = 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x))
  return r * c
}
