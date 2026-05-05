from fastapi import APIRouter

from app.api.routes import auth, portfolios, holdings, analytics, zerodha, mutual_funds, import_holdings, market_data

api_router = APIRouter()
api_router.include_router(auth.router, prefix='/auth', tags=['auth'])
api_router.include_router(portfolios.router, prefix='/portfolios', tags=['portfolios'])
api_router.include_router(holdings.router, prefix='/holdings', tags=['holdings'])
api_router.include_router(analytics.router, prefix='/analytics', tags=['analytics'])
api_router.include_router(zerodha.router, prefix='/zerodha', tags=['zerodha'])
api_router.include_router(mutual_funds.router, prefix='/mutual-funds', tags=['mutual_funds'])
api_router.include_router(import_holdings.router, prefix='/import', tags=['import'])
api_router.include_router(market_data.router, prefix='/market-data', tags=['market_data'])
