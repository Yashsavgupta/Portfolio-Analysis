from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

from app.core.config import settings
# Import models to register all relationships before API router is loaded
from app.models import User, Portfolio, Holding, Instrument, ZerodhaAccount, MutualFundImport, PortfolioSnapshot
from app.api.api import api_router

logger.info(f"Database URL: {settings.DATABASE_URL}")
import os
logger.info(f"Current working directory: {os.getcwd()}")
logger.info("Portfolio Evaluator API started")

app = FastAPI(title='Portfolio Evaluator API', version='1.0.0')

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002', 'http://localhost:3003', 'http://127.0.0.1:3000', 'http://127.0.0.1:3001', 'http://127.0.0.1:3002', 'http://127.0.0.1:3003'],
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)

app.include_router(api_router, prefix=settings.API_PREFIX)

logger.info("Portfolio Evaluator API started")


@app.get('/health')
def health_check():
    return {'status': 'ok'}
