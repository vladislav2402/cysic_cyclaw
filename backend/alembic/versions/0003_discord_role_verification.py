"""discord role verification

Revision ID: 0003_discord_role_verification
Revises: 0002_one_submission_per_user
Create Date: 2026-06-02 00:00:00.000000
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0003_discord_role_verification"
down_revision: Union[str, None] = "0002_one_submission_per_user"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {column["name"] for column in inspector.get_columns("discord_accounts")}

    if "role_verified_at" not in columns:
        op.add_column("discord_accounts", sa.Column("role_verified_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {column["name"] for column in inspector.get_columns("discord_accounts")}

    if "role_verified_at" in columns:
        op.drop_column("discord_accounts", "role_verified_at")
