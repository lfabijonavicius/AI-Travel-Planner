import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from models import ChatRequest, ItineraryBuildRequest
from streaming import (
    stream_agent_response,
    _has_valid_itinerary,
    _build_itinerary_args_from_snapshot,
)
from agent.tools import generate_itinerary
from agent.tools.places import lookup_place_core, search_places_core
from services.tripadvisor import has_tripadvisor_key, lookup_location, enrich_location

logging.basicConfig(level=logging.INFO)

app = FastAPI(title="Voyager API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok", "service": "Voyager API"}


@app.get("/api/places")
def api_places(city: str, category: str = "attractions", max_results: int = 8):
    """Direct place-lookup for the destination detail panel (not agent-mediated)."""
    return search_places_core(city, category, max_results=max_results, photos_per_place=1)


@app.get("/api/place-lookup")
def api_place_lookup(q: str, city: str, category: str = "attractions", max_results: int = 5):
    """Targeted place lookup for itinerary events generated as text only."""
    return lookup_place_core(q, city, category, max_results=max_results, photos_per_place=3)


@app.get("/api/tripadvisor/status")
def api_tripadvisor_status():
    return {"configured": has_tripadvisor_key(), "provider": "tripadvisor_content_api"}


@app.get("/api/tripadvisor/test")
def api_tripadvisor_test(lat: float, lng: float, q: str, category: str = "attractions"):
    return lookup_location(lat=lat, lng=lng, query=q, category=category)


@app.get("/api/tripadvisor/enrich")
def api_tripadvisor_enrich(lat: float, lng: float, q: str, category: str = "attractions"):
    return enrich_location(lat=lat, lng=lng, query=q, category=category)


@app.post("/api/itinerary/build")
def build_itinerary(request: ItineraryBuildRequest):
    args = _build_itinerary_args_from_snapshot(request.context, request.snapshot)
    if not args:
        return {"error": "Missing destination or trip dates for itinerary build."}
    output = generate_itinerary.invoke(args)
    if _has_valid_itinerary(output):
        return output
    return {"error": "Itinerary build did not return usable days."}


@app.post("/api/chat/stream")
async def stream_chat(request: ChatRequest):
    return StreamingResponse(stream_agent_response(request), media_type="text/event-stream")
