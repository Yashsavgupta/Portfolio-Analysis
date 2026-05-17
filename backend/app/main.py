from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

from app.core.config import settings
# Import models to register all relationships before API router is loaded
from app.models import User, Portfolio, Holding, Instrument, ZerodhaAccount, MutualFundImport, PortfolioSnapshot, StockTrade
from app.db.init_db import init_db
from app.api.api import api_router

logger.info(f"Database URL: {settings.DATABASE_URL}")
import os
logger.info(f"Current working directory: {os.getcwd()}")
logger.info("Portfolio Evaluator API started")

app = FastAPI(title='Portfolio Evaluator API', version='1.0.0')

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)

app.include_router(api_router, prefix=settings.API_PREFIX)

# Create any missing tables (safe to call repeatedly; skips existing tables)
init_db()

logger.info("Portfolio Evaluator API started")


@app.get('/health')
def health_check():
    return {'status': 'ok'}
