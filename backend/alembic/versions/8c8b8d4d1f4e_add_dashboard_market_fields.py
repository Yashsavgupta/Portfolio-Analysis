"""Add additional market fields for portfolio dashboard."""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


# revision identifiers, used by Alembic.
revision = '8c8b8d4d1f4e'
down_revision = '736943bc5ec9'
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    existing = {column['name'] for column in inspector.get_columns('instruments')}

    for column in [
        sa.Column('price_to_book', sa.Float(), nullable=True),
        sa.Column('dividend_yield', sa.Float(), nullable=True),
        sa.Column('beta_1y', sa.Float(), nullable=True),
    ]:
        if column.name not in existing:
            op.add_column('instruments', column)


def downgrade() -> None:
    pass
