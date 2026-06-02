"""initial schema

Revision ID: 0001_initial
Revises:
Create Date: 2026-04-20 00:00:00.000000
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0001_initial"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    submission_status = postgresql.ENUM(
        "pending",
        "approved",
        "rejected",
        name="submissionstatus",
        create_type=False,
    )
    submission_status.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("display_name", sa.String(length=120), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "submissions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=True),
        sa.Column("participant_name", sa.String(length=120), nullable=False),
        sa.Column("project_title", sa.String(length=160), nullable=True),
        sa.Column("tweet_url", sa.String(length=500), nullable=False),
        sa.Column("tweet_id", sa.String(length=40), nullable=False),
        sa.Column("discord_handle", sa.String(length=120), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("status", submission_status, server_default="pending", nullable=False),
        sa.Column("rejection_reason", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id"),
    )
    op.create_index(op.f("ix_submissions_status"), "submissions", ["status"], unique=False)
    op.create_index(op.f("ix_submissions_tweet_id"), "submissions", ["tweet_id"], unique=False)
    op.create_table(
        "x_accounts",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("provider_user_id", sa.String(length=120), nullable=False),
        sa.Column("username", sa.String(length=120), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("provider_user_id"),
        sa.UniqueConstraint("user_id"),
    )
    op.create_index(op.f("ix_x_accounts_username"), "x_accounts", ["username"], unique=False)
    op.create_table(
        "discord_accounts",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("provider_user_id", sa.String(length=120), nullable=False),
        sa.Column("username", sa.String(length=120), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("provider_user_id"),
        sa.UniqueConstraint("user_id"),
    )
    op.create_table(
        "votes",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("submission_id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["submission_id"], ["submissions.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id"),
        sa.UniqueConstraint("user_id", "submission_id", name="uq_vote_user_submission"),
    )


def downgrade() -> None:
    op.drop_table("votes")
    op.drop_table("discord_accounts")
    op.drop_index(op.f("ix_x_accounts_username"), table_name="x_accounts")
    op.drop_table("x_accounts")
    op.drop_index(op.f("ix_submissions_tweet_id"), table_name="submissions")
    op.drop_index(op.f("ix_submissions_status"), table_name="submissions")
    op.drop_table("submissions")
    op.drop_table("users")
    submission_status = postgresql.ENUM(
        "pending",
        "approved",
        "rejected",
        name="submissionstatus",
        create_type=False,
    )
    submission_status.drop(op.get_bind(), checkfirst=True)
