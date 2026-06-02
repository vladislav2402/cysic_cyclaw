import re

from fastapi import HTTPException, status

TWEET_URL_RE = re.compile(
    r"^https?://(?:www\.)?(?:x|twitter)\.com/(?P<username>[A-Za-z0-9_]{1,20})/status/(?P<tweet_id>\d+)(?:[/?#].*)?$"
)
TWEET_USERNAME_RE = re.compile(r"^[A-Za-z0-9_]{1,20}$")


def parse_tweet_url(url: str) -> re.Match[str]:
    match = TWEET_URL_RE.match(url.strip())
    if not match:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Enter a valid X/Twitter status URL, for example https://x.com/name/status/1234567890.",
        )
    return match


def normalize_tweet_username(username: str) -> str:
    normalized = username.strip().lstrip("@")
    if not TWEET_USERNAME_RE.match(normalized):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Enter a valid X/Twitter username.",
        )
    return normalized.lower()


def extract_tweet_id(url: str) -> str:
    match = parse_tweet_url(url)
    return match.group("tweet_id")


def extract_tweet_username(url: str) -> str:
    match = parse_tweet_url(url)
    return match.group("username")
    return match.group(1)
