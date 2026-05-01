import { FlightCard } from "@/components/cards/FlightCard"
import { HotelCard } from "@/components/cards/HotelCard"
import { WeatherStrip } from "@/components/cards/WeatherStrip"
import { PlaceCard } from "@/components/cards/PlaceCard"
import { CountryInfoPanel } from "@/components/cards/CountryInfoPanel"
import { DestinationCard } from "@/components/cards/DestinationCard"
import {
  FlightResult,
  HotelResult,
  WeatherDay,
  PlaceResult,
  CountryInfo,
  DestinationSuggestion,
} from "@/types"

interface Props {
  tool: string
  output: unknown
}

export function InlineCardRenderer({ tool, output }: Props) {
  switch (tool) {
    case "search_flights":
      return <FlightCard data={output as FlightResult[]} />
    case "search_hotels":
      return <HotelCard data={output as HotelResult[]} />
    case "get_weather_forecast":
      return <WeatherStrip data={output as WeatherDay[]} />
    case "search_places":
      return <PlaceCard data={output as PlaceResult[]} />
    case "get_country_info":
      return <CountryInfoPanel data={output as CountryInfo} />
    case "suggest_destinations":
      return <DestinationCard data={output as DestinationSuggestion[]} />
    // These update the right panel silently — no inline card
    case "calculate_budget":
    case "get_currency_exchange":
    case "generate_itinerary":
      return null
    default:
      return null
  }
}
