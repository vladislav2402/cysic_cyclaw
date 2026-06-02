from __future__ import annotations

from collections import deque
from math import ceil
from threading import RLock
from time import monotonic


class FixedWindowRateLimiter:
    def __init__(self) -> None:
        self._events: dict[str, deque[float]] = {}
        self._lock = RLock()

    def hit(self, key: str, limit: int, window_seconds: int) -> int | None:
        now = monotonic()
        with self._lock:
            events = self._events.setdefault(key, deque())
            cutoff = now - window_seconds
            while events and events[0] <= cutoff:
                events.popleft()

            if len(events) >= limit:
                retry_after = max(1, ceil(window_seconds - (now - events[0])))
                return retry_after

            events.append(now)
            return None


vote_rate_limiter = FixedWindowRateLimiter()
