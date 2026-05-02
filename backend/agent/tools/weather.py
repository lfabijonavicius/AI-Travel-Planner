import requests
from datetime import date, datetime, timedelta
from collections import defaultdict
from langchain_core.tools import tool
from config import settings

FORECAST_URL = "https://api.openweathermap.org/data/2.5/forecast"
CURRENT_URL = "https://api.openweathermap.org/data/2.5/weather"

ICON_MAP = {
    "Clear": "☀️",
    "Clouds": "☁️",
    "Rain": "🌧️",
    "Drizzle": "🌦️",
    "Thunderstorm": "⛈️",
    "Snow": "❄️",
    "Mist": "🌫️",
    "Fog": "🌫️",
    "Haze": "🌫️",
}


@tool
def get_weather_forecast(city: str, start_date: str, end_date: str) -> list[dict]:
    """Get weather forecast for a city over a date range.
    start_date and end_date must be 'YYYY-MM-DD'. Forecast is available up to 5 days ahead.
    Returns daily forecast with temperature highs/lows, conditions, and precipitation probability."""
    try:
        response = requests.get(
            FORECAST_URL,
            params={
                "q": city,
                "appid": settings.openweather_api_key,
                "units": "metric",
                "cnt": 40,
            },
            timeout=10,
        )
        response.raise_for_status()
        forecasts = response.json().get("list", [])

        # Group 3-hourly slots by date
        by_day: dict[str, list] = defaultdict(list)
        for slot in forecasts:
            day = slot["dt_txt"][:10]
            by_day[day].append(slot)

        start = date.fromisoformat(start_date)
        end = date.fromisoformat(end_date)
        results = []

        current = start
        while current <= end:
            day_str = current.isoformat()
            slots = by_day.get(day_str, [])
            if slots:
                temps = [s["main"]["temp"] for s in slots]
                pop = max(s.get("pop", 0) for s in slots)
                main_condition = slots[len(slots) // 2]["weather"][0]["main"]
                description = slots[len(slots) // 2]["weather"][0]["description"].title()
                results.append({
                    "date": day_str,
                    "temp_high_c": round(max(temps), 1),
                    "temp_low_c": round(min(temps), 1),
                    "condition": description,
                    "weather_icon": ICON_MAP.get(main_condition, "🌡️"),
                    "precipitation_probability": round(pop * 100),
                })
            current += timedelta(days=1)

        return results if results else [{"error": "No forecast data available for the selected dates. Forecast is limited to 5 days ahead."}]

    except requests.Timeout:
        return [{"error": "Weather forecast request timed out. Try again."}]
    except requests.HTTPError as e:
        return [{"error": f"Weather forecast failed: {str(e)}"}]
    except Exception as e:
        return [{"error": f"Unexpected error: {str(e)}"}]


@tool
def get_current_weather(city: str) -> dict:
    """Get the current weather conditions for a city right now.
    Use this for questions about current or today's temperature, conditions, or weather.
    Returns temperature in Celsius, feels-like, humidity, wind speed, and condition description."""
    try:
        response = requests.get(
            CURRENT_URL,
            params={
                "q": city,
                "appid": settings.openweather_api_key,
                "units": "metric",
            },
            timeout=10,
        )
        response.raise_for_status()
        data = response.json()
        main = data["main"]
        wind = data.get("wind", {})
        weather = data["weather"][0]
        main_condition = weather["main"]
        return {
            "city": data.get("name", city),
            "temp_c": round(main["temp"], 1),
            "feels_like_c": round(main["feels_like"], 1),
            "temp_min_c": round(main["temp_min"], 1),
            "temp_max_c": round(main["temp_max"], 1),
            "humidity_pct": main["humidity"],
            "condition": weather["description"].title(),
            "weather_icon": ICON_MAP.get(main_condition, "🌡️"),
            "wind_speed_ms": round(wind.get("speed", 0), 1),
        }
    except requests.Timeout:
        return {"error": "Weather request timed out. Try again."}
    except requests.HTTPError as e:
        return {"error": f"Weather lookup failed: {str(e)}"}
    except Exception as e:
        return {"error": f"Unexpected error: {str(e)}"}
