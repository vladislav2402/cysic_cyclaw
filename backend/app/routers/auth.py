import base64
import hashlib
import logging
import secrets
from datetime import datetime, timezone
from typing import Annotated
from urllib.parse import urlencode, urlparse

import httpx
from fastapi import APIRouter, Cookie, Depends, HTTPException, Request, Response, status
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from app.cache import get_session_cache, invalidate_session_cache, set_session_cache
from app.config import settings
from app.database import get_db
from app.deps import get_current_user, get_current_user_optional, load_user_with_relationships
from app.models import DiscordAccount, User, XAccount
from app.security import clear_session_cookie, decode_session_token, set_session_cookie
from app.schemas import MockLinkIn, MockLoginIn, UserOut
from app.serializers import serialize_user

router = APIRouter()
logger = logging.getLogger(__name__)

X_AUTHORIZE_URL = "https://x.com/i/oauth2/authorize"
X_TOKEN_URL = "https://api.x.com/2/oauth2/token"
X_ME_URL = "https://api.x.com/2/users/me"
X_STATE_COOKIE = "cyops_x_oauth_state"
X_CODE_VERIFIER_COOKIE = "cyops_x_oauth_code_verifier"
DISCORD_AUTHORIZE_URL = "https://discord.com/oauth2/authorize"
DISCORD_TOKEN_URL = "https://discord.com/api/oauth2/token"
DISCORD_ME_URL = "https://discord.com/api/users/@me"
DISCORD_STATE_COOKIE = "cyops_discord_oauth_state"
OAUTH_COOKIE_MAX_AGE = 60 * 10


def redirect_to_frontend_login(oauth: str, **params: str) -> RedirectResponse:
    query = {"oauth": oauth, **{key: value for key, value in params.items() if value}}
    return RedirectResponse(f"{settings.frontend_url}/login?{urlencode(query)}")


def set_temp_oauth_cookie(response: Response, key: str, value: str) -> None:
    response.set_cookie(
        key=key,
        value=value,
        httponly=True,
        secure=settings.session_cookie_secure,
        samesite="lax",
        max_age=OAUTH_COOKIE_MAX_AGE,
        path="/",
    )


def clear_temp_oauth_cookies(response: Response, *keys: str) -> None:
    for key in keys:
        response.delete_cookie(key=key, path="/")


def create_pkce_verifier() -> str:
    return secrets.token_urlsafe(48)


def create_pkce_challenge(code_verifier: str) -> str:
    digest = hashlib.sha256(code_verifier.encode("utf-8")).digest()
    return base64.urlsafe_b64encode(digest).decode("utf-8").rstrip("=")


def x_basic_auth_header() -> str:
    if not settings.x_client_id or not settings.x_client_secret:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="X OAuth is not configured.")
    credentials = f"{settings.x_client_id}:{settings.x_client_secret}".encode("utf-8")
    return f"Basic {base64.b64encode(credentials).decode('utf-8')}"


def oauth_not_configured_response(request: Request, oauth: str) -> RedirectResponse:
    if not settings.enable_dev_auth_mocks:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=f"{oauth.capitalize()} OAuth is not configured.")
    allowed_hosts = {
        urlparse(settings.frontend_url).netloc,
        "localhost:3000",
        "127.0.0.1:3000",
        "localhost:8080",
        "127.0.0.1:8080",
    }
    for header in ("origin", "referer"):
        value = request.headers.get(header)
        if not value:
            continue
        parsed = urlparse(value)
        if parsed.scheme in {"http", "https"} and parsed.netloc in allowed_hosts:
            return RedirectResponse(f"{parsed.scheme}://{parsed.netloc}/login?oauth={oauth}-not-configured")
    return RedirectResponse(f"{settings.frontend_url}/login?oauth={oauth}-not-configured")


@router.get("/auth/x/login")
def x_login(request: Request) -> RedirectResponse:
    if not settings.x_client_id or not settings.x_client_secret:
        return oauth_not_configured_response(request, "x")
    state = secrets.token_urlsafe(32)
    code_verifier = create_pkce_verifier()
    code_challenge = create_pkce_challenge(code_verifier)
    query = urlencode(
        {
            "response_type": "code",
            "client_id": settings.x_client_id,
            "redirect_uri": settings.x_redirect_uri,
            "scope": "tweet.read users.read offline.access",
            "state": state,
            "code_challenge": code_challenge,
            "code_challenge_method": "S256",
        }
    )
    response = RedirectResponse(f"{X_AUTHORIZE_URL}?{query}")
    set_temp_oauth_cookie(response, X_STATE_COOKIE, state)
    set_temp_oauth_cookie(response, X_CODE_VERIFIER_COOKIE, code_verifier)
    return response


@router.get("/auth/x/callback")
def x_callback(
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User | None, Depends(get_current_user_optional)],
    code: str | None = None,
    state: str | None = None,
    error: str | None = None,
    error_description: str | None = None,
) -> RedirectResponse:
    if error:
        error_response = redirect_to_frontend_login("x-error", reason=error, description=error_description or "")
        clear_temp_oauth_cookies(error_response, X_STATE_COOKIE, X_CODE_VERIFIER_COOKIE)
        return error_response

    stored_state = request.cookies.get(X_STATE_COOKIE)
    code_verifier = request.cookies.get(X_CODE_VERIFIER_COOKIE)
    if not code or not state or not stored_state or not code_verifier or state != stored_state:
        error_response = redirect_to_frontend_login("x-error", reason="state-mismatch")
        clear_temp_oauth_cookies(error_response, X_STATE_COOKIE, X_CODE_VERIFIER_COOKIE)
        return error_response

    try:
        with httpx.Client(timeout=10.0) as client:
            token_response = client.post(
                X_TOKEN_URL,
                headers={
                    "Content-Type": "application/x-www-form-urlencoded",
                    "Authorization": x_basic_auth_header(),
                },
                data={
                    "code": code,
                    "grant_type": "authorization_code",
                    "client_id": settings.x_client_id,
                    "redirect_uri": settings.x_redirect_uri,
                    "code_verifier": code_verifier,
                },
            )
            if token_response.is_error:
                logger.error("X token exchange failed: status=%s body=%s", token_response.status_code, token_response.text)
                error_response = redirect_to_frontend_login(
                    "x-error",
                    reason="token-exchange-failed",
                    stage="token",
                    status=str(token_response.status_code),
                )
                clear_temp_oauth_cookies(error_response, X_STATE_COOKIE, X_CODE_VERIFIER_COOKIE)
                return error_response
            token_payload = token_response.json()
            access_token = token_payload["access_token"]

            me_response = client.get(
                X_ME_URL,
                headers={"Authorization": f"Bearer {access_token}"},
            )
            if me_response.is_error:
                logger.error("X profile fetch failed: status=%s body=%s", me_response.status_code, me_response.text)
                error_response = redirect_to_frontend_login(
                    "x-error",
                    reason="token-exchange-failed",
                    stage="profile",
                    status=str(me_response.status_code),
                )
                clear_temp_oauth_cookies(error_response, X_STATE_COOKIE, X_CODE_VERIFIER_COOKIE)
                return error_response
            me_payload = me_response.json()
            x_user = me_payload["data"]
    except (httpx.HTTPError, KeyError, ValueError) as exc:
        logger.exception("X OAuth callback failed before completion.")
        error_response = redirect_to_frontend_login(
            "x-error",
            reason="token-exchange-failed",
            stage="network",
            description=str(exc),
        )
        clear_temp_oauth_cookies(error_response, X_STATE_COOKIE, X_CODE_VERIFIER_COOKIE)
        return error_response

    provider_user_id = str(x_user["id"])
    username = str(x_user["username"]).lstrip("@")
    display_name = x_user.get("name")

    linked_account = db.query(XAccount).filter(XAccount.provider_user_id == provider_user_id).first()
    if linked_account:
        user = linked_account.user
        linked_account.username = username
        linked_account.provider_user_id = provider_user_id
        if display_name:
            user.display_name = display_name
    else:
        user = current_user or User()
        if current_user is None:
            db.add(user)
        if display_name:
            user.display_name = display_name
        if user.x_account:
            user.x_account.username = username
            user.x_account.provider_user_id = provider_user_id
        else:
            db.add(XAccount(user=user, username=username, provider_user_id=provider_user_id))

    db.commit()
    db.refresh(user)
    invalidate_session_cache(user.id)
    if current_user and current_user.id != user.id:
        invalidate_session_cache(current_user.id)

    success_response = redirect_to_frontend_login("x-success")
    clear_temp_oauth_cookies(success_response, X_STATE_COOKIE, X_CODE_VERIFIER_COOKIE)
    set_session_cookie(success_response, user.id)
    return success_response


@router.get("/auth/discord/login")
def discord_login(request: Request) -> RedirectResponse:
    if not settings.discord_client_id or not settings.discord_client_secret:
        return oauth_not_configured_response(request, "discord")
    state = secrets.token_urlsafe(32)
    query = urlencode(
        {
            "client_id": settings.discord_client_id,
            "redirect_uri": settings.discord_redirect_uri,
            "response_type": "code",
            "scope": "identify",
            "state": state,
        }
    )
    response = RedirectResponse(f"{DISCORD_AUTHORIZE_URL}?{query}")
    set_temp_oauth_cookie(response, DISCORD_STATE_COOKIE, state)
    return response


@router.get("/auth/discord/callback")
def discord_callback(
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User | None, Depends(get_current_user_optional)],
    code: str | None = None,
    state: str | None = None,
    error: str | None = None,
    error_description: str | None = None,
) -> RedirectResponse:
    if error:
        error_response = redirect_to_frontend_login("discord-error", reason=error, description=error_description or "")
        clear_temp_oauth_cookies(error_response, DISCORD_STATE_COOKIE)
        return error_response

    stored_state = request.cookies.get(DISCORD_STATE_COOKIE)
    if not code or not state or not stored_state or state != stored_state:
        error_response = redirect_to_frontend_login("discord-error", reason="state-mismatch")
        clear_temp_oauth_cookies(error_response, DISCORD_STATE_COOKIE)
        return error_response

    try:
        with httpx.Client(timeout=10.0) as client:
            token_response = client.post(
                DISCORD_TOKEN_URL,
                headers={"Content-Type": "application/x-www-form-urlencoded"},
                auth=(settings.discord_client_id or "", settings.discord_client_secret or ""),
                data={
                    "code": code,
                    "grant_type": "authorization_code",
                    "redirect_uri": settings.discord_redirect_uri,
                },
            )
            if token_response.is_error:
                logger.error("Discord token exchange failed: status=%s body=%s", token_response.status_code, token_response.text)
                error_response = redirect_to_frontend_login(
                    "discord-error",
                    reason="token-exchange-failed",
                    stage="token",
                    status=str(token_response.status_code),
                )
                clear_temp_oauth_cookies(error_response, DISCORD_STATE_COOKIE)
                return error_response
            token_payload = token_response.json()
            access_token = token_payload["access_token"]

            me_response = client.get(
                DISCORD_ME_URL,
                headers={"Authorization": f"Bearer {access_token}"},
            )
            if me_response.is_error:
                logger.error("Discord profile fetch failed: status=%s body=%s", me_response.status_code, me_response.text)
                error_response = redirect_to_frontend_login(
                    "discord-error",
                    reason="token-exchange-failed",
                    stage="profile",
                    status=str(me_response.status_code),
                )
                clear_temp_oauth_cookies(error_response, DISCORD_STATE_COOKIE)
                return error_response
            discord_user = me_response.json()
    except (httpx.HTTPError, KeyError, ValueError) as exc:
        logger.exception("Discord OAuth callback failed before completion.")
        error_response = redirect_to_frontend_login(
            "discord-error",
            reason="token-exchange-failed",
            stage="network",
            description=str(exc),
        )
        clear_temp_oauth_cookies(error_response, DISCORD_STATE_COOKIE)
        return error_response

    provider_user_id = str(discord_user["id"])
    username = str(discord_user["username"])
    display_name = discord_user.get("global_name") or username

    linked_account = db.query(DiscordAccount).filter(DiscordAccount.provider_user_id == provider_user_id).first()
    if linked_account:
        user = linked_account.user
        linked_account.username = username
        linked_account.provider_user_id = provider_user_id
        if display_name:
            user.display_name = display_name
    else:
        user = current_user or User()
        if current_user is None:
            db.add(user)
        if display_name and not user.display_name:
            user.display_name = display_name
        if user.discord_account:
            user.discord_account.username = username
            user.discord_account.provider_user_id = provider_user_id
        else:
            db.add(DiscordAccount(user=user, username=username, provider_user_id=provider_user_id))

    db.commit()
    db.refresh(user)
    invalidate_session_cache(user.id)
    if current_user and current_user.id != user.id:
        invalidate_session_cache(current_user.id)

    success_response = redirect_to_frontend_login("discord-success")
    clear_temp_oauth_cookies(success_response, DISCORD_STATE_COOKIE)
    set_session_cookie(success_response, user.id)
    return success_response


@router.get("/auth/me", response_model=UserOut | None)
def me(
    db: Annotated[Session, Depends(get_db)],
    session_cookie: Annotated[str | None, Cookie(alias=settings.session_cookie_name)] = None,
) -> UserOut | dict | None:
    if not session_cookie:
        return None
    user_id = decode_session_token(session_cookie)
    if not user_id:
        return None
    cached = get_session_cache(user_id)
    if cached is not None:
        return cached
    user = load_user_with_relationships(db, user_id)
    if not user:
        invalidate_session_cache(user_id)
        return None
    payload = serialize_user(user)
    if not payload:
        return None
    serialized = payload.model_dump(mode="json")
    set_session_cache(user_id, serialized)
    return serialized


@router.post("/auth/x/logout", response_model=UserOut)
def logout_x(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> UserOut:
    if not current_user.x_account:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="X account is not connected.")
    db.delete(current_user.x_account)
    db.commit()
    db.refresh(current_user)
    invalidate_session_cache(current_user.id)
    return serialize_user(current_user)


@router.post("/auth/discord/logout", response_model=UserOut)
def logout_discord(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> UserOut:
    if not current_user.discord_account:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Discord account is not connected.")
    db.delete(current_user.discord_account)
    db.commit()
    db.refresh(current_user)
    invalidate_session_cache(current_user.id)
    return serialize_user(current_user)


@router.post("/auth/logout")
def logout(
    response: Response,
    current_user: Annotated[User | None, Depends(get_current_user_optional)],
) -> dict[str, str]:
    if current_user:
        invalidate_session_cache(current_user.id)
    clear_session_cookie(response)
    return {"message": "Logged out."}


@router.post("/dev/mock-login", response_model=UserOut)
def mock_login(
    payload: MockLoginIn,
    response: Response,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User | None, Depends(get_current_user_optional)],
) -> UserOut:
    if not settings.enable_dev_auth_mocks:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found.")
    user = current_user
    if user:
        user.display_name = payload.display_name
    else:
        user = User(display_name=payload.display_name)
        db.add(user)
    db.commit()
    db.refresh(user)
    invalidate_session_cache(user.id)
    set_session_cookie(response, user.id)
    return serialize_user(user)


@router.post("/dev/mock-link-x", response_model=UserOut)
def mock_link_x(
    payload: MockLinkIn,
    response: Response,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> UserOut:
    if not settings.enable_dev_auth_mocks:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found.")
    username = payload.username.lstrip("@")
    provider_user_id = payload.provider_user_id or f"mock-x-{username.lower()}"
    existing = db.query(XAccount).filter(XAccount.provider_user_id == provider_user_id, XAccount.user_id != current_user.id).first()
    if existing:
        current_user = existing.user
        set_session_cookie(response, current_user.id)
    if current_user.x_account:
        current_user.x_account.username = username
        current_user.x_account.provider_user_id = provider_user_id
    else:
        db.add(XAccount(user_id=current_user.id, username=username, provider_user_id=provider_user_id))
    db.commit()
    db.refresh(current_user)
    invalidate_session_cache(current_user.id)
    return serialize_user(current_user)


@router.post("/dev/mock-link-discord", response_model=UserOut)
def mock_link_discord(
    payload: MockLinkIn,
    response: Response,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> UserOut:
    if not settings.enable_dev_auth_mocks:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found.")
    provider_user_id = payload.provider_user_id or f"mock-discord-{payload.username.lower()}"
    existing = db.query(DiscordAccount).filter(DiscordAccount.provider_user_id == provider_user_id, DiscordAccount.user_id != current_user.id).first()
    if existing:
        current_user = existing.user
        set_session_cookie(response, current_user.id)
    if current_user.discord_account:
        current_user.discord_account.username = payload.username
        current_user.discord_account.provider_user_id = provider_user_id
        current_user.discord_account.role_verified_at = datetime.now(timezone.utc)
    else:
        db.add(
            DiscordAccount(
                user_id=current_user.id,
                username=payload.username,
                provider_user_id=provider_user_id,
                role_verified_at=datetime.now(timezone.utc),
            )
        )
    db.commit()
    db.refresh(current_user)
    invalidate_session_cache(current_user.id)
    return serialize_user(current_user)
