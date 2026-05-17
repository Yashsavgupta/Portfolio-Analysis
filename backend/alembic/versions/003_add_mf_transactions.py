"""Add mf_transactions table.

Revision ID: 003_add_mf_transactions
Revises: 002_add_mutual_funds
Create Date: 2026-05-17 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '003_add_mf_transactions'
down_revision = '002_add_mutual_funds'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'mf_transactions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('folio', sa.String(100), nullable=True),
        sa.Column('fund_name', sa.String(500), nullable=False),
        sa.Column('isin', sa.String(20), nullable=True),
        sa.Column('transaction_date', sa.Date(), nullable=False),
        sa.Column('transaction_type', sa.String(30), nullable=False),
        sa.Column('amount', sa.Float(), nullable=False),
        sa.Column('units', sa.Float(), nullable=False),
        sa.Column('nav', sa.Float(), nullable=True),
        sa.Column('source', sa.String(50), nullable=False),
        sa.Column('raw_type', sa.String(100), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_mf_transactions_id', 'mf_transactions', ['id'], unique=False)
    op.create_index('ix_mf_transactions_user_id', 'mf_transactions', ['user_id'], unique=False)
    op.create_index('ix_mf_transactions_transaction_date', 'mf_transactions', ['transaction_date'], unique=False)
    op.create_index('ix_mf_transactions_fund_name', 'mf_transactions', ['fund_name'], unique=False)


def downgrade() -> None:
    op.drop_index('ix_mf_transactions_fund_name', table_name='mf_transactions')
    op.drop_index('ix_mf_transactions_transaction_date', table_name='mf_transactions')
    op.drop_index('ix_mf_transactions_user_id', table_name='mf_transactions')
    op.drop_index('ix_mf_transactions_id', table_name='mf_transactions')
    op.drop_table('mf_transactions')
