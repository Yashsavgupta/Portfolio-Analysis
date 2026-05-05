from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.security import get_current_user
from app.db.session import get_db
from app.models.instrument import Instrument
from app.models.user import User
from app.services.market_data_service import (
    fetch_market_data,
    refresh_portfolio_market_data,
    update_instrument_market_data,
)

router = APIRouter()


@router.get("/symbol/{symbol}")
def get_symbol_market_data(
    symbol: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    result = fetch_market_data(symbol)
    if not result.found:
        raise HTTPException(status_code=404, detail=result.message)

    instrument = db.query(Instrument).filter(Instrument.symbol == result.symbol).first()
    if instrument:
        update_instrument_market_data(instrument, result.data, db)
        db.commit()

    return {
        "symbol": result.symbol,
        "ticker": result.resolved_ticker,
        "message": result.message,
        "data": result.data,
    }


@router.post("/refresh/{portfolio_id}")
def refresh_portfolio_data(
    portfolio_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        return refresh_portfolio_market_data(portfolio_id, current_user.id, db)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
