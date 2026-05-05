from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, Integer, String, Float, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class HoldingsImport(Base):
    """Track Excel file uploads and import metadata"""
    __tablename__ = 'holdings_imports'

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey('users.id'), nullable=False)
    portfolio_id: Mapped[Optional[int]] = mapped_column(ForeignKey('portfolios.id'), nullable=True)
    
    # File details
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    file_path: Mapped[str] = mapped_column(String(512), nullable=False)
    
    # Import summary
    total_holdings: Mapped[int] = mapped_column(Integer, default=0)
    invested_value: Mapped[float] = mapped_column(Float, default=0)
    present_value: Mapped[float] = mapped_column(Float, default=0)
    unrealized_pnl: Mapped[float] = mapped_column(Float, default=0)
    unrealized_pnl_pct: Mapped[float] = mapped_column(Float, default=0)
    
    # Import status
    status: Mapped[str] = mapped_column(String(50), default='pending')  # pending, completed, failed
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    # Timestamps
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    user = relationship('User')
    portfolio = relationship('Portfolio')
