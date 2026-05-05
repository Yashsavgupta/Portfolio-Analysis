from sqlalchemy import Integer, String, Float, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship
from typing import Optional

from app.db.base import Base


class Instrument(Base):
    __tablename__ = 'instruments'

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    symbol: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    asset_type: Mapped[str] = mapped_column(String(50), nullable=False)
    isin: Mapped[str] = mapped_column(String(50), nullable=True)
    sector: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    
    # Market data fields
    current_price: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    previous_close: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    high_52w: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    low_52w: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    
    # Valuation metrics
    pe_ratio: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    forward_pe: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    price_to_book: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    dividend_yield: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    beta_1y: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    market_cap: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    
    # Growth estimates
    eps_growth: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    revenue_growth: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    target_price: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    
    # Promoter & Institutional
    promoter_holding: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    fii_holding: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    dii_holding: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    promoter_pledge: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    
    is_etf: Mapped[bool] = mapped_column(Boolean, default=False)
    extra_data: Mapped[Optional[str]] = mapped_column(String(1024), nullable=True)

    holdings = relationship('Holding', back_populates='instrument')
