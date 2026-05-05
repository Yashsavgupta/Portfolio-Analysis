from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.services.zerodha_service import get_zerodha_holdings
from app.db.session import get_db
from app.core.security import get_current_user
from app.models.user import User

router = APIRouter()

# Sample holdings for testing when no Zerodha account is connected
SAMPLE_HOLDINGS = {
    "holdings": [
        {
            "tradingsymbol": "INFY",
            "instrument_token": 408065,
            "exchange": "NSE",
            "quantity": 10,
            "last_price": 1850.50,
            "pnl": 5500,
            "product": "MIS"
        },
        {
            "tradingsymbol": "TCS",
            "instrument_token": 408514,
            "exchange": "NSE",
            "quantity": 5,
            "last_price": 3600.00,
            "pnl": 3000,
            "product": "MIS"
        },
        {
            "tradingsymbol": "RELIANCE",
            "instrument_token": 738561,
            "exchange": "NSE",
            "quantity": 2,
            "last_price": 2850.75,
            "pnl": -500,
            "product": "MIS"
        },
        {
            "tradingsymbol": "HDFC",
            "instrument_token": 340481,
            "exchange": "NSE",
            "quantity": 8,
            "last_price": 1700.25,
            "pnl": 8500,
            "product": "MIS"
        }
    ],
    "count": 4
}


@router.get('/')
def list_holdings(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get user holdings from Zerodha or return sample data for testing"""
    result = get_zerodha_holdings(current_user.id, db)
    if 'error' in result:
        # Return sample data for testing when Zerodha is not connected
        return SAMPLE_HOLDINGS
    return result
