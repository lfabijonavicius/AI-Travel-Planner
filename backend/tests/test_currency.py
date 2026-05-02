import json
import requests
from pathlib import Path
from unittest.mock import MagicMock, patch

from agent.tools.currency import get_currency_exchange

FIXTURES = Path(__file__).parent / "fixtures"


def _mock_ok(fixture_file):
    m = MagicMock()
    m.raise_for_status.return_value = None
    m.json.return_value = json.loads((FIXTURES / fixture_file).read_text())
    return m


def test_successful_rate():
    with patch("agent.tools.currency.requests.get", return_value=_mock_ok("currency_gbp_jpy.json")):
        result = get_currency_exchange.invoke({"base_currency": "GBP", "target_currency": "JPY"})
    assert result["base"] == "GBP"
    assert result["target"] == "JPY"
    assert result["rate"] == 192.5432
    assert "100 GBP" in result["conversions"]


def test_unknown_target_currency():
    with patch("agent.tools.currency.requests.get", return_value=_mock_ok("currency_gbp_jpy.json")):
        result = get_currency_exchange.invoke({"base_currency": "GBP", "target_currency": "XYZ"})
    assert "error" in result
    assert "XYZ" in result["error"]


def test_api_error_result():
    m = MagicMock()
    m.raise_for_status.return_value = None
    m.json.return_value = {"result": "error", "error-type": "invalid-key"}
    with patch("agent.tools.currency.requests.get", return_value=m):
        result = get_currency_exchange.invoke({"base_currency": "GBP", "target_currency": "JPY"})
    assert "error" in result


def test_timeout():
    with patch("agent.tools.currency.requests.get", side_effect=requests.Timeout):
        result = get_currency_exchange.invoke({"base_currency": "GBP", "target_currency": "JPY"})
    assert "error" in result
    assert "timed out" in result["error"]


def test_http_error():
    m = MagicMock()
    m.raise_for_status.side_effect = requests.HTTPError("403")
    with patch("agent.tools.currency.requests.get", return_value=m):
        result = get_currency_exchange.invoke({"base_currency": "GBP", "target_currency": "JPY"})
    assert "error" in result
