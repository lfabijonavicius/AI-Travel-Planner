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
  if (c === "city") return "🏙️"
  return "📍"
}

// SVG icons for the new flat marker style. Returns an inline SVG string with
// stroke="currentColor" so the marker's CSS color rules it. 14×14 viewBox-fit,
// stroke-width 2.2 for clarity at small sizes.
export function categoryIconSvg(category?: string): string {
  const c = (category || "").toLowerCase()

  const ICONS = {
    landmark: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" x2="21" y1="22" y2="22"/><line x1="6" x2="6" y1="18" y2="11"/><line x1="10" x2="10" y1="18" y2="11"/><line x1="14" x2="14" y1="18" y2="11"/><line x1="18" x2="18" y1="18" y2="11"/><polygon points="12 2 20 7 4 7"/></svg>`,
    utensils: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/></svg>`,
    shopping: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>`,
    flower: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 16.5A4.5 4.5 0 1 1 7.5 12 4.5 4.5 0 1 1 12 7.5a4.5 4.5 0 1 1 4.5 4.5 4.5 4.5 0 1 1-4.5 4.5"/></svg>`,
    palette: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/></svg>`,
    mountain: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m8 3 4 8 5-5 5 15H2L8 3z"/></svg>`,
    moon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>`,
    footprints: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 16v-2.38C4 11.5 2.97 10.5 3 8c.03-2.72 1.49-6 4.5-6C9.37 2 10 3.8 10 5.5c0 3.11-2 5.66-2 8.68V16a2 2 0 1 1-4 0Z"/><path d="M20 20v-2.38c0-2.12 1.03-3.12 1-5.62-.03-2.72-1.49-6-4.5-6C14.63 6 14 7.8 14 9.5c0 3.11 2 5.66 2 8.68V20a2 2 0 1 0 4 0Z"/><path d="M16 17h4"/><path d="M4 13h4"/></svg>`,
    bed: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 4v16"/><path d="M2 8h18a2 2 0 0 1 2 2v10"/><path d="M2 17h20"/><path d="M6 8v9"/></svg>`,
    pin: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>`,
  }

  if (/restaurant|food|cafe|bar|bistro|bakery|dining|eat/.test(c)) return ICONS.utensils
  if (/landmark|monument|historic|heritage|palace|castle|fortress|citadel|ruins|temple|church|mosque|cathedral|architecture/.test(c)) return ICONS.landmark
  if (/garden|park|botanical|nature|flower/.test(c)) return ICONS.flower
  if (/museum|gallery|art|culture|exhibit/.test(c)) return ICONS.palette
  if (/market|shop|bazaar|street life/.test(c)) return ICONS.shopping
  if (/view|waterfront|beach|coast|hill|mountain|panorama/.test(c)) return ICONS.mountain
  if (/night|bar|club|after dark/.test(c)) return ICONS.moon
  if (/walk|tour|stroll/.test(c)) return ICONS.footprints
  if (/hotel|stay|lodging|accommodation/.test(c)) return ICONS.bed
  return ICONS.pin
}
