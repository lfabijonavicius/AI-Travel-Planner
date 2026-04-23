import requests
from langchain_core.tools import tool
from config import settings


@tool
def get_currency_exchange(base_currency: str = "GBP", target_currency: str = "JPY") -> dict:
    """Get the current exchange rate between two currencies.
    Returns the rate and common conversion amounts (50, 100, 500 units of base currency)."""
    try:
        response = requests.get(
            f"https://v6.exchangerate-api.com/v6/{settings.exchangerate_api_key}/latest/{base_currency}",
            timeout=10,
        )
        response.raise_for_status()
        data = response.json()

        if data.get("result") != "success":
            return {"error": f"Exchange rate API error: {data.get('error-type', 'unknown')}"}

        rates = data.get("conversion_rates", {})
        rate = rates.get(target_currency)
        if rate is None:
            return {"error": f"Currency '{target_currency}' not found."}

        return {
            "base": base_currency,
            "target": target_currency,
            "rate": round(rate, 4),
            "conversions": {
                f"50 {base_currency}": round(50 * rate, 2),
                f"100 {base_currency}": round(100 * rate, 2),
                f"500 {base_currency}": round(500 * rate, 2),
            },
            "last_updated": data.get("time_last_update_utc", ""),
        }

    except requests.Timeout:
        return {"error": "Currency exchange request timed out. Try again."}
    except requests.HTTPError as e:
        return {"error": f"Currency exchange failed: {str(e)}"}
    except Exception as e:
        return {"error": f"Unexpected error: {str(e)}"}
