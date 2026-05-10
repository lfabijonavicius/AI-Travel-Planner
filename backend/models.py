from pydantic import BaseModel


class ChatRequest(BaseModel):
    message: str
    context: dict = {}
    snapshot: dict = {}
    history: list[dict] = []
    trip_id: str | None = None


class ItineraryBuildRequest(BaseModel):
    context: dict = {}
    snapshot: dict = {}
