from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import desc, func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.cache import get_project_cache, invalidate_project_cache, invalidate_session_cache, set_project_cache
from app.config import settings
from app.database import get_db
from app.deps import get_current_user
from app.models import Submission, SubmissionStatus, User, Vote
from app.rate_limit import vote_rate_limiter
from app.schemas import SubmissionCreate, SubmissionCreated, SubmissionOut, VoteOut
from app.serializers import serialize_submission, submission_public_handle
from app.tweets import extract_tweet_id, extract_tweet_username, normalize_tweet_username

router = APIRouter()


def enforce_vote_rate_limit(user_id: int) -> None:
    retry_after = vote_rate_limiter.hit(f"vote:{user_id}", settings.vote_rate_limit_per_minute, 60)
    if retry_after is not None:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Vote rate limit exceeded. Try again later.",
            headers={"Retry-After": str(retry_after)},
        )


def find_approved_submission_by_tweet_username(db: Session, tweet_username: str) -> Submission | None:
    normalized_username = normalize_tweet_username(tweet_username)
    submissions = (
        db.query(Submission)
        .filter(Submission.status == SubmissionStatus.approved)
        .order_by(desc(Submission.created_at))
        .all()
    )
    for submission in submissions:
        public_handle = submission_public_handle(submission)
        if not public_handle:
            continue
        if public_handle.lower().lstrip("@") == normalized_username:
            return submission
    return None


@router.get("/submissions", response_model=list[SubmissionOut])
def list_submissions(db: Annotated[Session, Depends(get_db)]) -> list[SubmissionOut]:
    cached = get_project_cache("list")
    if cached is not None:
        return cached
    rows = (
        db.query(Submission, func.count(Vote.id).label("vote_count"))
        .outerjoin(Vote, Vote.submission_id == Submission.id)
        .filter(Submission.status == SubmissionStatus.approved)
        .group_by(Submission.id)
        .order_by(desc(Submission.created_at))
        .all()
    )
    payload = [serialize_submission(db, submission, int(vote_count)).model_dump(mode="json") for submission, vote_count in rows]
    set_project_cache("list", payload)
    return payload


@router.post("/submissions", response_model=SubmissionCreated, status_code=status.HTTP_201_CREATED)
def create_submission(
    payload: SubmissionCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> SubmissionCreated:
    if not current_user.x_account or not current_user.discord_account:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Connect both X/Twitter and Discord before submitting a project.")
    existing_user_submission = db.query(Submission).filter(
        Submission.user_id == current_user.id,
        Submission.status != SubmissionStatus.rejected,
    ).first()
    if existing_user_submission:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="You already have a submission waiting for review or published.")
    tweet_id = extract_tweet_id(payload.tweet_url)
    tweet_username = extract_tweet_username(payload.tweet_url).lower()
    active_submissions = db.query(Submission).filter(Submission.status != SubmissionStatus.rejected).all()
    for active_submission in active_submissions:
        public_handle = submission_public_handle(active_submission)
        if public_handle and public_handle.lower().lstrip("@") == tweet_username:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This X/Twitter username already has a submitted project.")
    linked_x_username = current_user.x_account.username.lower().lstrip("@")
    if linked_x_username != tweet_username:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Submit a post from the same X/Twitter account that is connected to your session.")
    submission = Submission(
        user_id=current_user.id,
        participant_name=f"@{tweet_username}",
        project_title=payload.project_title,
        tweet_url=payload.tweet_url,
        tweet_id=tweet_id,
        discord_handle=current_user.discord_account.username,
        description=payload.description,
        status=SubmissionStatus.pending,
    )
    db.add(submission)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="A submission with this tweet could not be created.")
    db.refresh(submission)
    invalidate_project_cache()
    invalidate_session_cache(current_user.id)
    return SubmissionCreated(id=submission.id, status=submission.status, tweet_id=tweet_id, message="Submission sent for admin review.")


@router.get("/submissions/by-handle/{tweet_username}", response_model=SubmissionOut)
def get_submission_by_tweet_username(tweet_username: str, db: Annotated[Session, Depends(get_db)]) -> SubmissionOut:
    cache_key = f"by-handle:{normalize_tweet_username(tweet_username)}"
    cached = get_project_cache(cache_key)
    if cached is not None:
        return cached
    submission = find_approved_submission_by_tweet_username(db, tweet_username)
    if not submission:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Approved submission not found for this X/Twitter username.")
    payload = serialize_submission(db, submission).model_dump(mode="json")
    set_project_cache(cache_key, payload)
    return payload


@router.get("/submissions/{submission_id}", response_model=SubmissionOut)
def get_submission(submission_id: int, db: Annotated[Session, Depends(get_db)]) -> SubmissionOut:
    cache_key = f"by-id:{submission_id}"
    cached = get_project_cache(cache_key)
    if cached is not None:
        return cached
    submission = db.query(Submission).filter(Submission.id == submission_id, Submission.status == SubmissionStatus.approved).first()
    if not submission:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Approved submission not found.")
    payload = serialize_submission(db, submission).model_dump(mode="json")
    set_project_cache(cache_key, payload)
    return payload


@router.get("/submissions/{submission_id}/votes", response_model=VoteOut)
def get_votes(submission_id: int, db: Annotated[Session, Depends(get_db)]) -> VoteOut:
    cache_key = f"votes:{submission_id}"
    cached = get_project_cache(cache_key)
    if cached is not None:
        return cached
    submission = db.query(Submission).filter(Submission.id == submission_id, Submission.status == SubmissionStatus.approved).first()
    if not submission:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Approved submission not found.")
    vote_count = int(db.query(func.count(Vote.id)).filter(Vote.submission_id == submission_id).scalar() or 0)
    payload = VoteOut(submission_id=submission_id, vote_count=vote_count).model_dump(mode="json")
    set_project_cache(cache_key, payload)
    return payload


@router.post("/submissions/{submission_id}/vote", response_model=VoteOut)
def vote_for_submission(
    submission_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> VoteOut:
    enforce_vote_rate_limit(current_user.id)
    if not current_user.x_account or not current_user.discord_account:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Connect both X/Twitter and Discord before voting.")
    submission = db.query(Submission).filter(Submission.id == submission_id, Submission.status == SubmissionStatus.approved).first()
    if not submission:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Voting is only available for approved submissions.")
    existing_vote = db.query(Vote).filter(Vote.user_id == current_user.id).first()
    if existing_vote:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="You have already voted. Each verified user can vote for one submission only.")
    db.add(Vote(user_id=current_user.id, submission_id=submission_id))
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="You have already voted.")
    vote_count = int(db.query(func.count(Vote.id)).filter(Vote.submission_id == submission_id).scalar() or 0)
    invalidate_project_cache()
    invalidate_session_cache(current_user.id)
    return VoteOut(submission_id=submission_id, vote_count=vote_count)


@router.delete("/submissions/{submission_id}/vote", response_model=VoteOut)
def retract_vote(
    submission_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> VoteOut:
    enforce_vote_rate_limit(current_user.id)
    vote = db.query(Vote).filter(Vote.user_id == current_user.id, Vote.submission_id == submission_id).first()
    if not vote:
        submission_exists = db.query(Submission.id).filter(Submission.id == submission_id).first()
        if not submission_exists:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Submission not found.")
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="You have not voted for this submission.")
    db.delete(vote)
    db.commit()
    vote_count = int(db.query(func.count(Vote.id)).filter(Vote.submission_id == submission_id).scalar() or 0)
    invalidate_project_cache()
    invalidate_session_cache(current_user.id)
    return VoteOut(submission_id=submission_id, vote_count=vote_count)


@router.get("/leaderboard", response_model=list[SubmissionOut])
def leaderboard(db: Annotated[Session, Depends(get_db)]) -> list[SubmissionOut]:
    cached = get_project_cache("leaderboard")
    if cached is not None:
        return cached
    rows = (
        db.query(Submission, func.count(Vote.id).label("vote_count"))
        .outerjoin(Vote, Vote.submission_id == Submission.id)
        .filter(Submission.status == SubmissionStatus.approved)
        .group_by(Submission.id)
        .order_by(desc("vote_count"), Submission.created_at.asc())
        .all()
    )
    payload = [serialize_submission(db, submission, int(vote_count)).model_dump(mode="json") for submission, vote_count in rows]
    set_project_cache("leaderboard", payload)
    return payload
