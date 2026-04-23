from .country import get_country_info
from .flights import search_flights
from .hotels import search_hotels
from .weather import get_weather_forecast
from .currency import get_currency_exchange
from .places import search_places
from .budget import calculate_budget
from .itinerary import generate_itinerary

all_tools = [
    get_country_info,
    search_flights,
    search_hotels,
    get_weather_forecast,
    get_currency_exchange,
    search_places,
    calculate_budget,
    generate_itinerary,
]
