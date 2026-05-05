from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class PortfolioSnapshot(Base):
    __tablename__ = 'portfolio_snapshots'

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    portfolio_id: Mapped[int] = mapped_column(ForeignKey('portfolios.id'), nullable=False)
    snapshot_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    total_value: Mapped[float] = mapped_column(Float, nullable=False)
    return_pct: Mapped[float] = mapped_column(Float, nullable=True)
    volatility: Mapped[float] = mapped_column(Float, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    portfolio = relationship('Portfolio', back_populates='snapshots')
