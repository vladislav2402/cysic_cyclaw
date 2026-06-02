import enum
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class SubmissionStatus(str, enum.Enum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    display_name: Mapped[str | None] = mapped_column(String(120))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    x_account: Mapped["XAccount | None"] = relationship(back_populates="user", uselist=False, cascade="all, delete-orphan")
    discord_account: Mapped["DiscordAccount | None"] = relationship(back_populates="user", uselist=False, cascade="all, delete-orphan")
    vote: Mapped["Vote | None"] = relationship(back_populates="user", uselist=False, cascade="all, delete-orphan")
    submission: Mapped["Submission | None"] = relationship(back_populates="user", uselist=False)


class XAccount(Base):
    __tablename__ = "x_accounts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), unique=True)
    provider_user_id: Mapped[str] = mapped_column(String(120), unique=True)
    username: Mapped[str] = mapped_column(String(120), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    user: Mapped[User] = relationship(back_populates="x_account")


class DiscordAccount(Base):
    __tablename__ = "discord_accounts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), unique=True)
    provider_user_id: Mapped[str] = mapped_column(String(120), unique=True)
    username: Mapped[str] = mapped_column(String(120))
    role_verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    user: Mapped[User] = relationship(back_populates="discord_account")


class Submission(Base):
    __tablename__ = "submissions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), unique=True)
    participant_name: Mapped[str] = mapped_column(String(120))
    project_title: Mapped[str | None] = mapped_column(String(160))
    tweet_url: Mapped[str] = mapped_column(String(500))
    tweet_id: Mapped[str] = mapped_column(String(40), index=True)
    discord_handle: Mapped[str | None] = mapped_column(String(120))
    description: Mapped[str | None] = mapped_column(Text)
    status: Mapped[SubmissionStatus] = mapped_column(Enum(SubmissionStatus), default=SubmissionStatus.pending, index=True)
    rejection_reason: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    user: Mapped[User | None] = relationship(back_populates="submission")
    votes: Mapped[list["Vote"]] = relationship(back_populates="submission", cascade="all, delete-orphan")


class Vote(Base):
    __tablename__ = "votes"
    __table_args__ = (UniqueConstraint("user_id", "submission_id", name="uq_vote_user_submission"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), unique=True)
    submission_id: Mapped[int] = mapped_column(ForeignKey("submissions.id", ondelete="CASCADE"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    user: Mapped[User] = relationship(back_populates="vote")
    submission: Mapped[Submission] = relationship(back_populates="votes")
