from datetime import date, datetime
from sqlalchemy import Integer, String, Float, Date, DateTime, ForeignKey, Index
from sqlalchemy.orm import Mapped, mapped_column
from app.db.base import Base


class StockTrade(Base):
    __tablename__ = 'stock_trades'

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey('users.id'), nullable=False, index=True)

    symbol: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    isin: Mapped[str] = mapped_column(String(20), nullable=True)
    trade_date: Mapped[date] = mapped_column(Date, nullable=False)
    exchange: Mapped[str] = mapped_column(String(10), nullable=True)
    segment: Mapped[str] = mapped_column(String(10), nullable=True)
    series: Mapped[str] = mapped_column(String(10), nullable=True)
    trade_type: Mapped[str] = mapped_column(String(10), nullable=False)  # 'buy' or 'sell'
    quantity: Mapped[float] = mapped_column(Float, nullable=False)
    price: Mapped[float] = mapped_column(Float, nullable=False)
    trade_value: Mapped[float] = mapped_column(Float, nullable=False)
    trade_id: Mapped[str] = mapped_column(String(60), nullable=True)
    order_id: Mapped[str] = mapped_column(String(60), nullable=True)
    order_execution_time: Mapped[str] = mapped_column(String(40), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        Index('ix_stock_trades_user_symbol', 'user_id', 'symbol'),
    )
