from pydantic import BaseModel

# Pydantic models auto-validate incoming JSON and raise 422 if the shape is wrong


class ChatRequest(BaseModel):
    message: str
    context: dict = {}      # structured trip info (destination, dates, budget)
    snapshot: dict = {}     # what the frontend has already shown (flights, hotels, pins)
    history: list[dict] = []  # last N chat turns so the model remembers the conversation
    trip_id: str | None = None


class ItineraryBuildRequest(BaseModel):
    context: dict = {}
    snapshot: dict = {}
