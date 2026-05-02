from pydantic import BaseModel


class ChatRequest(BaseModel):
    message: str
    context: dict = {}
    snapshot: dict = {}
    history: list[dict] = []


class ItineraryBuildRequest(BaseModel):
    context: dict = {}
    snapshot: dict = {}
