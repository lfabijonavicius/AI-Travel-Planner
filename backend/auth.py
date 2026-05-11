from fastapi import HTTPException, Header, Depends
from supabase import create_client, Client
from config import settings

# Service role key has admin privileges — used only server-side, never sent to the browser
_admin: Client = create_client(settings.supabase_url, settings.supabase_service_key)

DAILY_MESSAGE_LIMIT = 50


async def require_user(authorization: str = Header(None)) -> str:
    """Validates Supabase Bearer token and returns user_id.

    Used as a FastAPI dependency: add `user_id: str = Depends(require_user)`
    to any route to make it protected. FastAPI calls this automatically before
    the route handler runs and returns 401 if the token is missing or invalid.
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing Authorization header")
    token = authorization.removeprefix("Bearer ")
    try:
        # Supabase verifies the JWT signature and expiry server-side
        resp = _admin.auth.get_user(token)
        return resp.user.id
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired token")


async def require_user_with_rate_limit(user_id: str = Depends(require_user)) -> str:
    """Extends require_user with a daily message quota.

    Atomically increments the user's message count for today in Supabase.
    Returns 429 if the daily limit is exceeded — applied only to /api/chat/stream.
    """
    try:
        result = _admin.rpc("increment_message_count", {"p_user_id": user_id}).execute()
        count = result.data
        if count > DAILY_MESSAGE_LIMIT:
            raise HTTPException(
                status_code=429,
                detail=f"Daily limit of {DAILY_MESSAGE_LIMIT} messages reached. Resets at midnight.",
            )
    except HTTPException:
        raise
    except Exception:
        # If rate limit check fails, allow the request rather than blocking the user
        pass
    return user_id
