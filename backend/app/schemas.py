from datetime import datetime

from pydantic import BaseModel, Field

from app.models import SubmissionStatus


class AccountOut(BaseModel):
    username: str


class UserOut(BaseModel):
    id: int
    display_name: str | None
    x_account: AccountOut | None
    discord_account: AccountOut | None
    is_verified: bool
    is_admin: bool
    voted_submission_id: int | None
    submitted_submission_id: int | None


class SubmissionCreate(BaseModel):
    project_title: str | None = Field(default=None, max_length=160)
    tweet_url: str = Field(min_length=12, max_length=500)
    discord_handle: str | None = Field(default=None, max_length=120)
    description: str | None = Field(default=None, max_length=2000)


class SubmissionOut(BaseModel):
    id: int
    participant_name: str
    project_title: str | None
    tweet_url: str
    tweet_id: str
    tweet_username: str | None
    discord_handle: str | None
    description: str | None
    status: SubmissionStatus
    rejection_reason: str | None
    vote_count: int
    created_at: datetime


class SubmissionCreated(BaseModel):
    id: int
    status: SubmissionStatus
    tweet_id: str
    message: str


class VoteOut(BaseModel):
    submission_id: int
    vote_count: int


class MockLoginIn(BaseModel):
    display_name: str = Field(default="CyOps Voter", max_length=120)


class MockLinkIn(BaseModel):
    username: str = Field(min_length=2, max_length=120)
    provider_user_id: str | None = Field(default=None, max_length=120)


class RejectSubmissionIn(BaseModel):
    reason: str | None = Field(default=None, max_length=1000)

