from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class MutualFundImport(Base):
    __tablename__ = 'mutual_fund_imports'

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey('users.id'), nullable=False)
    source: Mapped[str] = mapped_column(String(100), nullable=False)
    status: Mapped[str] = mapped_column(String(50), default='pending')
    imported_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    raw_payload: Mapped[str] = mapped_column(Text, nullable=True)

    user = relationship('User', back_populates='mutual_fund_imports')
