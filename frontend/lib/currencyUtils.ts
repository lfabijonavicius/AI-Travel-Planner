export const CURRENCY_SYMBOLS: Record<string, string> = {
  GBP: "£", EUR: "€", USD: "$", JPY: "¥", CHF: "Fr",
  SEK: "kr", NOK: "kr", DKK: "kr", PLN: "zł", CZK: "Kč",
  HUF: "Ft", TRY: "₺", AED: "د.إ", THB: "฿", SGD: "S$",
}

export function currencySymbol(code: string): string {
  return CURRENCY_SYMBOLS[code?.toUpperCase()] ?? code ?? "£"
}
