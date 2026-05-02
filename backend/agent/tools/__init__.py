from .country import get_country_info
from .flights import search_flights
from .hotels import search_hotels
from .weather import get_weather_forecast, get_current_weather
from .currency import get_currency_exchange
from .places import search_places
from .budget import calculate_budget
from .itinerary import generate_itinerary
from .destinations import suggest_destinations
from .city import get_city_pin

all_tools = [
    get_country_info,
    search_flights,
    search_hotels,
    get_weather_forecast,
    get_current_weather,
    get_currency_exchange,
    search_places,
    calculate_budget,
    generate_itinerary,
    suggest_destinations,
    get_city_pin,
]
