from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    openai_api_key: str = ""
    travelpayouts_api_key: str = ""
    rapidapi_key: str = ""
    google_places_api_key: str = ""
    tripadvisor_api_key: str = ""
    openweather_api_key: str = ""
    exchangerate_api_key: str = ""
    supabase_url: str = ""
    supabase_service_key: str = ""
    aero_data_box: str = ""

    # LangSmith observability — all optional, tracing is off when unset
    langchain_tracing_v2: str = ""
    langchain_api_key: str = ""
    langchain_project: str = "voyager"
    langchain_endpoint: str = ""

    class Config:
        env_file = ".env"

settings = Settings()
