from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Integer, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship
from typing import Optional

from app.db.base import Base


class Holding(Base):
    __tablename__ = 'holdings'

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    portfolio_id: Mapped[int] = mapped_column(ForeignKey('portfolios.id'), nullable=False)
    instrument_id: Mapped[int] = mapped_column(ForeignKey('instruments.id'), nullable=False)
    
    # Quantity breakdown
    quantity: Mapped[float] = mapped_column(Float, nullable=False)
    quantity_available: Mapped[float] = mapped_column(Float, nullable=False)
    quantity_long_term: Mapped[float] = mapped_column(Float, nullable=False)
    quantity_pledged_margin: Mapped[float] = mapped_column(Float, default=0)
    quantity_pledged_loan: Mapped[float] = mapped_column(Float, default=0)
    
    # Pricing
    average_price: Mapped[float] = mapped_column(Float, nullable=False)
    current_price: Mapped[float] = mapped_column(Float, nullable=False)
    previous_closing_price: Mapped[float] = mapped_column(Float, nullable=False)
    
    # P&L
    market_value: Mapped[float] = mapped_column(Float, nullable=False)
    invested_value: Mapped[float] = mapped_column(Float, nullable=False)
    unrealized_pnl: Mapped[float] = mapped_column(Float, nullable=False)
    unrealized_pnl_pct: Mapped[float] = mapped_column(Float, nullable=False)
    
    # Tax planning
    is_long_term: Mapped[bool] = mapped_column(Boolean, default=False)
    
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    portfolio = relationship('Portfolio', back_populates='holdings')
    instrument = relationship('Instrument', back_populates='holdings')
