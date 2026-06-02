from sqlalchemy import func
from sqlalchemy.orm import Session

from app.deps import is_admin_user
from app.models import Submission, User, Vote
from app.schemas import AccountOut, SubmissionOut, UserOut
from app.tweets import extract_tweet_username


def serialize_user(user: User | None) -> UserOut | None:
    if not user:
        return None
    return UserOut(
        id=user.id,
        display_name=user.display_name,
        x_account=AccountOut(username=user.x_account.username) if user.x_account else None,
        discord_account=AccountOut(username=user.discord_account.username) if user.discord_account else None,
        is_verified=bool(user.x_account and user.discord_account),
        is_admin=is_admin_user(user),
        voted_submission_id=user.vote.submission_id if user.vote else None,
        submitted_submission_id=user.submission.id if user.submission else None,
    )


def vote_count_for_submission(db: Session, submission_id: int) -> int:
    return int(db.query(func.count(Vote.id)).filter(Vote.submission_id == submission_id).scalar() or 0)


def submission_public_handle(submission: Submission) -> str | None:
    try:
        tweet_username = extract_tweet_username(submission.tweet_url)
        if tweet_username:
            return tweet_username
    except Exception:
        pass
    participant_name = (submission.participant_name or "").strip().lstrip("@")
    if participant_name:
        return participant_name
    if submission.user and submission.user.x_account and submission.user.x_account.username:
        return submission.user.x_account.username
    return None


def serialize_submission(db: Session, submission: Submission, vote_count: int | None = None) -> SubmissionOut:
    if vote_count is None:
        vote_count = vote_count_for_submission(db, submission.id)
    return SubmissionOut(
        id=submission.id,
        participant_name=submission.participant_name,
        project_title=submission.project_title,
        tweet_url=submission.tweet_url,
        tweet_id=submission.tweet_id,
        tweet_username=submission_public_handle(submission),
        discord_handle=submission.discord_handle,
        description=submission.description,
        status=submission.status,
        rejection_reason=submission.rejection_reason,
        vote_count=vote_count,
        created_at=submission.created_at,
    )
