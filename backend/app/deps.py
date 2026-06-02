from typing import Annotated

from fastapi import Cookie, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.config import settings
from app.database import get_db
from app.models import User
from app.security import decode_session_token


def load_user_with_relationships(db: Session, user_id: int) -> User | None:
    return (
        db.query(User)
        .options(joinedload(User.x_account), joinedload(User.discord_account), joinedload(User.vote), joinedload(User.submission))
        .filter(User.id == user_id)
        .first()
    )


def get_current_user_optional(
    db: Annotated[Session, Depends(get_db)],
    session_cookie: Annotated[str | None, Cookie(alias=settings.session_cookie_name)] = None,
) -> User | None:
    if not session_cookie:
        return None
    user_id = decode_session_token(session_cookie)
    if not user_id:
        return None
    return load_user_with_relationships(db, user_id)


def get_current_user(user: Annotated[User | None, Depends(get_current_user_optional)]) -> User:
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required.")
    return user


def is_admin_user(user: User) -> bool:
    if not user.x_account:
        return False
    admins = {name.lower().lstrip("@") for name in settings.admin_x_usernames}
    return user.x_account.username.lower().lstrip("@") in admins


def require_admin(user: Annotated[User, Depends(get_current_user)]) -> User:
    if not is_admin_user(user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access requires a connected X account listed in ADMIN_X_USERNAMES.")
    return user
