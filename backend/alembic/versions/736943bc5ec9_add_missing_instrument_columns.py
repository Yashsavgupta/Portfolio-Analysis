"""Auto-generated Alembic script."""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


# revision identifiers, used by Alembic.
revision = '736943bc5ec9'
down_revision = '001_initial'
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)

    def existing_columns(table_name: str) -> set[str]:
        return {column['name'] for column in inspector.get_columns(table_name)}

    instruments_columns = existing_columns('instruments')
    for column in [
        sa.Column('sector', sa.String(100), nullable=True),
        sa.Column('current_price', sa.Float(), nullable=True),
        sa.Column('previous_close', sa.Float(), nullable=True),
        sa.Column('high_52w', sa.Float(), nullable=True),
        sa.Column('low_52w', sa.Float(), nullable=True),
        sa.Column('pe_ratio', sa.Float(), nullable=True),
        sa.Column('forward_pe', sa.Float(), nullable=True),
        sa.Column('market_cap', sa.Float(), nullable=True),
        sa.Column('eps_growth', sa.Float(), nullable=True),
        sa.Column('revenue_growth', sa.Float(), nullable=True),
        sa.Column('target_price', sa.Float(), nullable=True),
        sa.Column('promoter_holding', sa.Float(), nullable=True),
        sa.Column('fii_holding', sa.Float(), nullable=True),
        sa.Column('dii_holding', sa.Float(), nullable=True),
        sa.Column('promoter_pledge', sa.Float(), nullable=True),
        sa.Column('is_etf', sa.Boolean(), nullable=True),
        sa.Column('extra_data', sa.String(1024), nullable=True),
    ]:
        if column.name not in instruments_columns:
            op.add_column('instruments', column)

    holdings_columns = existing_columns('holdings')
    for column in [
        sa.Column('quantity_available', sa.Float(), nullable=True),
        sa.Column('quantity_long_term', sa.Float(), nullable=True),
        sa.Column('quantity_pledged_margin', sa.Float(), nullable=True),
        sa.Column('quantity_pledged_loan', sa.Float(), nullable=True),
        sa.Column('previous_closing_price', sa.Float(), nullable=True),
        sa.Column('invested_value', sa.Float(), nullable=True),
        sa.Column('unrealized_pnl', sa.Float(), nullable=True),
        sa.Column('unrealized_pnl_pct', sa.Float(), nullable=True),
        sa.Column('is_long_term', sa.Boolean(), nullable=True),
    ]:
        if column.name not in holdings_columns:
            op.add_column('holdings', column)

    zerodha_columns = existing_columns('zerodha_accounts')
    for column in [
        sa.Column('zerodha_user_id', sa.String(255), nullable=True),
        sa.Column('access_token', sa.String(1024), nullable=True),
    ]:
        if column.name not in zerodha_columns:
            op.add_column('zerodha_accounts', column)

    if 'holdings_imports' not in inspector.get_table_names():
        op.create_table(
            'holdings_imports',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('user_id', sa.Integer(), nullable=False),
            sa.Column('portfolio_id', sa.Integer(), nullable=True),
            sa.Column('filename', sa.String(255), nullable=False),
            sa.Column('file_path', sa.String(1024), nullable=True),
            sa.Column('total_holdings', sa.Integer(), nullable=False, server_default='0'),
            sa.Column('invested_value', sa.Float(), nullable=False, server_default='0'),
            sa.Column('present_value', sa.Float(), nullable=False, server_default='0'),
            sa.Column('unrealized_pnl', sa.Float(), nullable=False, server_default='0'),
            sa.Column('unrealized_pnl_pct', sa.Float(), nullable=False, server_default='0'),
            sa.Column('status', sa.String(50), nullable=False, server_default='pending'),
            sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
            sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
            sa.ForeignKeyConstraint(['user_id'], ['users.id']),
            sa.ForeignKeyConstraint(['portfolio_id'], ['portfolios.id']),
            sa.PrimaryKeyConstraint('id'),
        )
        op.create_index(op.f('ix_holdings_imports_id'), 'holdings_imports', ['id'], unique=False)


def downgrade() -> None:
    pass
