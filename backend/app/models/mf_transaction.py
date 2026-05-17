"""MutualFundTransaction model — stores per-transaction CAS import data."""
from datetime import datetime, date

from sqlalchemy import Column, Integer, String, Float, Date, DateTime, ForeignKey, Index
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.base import Base


class MutualFundTransaction(Base):
    __tablename__ = 'mf_transactions'

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False, index=True)

    folio = Column(String(100), nullable=True)           # e.g. "12345678/00"
    fund_name = Column(String(500), nullable=False)      # free text from import
    isin = Column(String(20), nullable=True)

    transaction_date = Column(Date, nullable=False)
    transaction_type = Column(String(30), nullable=False)  # canonical type
    amount = Column(Float, nullable=False)                  # always positive INR
    units = Column(Float, nullable=False)
    nav = Column(Float, nullable=True)

    source = Column(String(50), nullable=False)            # 'cas_cams' | 'cas_kfintech' | 'kuvera' | 'groww' | 'generic'
    raw_type = Column(String(100), nullable=True)          # original type string from file

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Relationship back to user (no backref needed)
    user = relationship('User', foreign_keys=[user_id])

    __table_args__ = (
        Index('ix_mf_transactions_user_id', 'user_id'),
        Index('ix_mf_transactions_transaction_date', 'transaction_date'),
        Index('ix_mf_transactions_fund_name', 'fund_name'),
    )
