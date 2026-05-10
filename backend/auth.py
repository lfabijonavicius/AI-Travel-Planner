from fastapi import HTTPException, Header
from supabase import create_client, Client
from config import settings

_admin: Client = create_client(settings.supabase_url, settings.supabase_service_key)


async def require_user(authorization: str = Header(None)) -> str:
    """Validates Supabase Bearer token and returns user_id."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing Authorization header")
    token = authorization.removeprefix("Bearer ")
    try:
        resp = _admin.auth.get_user(token)
        return resp.user.id
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
