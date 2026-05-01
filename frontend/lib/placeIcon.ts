export function categoryIcon(category: string): string {
  const c = (category ?? "").toLowerCase()
  if (
    c.includes("landmark") ||
    c.includes("monument") ||
    c.includes("historic") ||
    c.includes("heritage") ||
    c.includes("palace") ||
    c.includes("castle") ||
    c.includes("fortress") ||
    c.includes("citadel") ||
    c.includes("ruins")
  ) return "🏰"
  if (c.includes("restaur") || c.includes("food") || c.includes("dining") || c.includes("bistro")) return "🍽"
  if (c.includes("cafe") || c.includes("coffee") || c.includes("bakery")) return "☕"
  if (c.includes("bar") || c.includes("pub") || c.includes("night")) return "🍸"
  if (c.includes("museum") || c.includes("gallery") || c.includes("art")) return "🏛"
  if (c.includes("church") || c.includes("cathedral") || c.includes("temple") || c.includes("monastery")) return "⛪"
  if (c.includes("beach") || c.includes("coast") || c.includes("bay")) return "🏖"
  if (c.includes("park") || c.includes("garden") || c.includes("nature") || c.includes("forest")) return "🌿"
  if (c.includes("market") || c.includes("shop") || c.includes("mall")) return "🛍"
  if (c.includes("sport") || c.includes("stadium") || c.includes("gym")) return "⚽"
  if (c.includes("spa") || c.includes("wellness") || c.includes("thermal")) return "💆"
  if (c.includes("viewpoint") || c.includes("observation") || c.includes("tower")) return "🗼"
  if (c.includes("aquarium") || c.includes("zoo")) return "🐠"
  return "📍"
}
