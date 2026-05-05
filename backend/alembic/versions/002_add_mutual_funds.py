"""Add mutual fund tables.

Revision ID: 002_add_mutual_funds
Revises: fa825a578331
Create Date: 2026-05-05 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '002_add_mutual_funds'
down_revision = 'fa825a578331'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create mutual_funds table
    op.create_table(
        'mutual_funds',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('isin', sa.String(50), nullable=False),
        sa.Column('fund_code', sa.String(50), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('fund_house', sa.String(150), nullable=False),
        sa.Column('category', sa.String(100), nullable=False),
        sa.Column('subcategory', sa.String(100), nullable=True),
        sa.Column('fund_type', sa.String(50), nullable=True),
        sa.Column('inception_date', sa.Date(), nullable=True),
        sa.Column('current_nav', sa.Float(), nullable=True),
        sa.Column('nav_date', sa.Date(), nullable=True),
        sa.Column('aum', sa.Float(), nullable=True),
        sa.Column('expense_ratio', sa.Float(), nullable=True),
        sa.Column('min_investment', sa.Float(), nullable=True),
        sa.Column('return_1w', sa.Float(), nullable=True),
        sa.Column('return_1m', sa.Float(), nullable=True),
        sa.Column('return_3m', sa.Float(), nullable=True),
        sa.Column('return_6m', sa.Float(), nullable=True),
        sa.Column('return_1y', sa.Float(), nullable=True),
        sa.Column('return_3y', sa.Float(), nullable=True),
        sa.Column('return_5y', sa.Float(), nullable=True),
        sa.Column('return_10y', sa.Float(), nullable=True),
        sa.Column('return_inception', sa.Float(), nullable=True),
        sa.Column('std_dev_1y', sa.Float(), nullable=True),
        sa.Column('std_dev_3y', sa.Float(), nullable=True),
        sa.Column('sharpe_ratio', sa.Float(), nullable=True),
        sa.Column('sortino_ratio', sa.Float(), nullable=True),
        sa.Column('beta', sa.Float(), nullable=True),
        sa.Column('alpha', sa.Float(), nullable=True),
        sa.Column('max_drawdown', sa.Float(), nullable=True),
        sa.Column('rating', sa.Integer(), nullable=True),
        sa.Column('rank_in_category', sa.Integer(), nullable=True),
        sa.Column('category_average_return', sa.Float(), nullable=True),
        sa.Column('benchmark_name', sa.String(150), nullable=True),
        sa.Column('benchmark_return', sa.Float(), nullable=True),
        sa.Column('top_holdings', sa.Text(), nullable=True),
        sa.Column('portfolio_allocation', sa.Text(), nullable=True),
        sa.Column('fund_manager', sa.String(255), nullable=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('last_updated', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('isin'),
        sa.UniqueConstraint('fund_code'),
    )
    op.create_index(op.f('ix_mutual_funds_id'), 'mutual_funds', ['id'], unique=False)
    op.create_index(op.f('ix_mutual_funds_isin'), 'mutual_funds', ['isin'], unique=True)
    op.create_index(op.f('ix_mutual_funds_fund_code'), 'mutual_funds', ['fund_code'], unique=True)
    op.create_index(op.f('ix_mutual_funds_fund_house'), 'mutual_funds', ['fund_house'], unique=False)
    op.create_index(op.f('ix_mutual_funds_category'), 'mutual_funds', ['category'], unique=False)
    op.create_index(op.f('ix_mutual_funds_is_active'), 'mutual_funds', ['is_active'], unique=False)

    # Create mutual_fund_holdings table
    op.create_table(
        'mutual_fund_holdings',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('portfolio_id', sa.Integer(), nullable=False),
        sa.Column('mutual_fund_id', sa.Integer(), nullable=False),
        sa.Column('units', sa.Float(), nullable=False),
        sa.Column('cost_basis', sa.Float(), nullable=False),
        sa.Column('current_value', sa.Float(), nullable=False),
        sa.Column('purchase_date', sa.Date(), nullable=False),
        sa.Column('source', sa.String(50), nullable=False),
        sa.Column('plan_type', sa.String(20), nullable=False),
        sa.Column('nav_at_purchase', sa.Float(), nullable=True),
        sa.Column('is_long_term', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('holding_days', sa.Integer(), nullable=True),
        sa.Column('gain_loss', sa.Float(), nullable=True),
        sa.Column('gain_loss_pct', sa.Float(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['portfolio_id'], ['portfolios.id'], ),
        sa.ForeignKeyConstraint(['mutual_fund_id'], ['mutual_funds.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_mutual_fund_holdings_id'), 'mutual_fund_holdings', ['id'], unique=False)
    op.create_index(op.f('ix_mutual_fund_holdings_portfolio_id'), 'mutual_fund_holdings', ['portfolio_id'], unique=False)
    op.create_index(op.f('ix_mutual_fund_holdings_mutual_fund_id'), 'mutual_fund_holdings', ['mutual_fund_id'], unique=False)

    # Create mf_nav_history table
    op.create_table(
        'mf_nav_history',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('mutual_fund_id', sa.Integer(), nullable=False),
        sa.Column('nav_date', sa.Date(), nullable=False),
        sa.Column('nav_value', sa.Float(), nullable=False),
        sa.Column('aum', sa.Float(), nullable=True),
        sa.Column('units_in_circulation', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['mutual_fund_id'], ['mutual_funds.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_mf_nav_history_id'), 'mf_nav_history', ['id'], unique=False)
    op.create_index(op.f('ix_mf_nav_history_mutual_fund_id'), 'mf_nav_history', ['mutual_fund_id'], unique=False)
    op.create_index(op.f('ix_mf_nav_history_nav_date'), 'mf_nav_history', ['nav_date'], unique=False)

    # Create source_credentials table
    op.create_table(
        'source_credentials',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('source', sa.String(50), nullable=False),
        sa.Column('access_token', sa.String(500), nullable=True),
        sa.Column('refresh_token', sa.String(500), nullable=True),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('last_sync', sa.DateTime(timezone=True), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('last_error', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_source_credentials_id'), 'source_credentials', ['id'], unique=False)
    op.create_index(op.f('ix_source_credentials_user_id'), 'source_credentials', ['user_id'], unique=False)
    op.create_index(op.f('ix_source_credentials_source'), 'source_credentials', ['source'], unique=False)


def downgrade() -> None:
    # Drop indices
    op.drop_index(op.f('ix_source_credentials_source'), table_name='source_credentials')
    op.drop_index(op.f('ix_source_credentials_user_id'), table_name='source_credentials')
    op.drop_index(op.f('ix_source_credentials_id'), table_name='source_credentials')
    op.drop_table('source_credentials')

    op.drop_index(op.f('ix_mf_nav_history_nav_date'), table_name='mf_nav_history')
    op.drop_index(op.f('ix_mf_nav_history_mutual_fund_id'), table_name='mf_nav_history')
    op.drop_index(op.f('ix_mf_nav_history_id'), table_name='mf_nav_history')
    op.drop_table('mf_nav_history')

    op.drop_index(op.f('ix_mutual_fund_holdings_mutual_fund_id'), table_name='mutual_fund_holdings')
    op.drop_index(op.f('ix_mutual_fund_holdings_portfolio_id'), table_name='mutual_fund_holdings')
    op.drop_index(op.f('ix_mutual_fund_holdings_id'), table_name='mutual_fund_holdings')
    op.drop_table('mutual_fund_holdings')

    op.drop_index(op.f('ix_mutual_funds_is_active'), table_name='mutual_funds')
    op.drop_index(op.f('ix_mutual_funds_category'), table_name='mutual_funds')
    op.drop_index(op.f('ix_mutual_funds_fund_house'), table_name='mutual_funds')
    op.drop_index(op.f('ix_mutual_funds_fund_code'), table_name='mutual_funds')
    op.drop_index(op.f('ix_mutual_funds_isin'), table_name='mutual_funds')
    op.drop_index(op.f('ix_mutual_funds_id'), table_name='mutual_funds')
    op.drop_table('mutual_funds')
