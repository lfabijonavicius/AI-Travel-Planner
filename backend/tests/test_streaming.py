from models import ChatRequest
from streaming import _build_context_message


def test_build_context_message_compacts_large_snapshot_payloads():
    request = ChatRequest(
        message="Find cheaper hotels",
        snapshot={
            "places_found": [
                {"name": "Senso-ji", "category": "attraction", "lat": 1, "lng": 2},
                {"name": "Tokyo Tower", "category": "landmark", "lat": 3, "lng": 4},
                {"name": "Ueno Park", "category": "park", "lat": 5, "lng": 6},
                {"name": "Shibuya Sky", "category": "viewpoint", "lat": 7, "lng": 8},
                {"name": "Omoide Yokocho", "category": "food", "lat": 9, "lng": 10},
                {"name": "TeamLab Planets", "category": "museum", "lat": 11, "lng": 12},
                {"name": "Tsukiji Market", "category": "market", "lat": 13, "lng": 14},
                {"name": "Meiji Shrine", "category": "temple", "lat": 15, "lng": 16},
                {"name": "Akihabara", "category": "district", "lat": 17, "lng": 18},
            ],
            "weather_data": [
                {"date": "2099-06-01", "weather_icon": "☀️", "temp_high_c": 25, "temp_low_c": 18},
                {"date": "2099-06-02", "weather_icon": "🌤️", "temp_high_c": 24, "temp_low_c": 17},
                {"date": "2099-06-03", "weather_icon": "☁️", "temp_high_c": 23, "temp_low_c": 16},
                {"date": "2099-06-04", "weather_icon": "🌦️", "temp_high_c": 22, "temp_low_c": 15},
                {"date": "2099-06-05", "weather_icon": "🌧️", "temp_high_c": 21, "temp_low_c": 14},
                {"date": "2099-06-06", "weather_icon": "☀️", "temp_high_c": 25, "temp_low_c": 18},
            ],
        },
    )

    message = _build_context_message(request)

    assert "Senso-ji (attraction)" in message
    assert "Tokyo Tower (landmark)" in message
    assert "(+1 more)" in message
    assert '"lat"' not in message
    assert '"lng"' not in message
    assert "2099-06-01 ☀️ 25C/18C" in message
    assert "2099-06-05 🌧️ 21C/14C" in message
