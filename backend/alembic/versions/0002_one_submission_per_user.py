"""one submission per user

Revision ID: 0002_one_submission_per_user
Revises: 0001_initial
Create Date: 2026-04-20 00:00:00.000000
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0002_one_submission_per_user"
down_revision: Union[str, None] = "0001_initial"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    submission_columns = {column["name"] for column in inspector.get_columns("submissions")}
    if "user_id" in submission_columns:
        return

    op.add_column("submissions", sa.Column("user_id", sa.Integer(), nullable=True))

    foreign_keys = inspector.get_foreign_keys("submissions")
    if not any(
        foreign_key.get("referred_table") == "users" and foreign_key.get("constrained_columns") == ["user_id"]
        for foreign_key in foreign_keys
    ):
        op.create_foreign_key(
            "fk_submissions_user_id_users",
            "submissions",
            "users",
            ["user_id"],
            ["id"],
            ondelete="SET NULL",
        )

    unique_constraints = inspector.get_unique_constraints("submissions")
    if not any(unique_constraint.get("column_names") == ["user_id"] for unique_constraint in unique_constraints):
        op.create_unique_constraint("uq_submissions_user_id", "submissions", ["user_id"])


def downgrade() -> None:
    # Revision 0001 already defines submissions.user_id and its constraints,
    # so there is nothing to undo when moving from 0002 back to 0001.
    return
