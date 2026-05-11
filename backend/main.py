import logging
import os
from fastapi import FastAPI, Depends, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

logging.basicConfig(level=logging.INFO)

from config import settings

# Activate LangSmith tracing when credentials are present.
# LangGraph/LangChain read these env vars automatically — no code changes needed
# anywhere else. Every agent run, tool call, and token count will appear in the
# LangSmith dashboard under the configured project.
if settings.langchain_api_key:
    os.environ.setdefault("LANGCHAIN_TRACING_V2", settings.langchain_tracing_v2 or "true")
    os.environ.setdefault("LANGCHAIN_API_KEY", settings.langchain_api_key)
    os.environ.setdefault("LANGCHAIN_PROJECT", settings.langchain_project)
    if settings.langchain_endpoint:
        os.environ.setdefault("LANGCHAIN_ENDPOINT", settings.langchain_endpoint)
    logging.getLogger(__name__).info(f"LangSmith tracing enabled → project '{settings.langchain_project}' endpoint={settings.langchain_endpoint or 'default'}")

from models import ChatRequest, ItineraryBuildRequest
from streaming import (
    stream_agent_response,
    _has_valid_itinerary,
    _build_itinerary_args_from_snapshot,
)
from agent.tools import generate_itinerary
from agent.tools.places import lookup_place_core, search_places_core
from services.tripadvisor import has_tripadvisor_key, lookup_location, enrich_location
from auth import require_user, require_user_with_rate_limit

app = FastAPI(title="Voyager API")

_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)


@app.get("/health")
def health():
    return {"status": "ok", "service": "Voyager API"}


@app.get("/api/places")
def api_places(
    city: str,
    category: str = "attractions",
    max_results: int = Query(default=8, ge=1, le=20),
    user_id: str = Depends(require_user),
):
    """Direct place-lookup for the destination detail panel (not agent-mediated)."""
    return search_places_core(city, category, max_results=max_results, photos_per_place=1)


@app.get("/api/place-lookup")
def api_place_lookup(
    q: str,
    city: str,
    category: str = "attractions",
    max_results: int = Query(default=5, ge=1, le=10),
    user_id: str = Depends(require_user),
):
    """Targeted place lookup for itinerary events generated as text only."""
    return lookup_place_core(q, city, category, max_results=max_results, photos_per_place=3)


@app.get("/api/tripadvisor/status")
def api_tripadvisor_status():
    return {"configured": has_tripadvisor_key(), "provider": "tripadvisor_content_api"}


@app.get("/api/tripadvisor/test")
def api_tripadvisor_test(
    lat: float, lng: float, q: str, category: str = "attractions",
    user_id: str = Depends(require_user),
):
    return lookup_location(lat=lat, lng=lng, query=q, category=category)


@app.get("/api/tripadvisor/enrich")
def api_tripadvisor_enrich(
    lat: float, lng: float, q: str, category: str = "attractions",
    user_id: str = Depends(require_user),
):
    return enrich_location(lat=lat, lng=lng, query=q, category=category)


@app.post("/api/itinerary/build")
def build_itinerary(request: ItineraryBuildRequest, user_id: str = Depends(require_user)):
    args = _build_itinerary_args_from_snapshot(request.context, request.snapshot)
    if not args:
        return {"error": "Missing destination or trip dates for itinerary build."}
    output = generate_itinerary.invoke(args)
    if _has_valid_itinerary(output):
        return output
    return {"error": "Itinerary build did not return usable days."}


@app.post("/api/chat/stream")
async def stream_chat(request: ChatRequest, user_id: str = Depends(require_user_with_rate_limit)):
    return StreamingResponse(stream_agent_response(request, user_id), media_type="text/event-stream")
