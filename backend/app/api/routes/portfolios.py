from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.schemas.portfolio import PortfolioRead
from app.services.portfolio_dashboard_service import build_portfolio_dashboard

router = APIRouter()


@router.get('/', response_model=list[PortfolioRead])
def list_portfolios():
    return [
        {'id': 1, 'name': 'Total Portfolio', 'type': 'total', 'description': 'Combined stock and mutual fund view.'},
        {'id': 2, 'name': 'Stock Portfolio', 'type': 'stock', 'description': 'Your stock holdings.'},
    ]


@router.get('/dashboard')
def get_portfolio_dashboard(
    portfolio_id: Optional[int] = None,
    indices: List[str] = Query(["^NSEI"], description="List of benchmark indices to compare against (e.g., ^NSEI, ^GSPC)"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        return build_portfolio_dashboard(current_user.id, db, portfolio_id, indices)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
