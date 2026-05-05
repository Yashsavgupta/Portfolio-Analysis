from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.portfolio import Portfolio
from app.models.instrument import Instrument
from app.models.holding import Holding
from app.models.holdings_import import HoldingsImport
from app.services.excel_parser import ZerodhaExcelParser
from app.services.analytics_service import PortfolioAnalyticsService
from typing import Optional
import os
import tempfile
import logging

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post('/upload-holdings')
async def upload_holdings(
    file: UploadFile = File(...),
    portfolio_name: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Upload and parse Zerodha holdings Excel file"""
    tmp_path = None
    filename = file.filename or ''

    if not filename.lower().endswith('.xlsx'):
        raise HTTPException(status_code=400, detail='Only .xlsx files are supported')
    
    try:
        # Save file temporarily
        with tempfile.NamedTemporaryFile(delete=False, suffix='.xlsx') as tmp_file:
            content = await file.read()
            tmp_file.write(content)
            tmp_path = tmp_file.name
        
        # Parse the Excel file
        parser = ZerodhaExcelParser(tmp_path)
        summary, holdings_list = parser.parse()

        if not holdings_list:
            raise HTTPException(status_code=400, detail='No holdings were found in the uploaded file')
        
        # Create or get portfolio
        if not portfolio_name:
            portfolio_name = f"Import {len(db.query(Portfolio).filter(Portfolio.user_id == current_user.id).all()) + 1}"
        
        portfolio = Portfolio(
            user_id=current_user.id,
            name=portfolio_name,
            type='imported',
            description=f'Imported from {filename}',
        )
        db.add(portfolio)
        db.flush()
        
        # Process each holding
        created_holdings = 0
        for holding_data in holdings_list:
            symbol = holding_data.get('symbol')
            if not symbol:
                continue
            
            # Create or get instrument
            instrument = db.query(Instrument).filter(Instrument.symbol == symbol).first()
            if not instrument:
                is_etf = holding_data.get('sector', '').upper() == 'ETF'
                instrument = Instrument(
                    symbol=symbol,
                    name=symbol,  # Can be updated with API data
                    asset_type='ETF' if is_etf else 'Stock',
                    isin=holding_data.get('isin'),
                    sector=holding_data.get('sector'),
                    is_etf=is_etf,
                )
                db.add(instrument)
                db.flush()
            
            # Create holding
            holding = Holding(
                portfolio_id=portfolio.id,
                instrument_id=instrument.id,
                quantity=holding_data.get('quantity', 0),
                quantity_available=holding_data.get('quantity_available', 0),
                quantity_long_term=holding_data.get('quantity_long_term', 0),
                quantity_pledged_margin=holding_data.get('quantity_pledged_margin', 0),
                quantity_pledged_loan=holding_data.get('quantity_pledged_loan', 0),
                average_price=holding_data.get('average_price', 0),
                current_price=holding_data.get('previous_closing_price', 0),
                previous_closing_price=holding_data.get('previous_closing_price', 0),
                market_value=holding_data.get('market_value', 0),
                invested_value=holding_data.get('invested_value', 0),
                unrealized_pnl=holding_data.get('unrealized_pnl', 0),
                unrealized_pnl_pct=holding_data.get('unrealized_pnl_pct', 0),
            )
            db.add(holding)
            created_holdings += 1
        
        db.commit()
        
        # Create import record
        import_record = HoldingsImport(
            user_id=current_user.id,
            portfolio_id=portfolio.id,
            filename=filename,
            file_path=filename,
            total_holdings=created_holdings,
            invested_value=summary.get('invested_value', 0),
            present_value=summary.get('present_value', 0),
            unrealized_pnl=summary.get('unrealized_pnl', 0),
            unrealized_pnl_pct=summary.get('unrealized_pnl_pct', 0),
            status='completed',
        )
        db.add(import_record)
        db.commit()
        
        return {
            'message': 'Holdings uploaded successfully',
            'portfolio_id': portfolio.id,
            'portfolio_name': portfolio.name,
            'total_holdings': created_holdings,
            'invested_value': summary.get('invested_value', 0),
            'present_value': summary.get('present_value', 0),
            'unrealized_pnl': summary.get('unrealized_pnl', 0),
            'unrealized_pnl_pct': summary.get('unrealized_pnl_pct', 0),
        }
    
    except Exception as e:
        db.rollback()
        logger.error(f"Error uploading holdings: {str(e)}")
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=400, detail=f'Error processing file: {str(e)}')
    
    finally:
        # Clean up temp file
        if tmp_path and os.path.exists(tmp_path):
            try:
                os.remove(tmp_path)
            except:
                pass


@router.get('/analytics/overview/{portfolio_id}')
def get_overview(
    portfolio_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get portfolio overview analytics"""
    portfolio = db.query(Portfolio).filter(
        Portfolio.id == portfolio_id,
        Portfolio.user_id == current_user.id
    ).first()
    
    if not portfolio:
        raise HTTPException(status_code=404, detail='Portfolio not found')
    
    holdings = db.query(Holding).filter(Holding.portfolio_id == portfolio_id).all()
    
    analytics = PortfolioAnalyticsService(holdings)
    return analytics.get_portfolio_overview()


@router.get('/analytics/sectors/{portfolio_id}')
def get_sectors(
    portfolio_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get sector segmentation analytics"""
    portfolio = db.query(Portfolio).filter(
        Portfolio.id == portfolio_id,
        Portfolio.user_id == current_user.id
    ).first()
    
    if not portfolio:
        raise HTTPException(status_code=404, detail='Portfolio not found')
    
    holdings = db.query(Holding).filter(Holding.portfolio_id == portfolio_id).all()
    
    analytics = PortfolioAnalyticsService(holdings)
    return analytics.get_sector_segmentation()


@router.get('/analytics/valuation/{portfolio_id}')
def get_valuation(
    portfolio_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get valuation metrics"""
    portfolio = db.query(Portfolio).filter(
        Portfolio.id == portfolio_id,
        Portfolio.user_id == current_user.id
    ).first()
    
    if not portfolio:
        raise HTTPException(status_code=404, detail='Portfolio not found')
    
    holdings = db.query(Holding).filter(Holding.portfolio_id == portfolio_id).all()
    
    analytics = PortfolioAnalyticsService(holdings)
    return analytics.get_valuation_metrics()


@router.get('/analytics/growth/{portfolio_id}')
def get_growth(
    portfolio_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get growth forecast analytics"""
    portfolio = db.query(Portfolio).filter(
        Portfolio.id == portfolio_id,
        Portfolio.user_id == current_user.id
    ).first()
    
    if not portfolio:
        raise HTTPException(status_code=404, detail='Portfolio not found')
    
    holdings = db.query(Holding).filter(Holding.portfolio_id == portfolio_id).all()
    
    analytics = PortfolioAnalyticsService(holdings)
    return analytics.get_growth_forecast()


@router.get('/analytics/promoter/{portfolio_id}')
def get_promoter(
    portfolio_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get promoter and institutional holdings"""
    portfolio = db.query(Portfolio).filter(
        Portfolio.id == portfolio_id,
        Portfolio.user_id == current_user.id
    ).first()
    
    if not portfolio:
        raise HTTPException(status_code=404, detail='Portfolio not found')
    
    holdings = db.query(Holding).filter(Holding.portfolio_id == portfolio_id).all()
    
    analytics = PortfolioAnalyticsService(holdings)
    return analytics.get_promoter_institutional()


@router.get('/analytics/risk/{portfolio_id}')
def get_risk(
    portfolio_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get risk and health metrics"""
    portfolio = db.query(Portfolio).filter(
        Portfolio.id == portfolio_id,
        Portfolio.user_id == current_user.id
    ).first()
    
    if not portfolio:
        raise HTTPException(status_code=404, detail='Portfolio not found')
    
    holdings = db.query(Holding).filter(Holding.portfolio_id == portfolio_id).all()
    
    analytics = PortfolioAnalyticsService(holdings)
    return analytics.get_risk_health()


@router.get('/analytics/tax/{portfolio_id}')
def get_tax(
    portfolio_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get tax snapshot analytics"""
    portfolio = db.query(Portfolio).filter(
        Portfolio.id == portfolio_id,
        Portfolio.user_id == current_user.id
    ).first()
    
    if not portfolio:
        raise HTTPException(status_code=404, detail='Portfolio not found')
    
    holdings = db.query(Holding).filter(Holding.portfolio_id == portfolio_id).all()
    
    analytics = PortfolioAnalyticsService(holdings)
    return analytics.get_tax_snapshot()
