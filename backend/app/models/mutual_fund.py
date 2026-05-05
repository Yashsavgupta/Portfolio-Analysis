from datetime import datetime, date
from typing import Optional
from sqlalchemy import DateTime, Date, Float, ForeignKey, Integer, String, Boolean, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class MutualFund(Base):
    """Master data for mutual funds"""
    __tablename__ = 'mutual_funds'

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    isin: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    fund_code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    fund_house: Mapped[str] = mapped_column(String(150), nullable=False, index=True)
    category: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    subcategory: Mapped[str] = mapped_column(String(100), nullable=True)
    fund_type: Mapped[str] = mapped_column(String(50), nullable=True)  # Open-ended, Close-ended
    inception_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)

    # Current NAV & AUM
    current_nav: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    nav_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    aum: Mapped[Optional[float]] = mapped_column(Float, nullable=True)  # in crores
    expense_ratio: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    min_investment: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    # Returns
    return_1w: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    return_1m: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    return_3m: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    return_6m: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    return_1y: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    return_3y: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    return_5y: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    return_10y: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    return_inception: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    # Risk metrics
    std_dev_1y: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    std_dev_3y: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    sharpe_ratio: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    sortino_ratio: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    beta: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    alpha: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    max_drawdown: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    # Ratings & Rankings
    rating: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)  # 1-5 stars
    rank_in_category: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    category_average_return: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    benchmark_name: Mapped[Optional[str]] = mapped_column(String(150), nullable=True)
    benchmark_return: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    # Holdings and allocation (stored as JSON string)
    top_holdings: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # JSON
    portfolio_allocation: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # JSON sector/type

    # Fund manager and contact
    fund_manager: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Metadata
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    last_updated: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    # Relationships
    holdings = relationship('MutualFundHolding', back_populates='mutual_fund')
    nav_history = relationship('MutualFundNAVHistory', back_populates='mutual_fund')


class MutualFundHolding(Base):
    """User's mutual fund holdings"""
    __tablename__ = 'mutual_fund_holdings'

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    portfolio_id: Mapped[int] = mapped_column(ForeignKey('portfolios.id'), nullable=False, index=True)
    mutual_fund_id: Mapped[int] = mapped_column(ForeignKey('mutual_funds.id'), nullable=False, index=True)

    # Holdings data
    units: Mapped[float] = mapped_column(Float, nullable=False)
    cost_basis: Mapped[float] = mapped_column(Float, nullable=False)
    current_value: Mapped[float] = mapped_column(Float, nullable=False)
    purchase_date: Mapped[date] = mapped_column(Date, nullable=False)
    
    # Fund details
    source: Mapped[str] = mapped_column(String(50), nullable=False)  # zerodha, indmoney, manual
    plan_type: Mapped[str] = mapped_column(String(20), nullable=False)  # direct, regular
    nav_at_purchase: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    # Tax data
    is_long_term: Mapped[bool] = mapped_column(Boolean, default=False)
    holding_days: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    gain_loss: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    gain_loss_pct: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    # Status
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    # Relationships
    portfolio = relationship('Portfolio', back_populates='mutual_fund_holdings')
    mutual_fund = relationship('MutualFund', back_populates='holdings')


class MutualFundNAVHistory(Base):
    """Historical NAV data for mutual funds"""
    __tablename__ = 'mf_nav_history'

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    mutual_fund_id: Mapped[int] = mapped_column(ForeignKey('mutual_funds.id'), nullable=False, index=True)
    nav_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    nav_value: Mapped[float] = mapped_column(Float, nullable=False)
    aum: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    units_in_circulation: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    # Relationships
    mutual_fund = relationship('MutualFund', back_populates='nav_history')


class SourceCredentials(Base):
    """Stores credentials/tokens for external source integrations"""
    __tablename__ = 'source_credentials'

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey('users.id'), nullable=False, index=True)
    source: Mapped[str] = mapped_column(String(50), nullable=False, index=True)  # zerodha_coin, indmoney, etc.
    
    # Credentials (should be encrypted in production)
    access_token: Mapped[str] = mapped_column(String(500), nullable=True)
    refresh_token: Mapped[str] = mapped_column(String(500), nullable=True)
    expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    
    # Metadata
    last_sync: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    last_error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    # Relationships
    user = relationship('User', back_populates='source_credentials')
