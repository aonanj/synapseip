"""Create overview_crowding_percentiles lookup table.

Revision ID: i3j4k5l6m7n8
Revises: f1a2b3c4d5e6
Create Date: 2026-11-19 00:00:00.000000

The IP Overview endpoint (app/overview_api.py::_lookup_crowding_percentile) has
always read this table, but no migration created it. This only creates the
empty table; scripts/utilities/refresh_overview_crowding_percentiles.py fills it.
"""

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "i3j4k5l6m7n8"
down_revision: str = "f1a2b3c4d5e6"
branch_labels: str | None = None
depends_on: str | None = None


DDL_UPGRADE = """
CREATE TABLE IF NOT EXISTS overview_crowding_percentiles (
  count_threshold integer PRIMARY KEY,
  percentile double precision NOT NULL CHECK (percentile >= 0 AND percentile <= 1),
  computed_at timestamptz NOT NULL DEFAULT now()
);
"""


DDL_DOWNGRADE = """
DROP TABLE IF EXISTS overview_crowding_percentiles;
"""


def upgrade() -> None:
    """Create the crowding percentile lookup table."""
    op.execute(DDL_UPGRADE)


def downgrade() -> None:
    """Drop the crowding percentile lookup table."""
    op.execute(DDL_DOWNGRADE)
