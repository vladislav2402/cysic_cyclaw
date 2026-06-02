from datetime import datetime, timezone

import httpx
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.config import settings
from app.models import User

DISCORD_API_BASE = "https://discord.com/api/v10"

_cached_required_role_id: str | None = None


def ensure_user_has_required_discord_role(user: User, db: Session) -> None:
    if not user.discord_account:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Connect Discord before voting.")

    if user.discord_account.role_verified_at:
        return

    role_id = required_role_id()
    member_roles = fetch_member_role_ids(user.discord_account.provider_user_id)

    if role_id not in member_roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Discord role {settings.discord_required_role_name} is required before voting.",
        )

    user.discord_account.role_verified_at = datetime.now(timezone.utc)
    db.flush()


def required_role_id() -> str:
    if settings.discord_required_role_id:
        return settings.discord_required_role_id

    global _cached_required_role_id
    if _cached_required_role_id:
        return _cached_required_role_id

    ensure_discord_role_configured(allow_missing_role_id=True)
    with httpx.Client(timeout=10.0) as client:
        response = client.get(
            f"{DISCORD_API_BASE}/guilds/{settings.discord_guild_id}/roles",
            headers=discord_bot_headers(),
        )
    if response.is_error:
        raise_discord_api_error(response)

    required_name = settings.discord_required_role_name.strip().lower()
    for role in response.json():
        if str(role.get("name", "")).strip().lower() == required_name:
            _cached_required_role_id = str(role["id"])
            return _cached_required_role_id

    raise HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail=f"Discord role {settings.discord_required_role_name} was not found in the configured guild.",
    )


def fetch_member_role_ids(discord_user_id: str) -> set[str]:
    ensure_discord_role_configured(allow_missing_role_id=bool(settings.discord_required_role_name))
    with httpx.Client(timeout=10.0) as client:
        response = client.get(
            f"{DISCORD_API_BASE}/guilds/{settings.discord_guild_id}/members/{discord_user_id}",
            headers=discord_bot_headers(),
        )
    if response.status_code == 404:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Join the configured Discord server and get the {settings.discord_required_role_name} role before voting.",
        )
    if response.is_error:
        raise_discord_api_error(response)

    roles = response.json().get("roles", [])
    if not isinstance(roles, list):
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Discord member role response is invalid.")
    return {str(role_id) for role_id in roles}


def ensure_discord_role_configured(*, allow_missing_role_id: bool = False) -> None:
    if not settings.discord_bot_token or not settings.discord_guild_id:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Discord role verification is not configured.")
    if not allow_missing_role_id and not settings.discord_required_role_id:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="DISCORD_REQUIRED_ROLE_ID is not configured.")


def discord_bot_headers() -> dict[str, str]:
    return {"Authorization": f"Bot {settings.discord_bot_token}"}


def raise_discord_api_error(response: httpx.Response) -> None:
    if response.status_code in {401, 403}:
        detail = "Discord role verification bot cannot access the configured guild/member data."
    else:
        detail = "Discord role verification failed. Try again later."
    raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=detail)
