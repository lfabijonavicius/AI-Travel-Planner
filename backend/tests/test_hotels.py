import requests
from unittest.mock import MagicMock, patch

from agent.tools.hotels import search_hotels


def _mock_response(payload):
    response = MagicMock()
    response.raise_for_status.return_value = None
    response.json.return_value = payload
    return response


def test_search_hotels_sorts_by_price_by_default():
    location_payload = [{"dest_id": "123", "dest_type": "city"}]
    search_payload = {
        "result": [
            {
                "hotel_name": "Luxury Stay",
                "class": 5,
                "review_score": 9.0,
                "min_total_price": 2100,
                "currencycode": "GBP",
                "address": "1 High St",
            },
            {
                "hotel_name": "Budget Base",
                "class": 3,
                "review_score": 8.2,
                "min_total_price": 700,
                "currencycode": "GBP",
                "address": "2 High St",
            },
            {
                "hotel_name": "Midtown Inn",
                "class": 4,
                "review_score": 8.8,
                "min_total_price": 1050,
                "currencycode": "GBP",
                "address": "3 High St",
            },
        ]
    }

    with patch("agent.tools.hotels.requests.get", side_effect=[_mock_response(location_payload), _mock_response(search_payload)]):
        with patch("agent.tools.hotels.time.sleep"):
            result = search_hotels.invoke({
                "city": "Tokyo",
                "check_in": "2099-06-01",
                "check_out": "2099-06-08",
                "guests": 2,
                "max_results": 3,
            })

    assert [hotel["name"] for hotel in result] == ["Budget Base", "Midtown Inn", "Luxury Stay"]
    assert [hotel["price_per_night_gbp"] for hotel in result] == [100, 150, 300]


def test_search_hotels_applies_max_price_filter_when_matches_exist():
    location_payload = [{"dest_id": "123", "dest_type": "city"}]
    search_payload = {
        "result": [
            {
                "hotel_name": "Luxury Stay",
                "class": 5,
                "review_score": 9.0,
                "min_total_price": 2100,
                "currencycode": "GBP",
                "address": "1 High St",
            },
            {
                "hotel_name": "Budget Base",
                "class": 3,
                "review_score": 8.2,
                "min_total_price": 700,
                "currencycode": "GBP",
                "address": "2 High St",
            },
            {
                "hotel_name": "Midtown Inn",
                "class": 4,
                "review_score": 8.8,
                "min_total_price": 1050,
                "currencycode": "GBP",
                "address": "3 High St",
            },
        ]
    }

    with patch("agent.tools.hotels.requests.get", side_effect=[_mock_response(location_payload), _mock_response(search_payload)]):
        with patch("agent.tools.hotels.time.sleep"):
            result = search_hotels.invoke({
                "city": "Tokyo",
                "check_in": "2099-06-01",
                "check_out": "2099-06-08",
                "guests": 2,
                "max_results": 3,
                "max_price_per_night_gbp": 160,
            })

    assert [hotel["name"] for hotel in result] == ["Budget Base", "Midtown Inn"]

