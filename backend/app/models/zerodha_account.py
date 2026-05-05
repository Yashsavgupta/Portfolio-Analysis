from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class ZerodhaAccount(Base):
    __tablename__ = 'zerodha_accounts'

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey('users.id'), nullable=False)
    zerodha_user_id: Mapped[str] = mapped_column(String(255), nullable=True)
    api_key: Mapped[str] = mapped_column(String(255), nullable=True)
    api_secret: Mapped[str] = mapped_column(String(255), nullable=True)
    access_token: Mapped[str] = mapped_column(String(500), nullable=True)
    status: Mapped[str] = mapped_column(String(50), default='disconnected')
    last_synced_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)

    user = relationship('User', back_populates='zerodha_account')
