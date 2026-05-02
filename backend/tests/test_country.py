import json
import requests
from pathlib import Path
from unittest.mock import MagicMock, patch

from agent.tools.country import get_country_info

FIXTURES = Path(__file__).parent / "fixtures"


def _mock_ok(fixture_file):
    m = MagicMock()
    m.raise_for_status.return_value = None
    m.json.return_value = json.loads((FIXTURES / fixture_file).read_text())
    return m


def test_successful_lookup():
    with patch("agent.tools.country.requests.get", return_value=_mock_ok("country_japan.json")):
        result = get_country_info.invoke({"country": "Japan"})
    assert result["name"] == "Japan"
    assert result["capital"] == "Tokyo"
    assert result["driving_side"] == "Left"
    assert any(c["code"] == "JPY" for c in result["currencies"])


def test_population_formatted_as_millions():
    with patch("agent.tools.country.requests.get", return_value=_mock_ok("country_japan.json")):
        result = get_country_info.invoke({"country": "Japan"})
    assert "M" in result["population"]


def test_country_not_found():
    m = MagicMock()
    m.raise_for_status.side_effect = requests.HTTPError("404")
    with patch("agent.tools.country.requests.get", return_value=m):
        result = get_country_info.invoke({"country": "Neverland"})
    assert "error" in result


def test_timeout():
    with patch("agent.tools.country.requests.get", side_effect=requests.Timeout):
        result = get_country_info.invoke({"country": "Japan"})
    assert "error" in result
    assert "timed out" in result["error"]
