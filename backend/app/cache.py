from __future__ import annotations

from copy import deepcopy
from dataclasses import dataclass
from math import inf
from threading import RLock
from time import monotonic
from typing import Any

PROJECTS_CACHE_PREFIX = "projects:"
SESSION_CACHE_PREFIX = "session:"
SESSION_CACHE_TTL_SECONDS = 60


@dataclass
class CacheEntry:
    value: Any
    expires_at: float


class InMemoryTTLCache:
    def __init__(self) -> None:
        self._entries: dict[str, CacheEntry] = {}
        self._lock = RLock()

    def get(self, key: str) -> Any | None:
        now = monotonic()
        with self._lock:
            entry = self._entries.get(key)
            if not entry:
                return None
            if entry.expires_at <= now:
                self._entries.pop(key, None)
                return None
            return deepcopy(entry.value)

    def set(self, key: str, value: Any, ttl_seconds: int | None) -> None:
        with self._lock:
            expires_at = monotonic() + ttl_seconds if ttl_seconds is not None else inf
            self._entries[key] = CacheEntry(value=deepcopy(value), expires_at=expires_at)

    def delete(self, key: str) -> None:
        with self._lock:
            self._entries.pop(key, None)

    def invalidate_prefix(self, prefix: str) -> None:
        with self._lock:
            keys = [key for key in self._entries if key.startswith(prefix)]
            for key in keys:
                self._entries.pop(key, None)


cache = InMemoryTTLCache()


def project_cache_key(name: str) -> str:
    return f"{PROJECTS_CACHE_PREFIX}{name}"


def session_cache_key(user_id: int) -> str:
    return f"{SESSION_CACHE_PREFIX}{user_id}"


def get_project_cache(name: str) -> Any | None:
    return cache.get(project_cache_key(name))


def set_project_cache(name: str, value: Any) -> None:
    cache.set(project_cache_key(name), value, ttl_seconds=None)


def invalidate_project_cache() -> None:
    cache.invalidate_prefix(PROJECTS_CACHE_PREFIX)


def get_session_cache(user_id: int) -> Any | None:
    return cache.get(session_cache_key(user_id))


def set_session_cache(user_id: int, value: Any) -> None:
    cache.set(session_cache_key(user_id), value, SESSION_CACHE_TTL_SECONDS)


def invalidate_session_cache(user_id: int) -> None:
    cache.delete(session_cache_key(user_id))
