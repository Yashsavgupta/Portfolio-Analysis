from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.portfolio import Portfolio
from app.models.instrument import Instrument
from app.models.holding import Holding
from app.models.holdings_import import HoldingsImport
from app.models.stock_trade import StockTrade
from app.services.excel_parser import ZerodhaExcelParser
from app.services.analytics_service import PortfolioAnalyticsService
from app.services.universal_parser import parse_holdings, parse_tradebook, detect_file_type, CanonicalHolding, CanonicalTrade, _float, _parse_date
from app.services.tradebook_service import merge_trades, _canonical_to_model
from app.models.mutual_fund import MutualFund, MutualFundHolding
from typing import Optional
from datetime import date as date_type
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


@router.post('/universal')
async def universal_import(
    file: UploadFile = File(...),
    portfolio_name: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Universal import endpoint. Auto-detects broker and file type (holdings or tradebook).
    Handles mixed files (stocks + mutual funds in one CSV).
    For tradebooks: merges with existing history (no overwrite).
    """
    content_bytes = await file.read()
    filename = file.filename or ''

    # Reject binary Excel files — magic bytes PK (xlsx/zip) or D0 CF (xls/OLE)
    if content_bytes[:2] in (b'PK', b'\xd0\xcf'):
        raise HTTPException(
            status_code=400,
            detail='Excel files are not supported directly. Please export your data as CSV from your broker and upload that instead.',
        )

    try:
        content = content_bytes.decode('utf-8-sig')
    except UnicodeDecodeError:
        content = content_bytes.decode('latin-1')

    try:
        file_type = detect_file_type(content)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f'Could not parse file: {e}. Please ensure you are uploading a valid CSV.')

    # ── Tradebook path ────────────────────────────────────────────────────────
    if file_type == 'tradebook':
        try:
            result = parse_tradebook(content)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f'Could not parse tradebook: {e}. Please ensure you exported as CSV.')
        if result.error:
            raise HTTPException(status_code=400, detail=f'Parse error: {result.error}')
        if result.unrecognised:
            return {
                'status': 'unrecognised',
                'file_type': 'tradebook',
                'raw_headers': result.raw_headers,
                'message': 'Broker format not recognised. Please use the manual column mapper.',
            }

        trades_to_save: list[StockTrade] = []
        for item in result.stocks + result.mutual_funds:
            if isinstance(item, CanonicalTrade):
                trades_to_save.append(_canonical_to_model(item, current_user.id))

        if not trades_to_save:
            raise HTTPException(status_code=400, detail='No valid trades found in file.')

        stats = merge_trades(trades_to_save, current_user.id, db)
        return {
            'status': 'ok',
            'file_type': 'tradebook',
            'broker': result.broker,
            'stocks_in_file': len(result.stocks),
            'mutual_funds_in_file': len(result.mutual_funds),
            **stats,
        }

    # ── Holdings path ─────────────────────────────────────────────────────────
    try:
        result = parse_holdings(content)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f'Could not parse holdings: {e}. Please ensure you exported as CSV.')
    if result.error:
        raise HTTPException(status_code=400, detail=f'Parse error: {result.error}')
    if result.unrecognised:
        return {
            'status': 'unrecognised',
            'file_type': 'holdings',
            'raw_headers': result.raw_headers,
            'message': 'Broker format not recognised. Please use the manual column mapper.',
        }

    if not result.stocks and not result.mutual_funds:
        raise HTTPException(status_code=400, detail='No valid holdings found in file.')

    # ── Stock holdings ────────────────────────────────────────────────────────
    stock_portfolio = None
    created = 0
    if result.stocks:
        pname = portfolio_name or f'Import from {result.broker.title()} ({filename})'
        stock_portfolio = Portfolio(
            user_id=current_user.id,
            name=pname,
            type='imported',
            description=f'Imported from {filename} (broker: {result.broker})',
        )
        db.add(stock_portfolio)
        db.flush()

        for item in result.stocks:
            if not isinstance(item, CanonicalHolding):
                continue
            instrument = db.query(Instrument).filter(Instrument.symbol == item.symbol).first()
            if not instrument:
                instrument = Instrument(
                    symbol=item.symbol,
                    name=item.name,
                    asset_type='Stock',
                    isin=item.isin,
                )
                db.add(instrument)
                db.flush()
            holding = Holding(
                portfolio_id=stock_portfolio.id,
                instrument_id=instrument.id,
                quantity=item.quantity,
                quantity_available=item.quantity,
                average_price=item.avg_cost,
                current_price=item.current_price or item.avg_cost,
                market_value=item.current_value or round(item.quantity * item.avg_cost, 2),
                invested_value=round(item.quantity * item.avg_cost, 2),
            )
            db.add(holding)
            created += 1

    # ── Mutual fund holdings ──────────────────────────────────────────────────
    mf_portfolio = None
    mf_created = 0
    if result.mutual_funds:
        mf_pname = portfolio_name or f'MF Import from {result.broker.title()} ({filename})'
        mf_portfolio = Portfolio(
            user_id=current_user.id,
            name=mf_pname,
            type='mutual_funds',
            description=f'Mutual fund holdings imported from {filename} (broker: {result.broker})',
        )
        db.add(mf_portfolio)
        db.flush()

        today = date_type.today()
        for item in result.mutual_funds:
            if not isinstance(item, CanonicalHolding):
                continue

            # Find or create MutualFund master record (keyed by ISIN)
            mf_master = None
            if item.isin:
                mf_master = db.query(MutualFund).filter(MutualFund.isin == item.isin).first()
            if not mf_master:
                fund_code = item.isin or item.symbol
                mf_master = db.query(MutualFund).filter(MutualFund.fund_code == fund_code).first()
                if not mf_master:
                    raw_lower = {k.strip().lower(): v for k, v in item.raw.items()}
                    fund_house = raw_lower.get('fund house', raw_lower.get('amc', 'Unknown')) or 'Unknown'
                    mf_master = MutualFund(
                        isin=item.isin or fund_code,
                        fund_code=fund_code,
                        name=item.name,
                        fund_house=fund_house,
                        category='Unknown',
                    )
                    db.add(mf_master)
                    db.flush()

            # Derive financials from raw row (generic_mf_holdings has invested_value column)
            raw_lower = {k.strip().lower(): v for k, v in item.raw.items()}
            invested_raw = raw_lower.get('invested value') or raw_lower.get('cost value') or raw_lower.get('invested_value')
            cost_basis = _float(invested_raw) if invested_raw else round(item.quantity * (item.avg_cost or 0), 2)
            current_val = item.current_value or round(item.quantity * (item.current_price or item.avg_cost or 0), 2)

            # Purchase date
            purchase_date_raw = raw_lower.get('purchase date') or raw_lower.get('purchase_date') or ''
            purchase_date = _parse_date(purchase_date_raw) if purchase_date_raw else today

            # Plan type (Direct / Regular)
            plan_raw = (raw_lower.get('plan') or '').lower()
            plan_type = 'direct' if 'direct' in plan_raw else 'regular'

            # Gain/loss & holding period
            gain_loss = current_val - cost_basis
            gain_loss_pct = round(gain_loss / cost_basis * 100, 2) if cost_basis > 0 else 0.0
            holding_days = (today - purchase_date).days if purchase_date else 0

            mf_holding = MutualFundHolding(
                portfolio_id=mf_portfolio.id,
                mutual_fund_id=mf_master.id,
                units=item.quantity,
                cost_basis=cost_basis,
                current_value=current_val,
                purchase_date=purchase_date or today,
                source=result.broker,
                plan_type=plan_type,
                nav_at_purchase=item.avg_cost or None,
                is_long_term=holding_days > 365,
                holding_days=holding_days,
                gain_loss=round(gain_loss, 2),
                gain_loss_pct=gain_loss_pct,
            )
            db.add(mf_holding)
            mf_created += 1

    db.commit()

    return {
        'status': 'ok',
        'file_type': 'holdings',
        'broker': result.broker,
        'portfolio_id': stock_portfolio.id if stock_portfolio else None,
        'portfolio_name': stock_portfolio.name if stock_portfolio else None,
        'stocks_imported': created,
        'mf_portfolio_id': mf_portfolio.id if mf_portfolio else None,
        'mf_portfolio_name': mf_portfolio.name if mf_portfolio else None,
        'mf_funds_imported': mf_created,
        'mutual_funds_in_file': len(result.mutual_funds),
    }


@router.post('/preview')
async def preview_import(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    """
    Parse file and return a preview (first 10 rows) without saving anything.
    Also returns broker name, detected file type, and stock/MF split.
    """
    content_bytes = await file.read()

    if content_bytes[:2] in (b'PK', b'\xd0\xcf'):
        raise HTTPException(
            status_code=400,
            detail='Excel files are not supported directly. Please export your data as CSV from your broker and upload that instead.',
        )

    try:
        content = content_bytes.decode('utf-8-sig')
    except UnicodeDecodeError:
        content = content_bytes.decode('latin-1')

    try:
        file_type = detect_file_type(content)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f'Could not parse file: {e}. Please ensure you are uploading a valid CSV.')

    if file_type == 'tradebook':
        try:
            result = parse_tradebook(content)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f'Could not parse tradebook: {e}. Please ensure you exported as CSV.')
        preview_items = []
        for item in (result.stocks + result.mutual_funds)[:10]:
            if isinstance(item, CanonicalTrade):
                preview_items.append({
                    'symbol': item.symbol,
                    'name': item.name,
                    'isin': item.isin,
                    'trade_date': item.trade_date.isoformat(),
                    'trade_type': item.trade_type,
                    'quantity': item.quantity,
                    'price': item.price,
                    'instrument_type': item.instrument_type,
                })
        all_dates = [item.trade_date for item in result.stocks + result.mutual_funds
                     if isinstance(item, CanonicalTrade)]
        return {
            'file_type': 'tradebook',
            'broker': result.broker,
            'unrecognised': result.unrecognised,
            'raw_headers': result.raw_headers if result.unrecognised else [],
            'stocks_count': len(result.stocks),
            'mutual_funds_count': len(result.mutual_funds),
            'total_rows': len(result.stocks) + len(result.mutual_funds),
            'date_from': min(all_dates).isoformat() if all_dates else None,
            'date_to': max(all_dates).isoformat() if all_dates else None,
            'preview': preview_items,
        }
    else:
        try:
            result = parse_holdings(content)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f'Could not parse holdings: {e}. Please ensure you exported as CSV.')
        preview_items = []
        for item in (result.stocks + result.mutual_funds)[:10]:
            if isinstance(item, CanonicalHolding):
                preview_items.append({
                    'symbol': item.symbol,
                    'name': item.name,
                    'isin': item.isin,
                    'quantity': item.quantity,
                    'avg_cost': item.avg_cost,
                    'current_price': item.current_price,
                    'instrument_type': item.instrument_type,
                })
        return {
            'file_type': 'holdings',
            'broker': result.broker,
            'unrecognised': result.unrecognised,
            'raw_headers': result.raw_headers if result.unrecognised else [],
            'stocks_count': len(result.stocks),
            'mutual_funds_count': len(result.mutual_funds),
            'total_rows': len(result.stocks) + len(result.mutual_funds),
            'date_from': None,
            'date_to': None,
            'preview': preview_items,
        }


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
