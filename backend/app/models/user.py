from datetime import datetime

from sqlalchemy import Boolean, DateTime, Integer, String, event
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class User(Base):
    __tablename__ = 'users'

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(255), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    portfolios = relationship('Portfolio', back_populates='owner')
    zerodha_account = relationship('ZerodhaAccount', back_populates='user', uselist=False)
    mutual_fund_imports = relationship('MutualFundImport', back_populates='user')
    source_credentials = relationship('SourceCredentials', back_populates='user')


@event.listens_for(User, 'before_update')
def update_updated_at(mapper, connection, target):
    target.updated_at = datetime.utcnow()

