from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    openai_api_key: str = ""
    travelpayouts_api_key: str = ""
    rapidapi_key: str = ""
    google_places_api_key: str = ""
    openweather_api_key: str = ""
    exchangerate_api_key: str = ""
    supabase_url: str = ""
    supabase_service_key: str = ""

    class Config:
        env_file = ".env"

settings = Settings()
