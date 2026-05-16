"""Mutual funds API routes"""
import logging
import aiohttp
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from sqlalchemy.orm import Session
from datetime import datetime
from typing import Optional, List

from app.api.deps import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.portfolio import Portfolio
from app.models.mutual_fund import MutualFund, MutualFundHolding, SourceCredentials
from app.schemas.mutual_fund import (
    MutualFundResponse,
    MutualFundDetailedResponse,
    MutualFundHoldingCreate,
    MutualFundHoldingUpdate,
    MutualFundHoldingResponse,
    PortfolioMFSummaryResponse,
    TaxAnalysisResponse,
    FundComparisonResponse,
    MutualFundSearchResponse,
    NAVHistoryResponse,
    INDmoneyImportRequest,
    INDmoneyImportResponse,
    PortfolioMFDetailsResponse,
    RecommendationResponse,
)
from app.services.mutual_fund_service import MutualFundService
from app.services.mutual_fund_analytics_service import MutualFundAnalyticsService
from app.services.indmoney_parser import INDmoneyCSVParser
from app.services.mf_portfolio_service import (
    get_xirr_performance,
    get_allocation_detail,
    get_tax_deep_dive,
    get_risk_overview,
)

logger = logging.getLogger(__name__)
router = APIRouter()


# ==================== Live Search (mfapi.in) ====================

@router.get("/search-live")
async def search_funds_live(
    q: str = Query("", description="Search term"),
    current_user: User = Depends(get_current_user),
):
    """Search mutual funds via mfapi.in live search."""
    if not q.strip():
        return {"funds": [], "total": 0}
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(
                f"https://api.mfapi.in/mf/search?q={q}",
                timeout=aiohttp.ClientTimeout(total=10),
            ) as resp:
                data = await resp.json(content_type=None)
        funds = [{"scheme_code": f["schemeCode"], "name": f["schemeName"]} for f in data]
        return {"funds": funds, "total": len(funds)}
    except Exception as e:
        logger.error(f"mfapi.in search error: {e}")
        raise HTTPException(status_code=502, detail="Failed to reach mutual fund data service")


# ==================== My Portfolio (auto-detect) ====================

@router.get("/my-portfolio/summary")
async def get_my_mf_portfolio_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return the summary + portfolio_id for the user's most recent MF portfolio."""
    portfolio = (
        db.query(Portfolio)
        .filter(Portfolio.user_id == current_user.id, Portfolio.type == "mutual_funds")
        .order_by(Portfolio.id.desc())
        .first()
    )
    if not portfolio:
        raise HTTPException(status_code=404, detail="No mutual fund portfolio found")

    holdings = (
        db.query(MutualFundHolding)
        .filter(MutualFundHolding.portfolio_id == portfolio.id, MutualFundHolding.is_active == True)
        .all()
    )
    if not holdings:
        raise HTTPException(status_code=404, detail="Mutual fund portfolio has no holdings")

    summary = MutualFundAnalyticsService.get_portfolio_mf_summary(db, portfolio.id)
    return {**summary, "portfolio_id": portfolio.id, "portfolio_name": portfolio.name}


# ==================== Fund Management ====================

@router.get("/", response_model=MutualFundSearchResponse)
async def search_funds(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    query: Optional[str] = Query(None, description="Search by fund name or code"),
    category: Optional[str] = Query(None, description="Filter by category"),
    fund_house: Optional[str] = Query(None, description="Filter by fund house"),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100)
):
    """Search and list mutual funds"""
    funds, total = MutualFundService.search_funds(
        db, query=query, category=category, fund_house=fund_house, skip=skip, limit=limit
    )
    return {
        "funds": funds,
        "total": total,
        "skip": skip,
        "limit": limit
    }


@router.get("/{fund_id}", response_model=MutualFundDetailedResponse)
async def get_fund_details(
    fund_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get detailed information about a mutual fund"""
    fund = db.query(MutualFund).filter(MutualFund.id == fund_id).first()
    
    if not fund:
        raise HTTPException(status_code=404, detail="Fund not found")
    
    return fund


@router.get("/{fund_id}/nav-history", response_model=NAVHistoryResponse)
async def get_nav_history(
    fund_id: int,
    days: int = Query(365, ge=1, le=1825),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get NAV history for a fund"""
    fund = db.query(MutualFund).filter(MutualFund.id == fund_id).first()
    
    if not fund:
        raise HTTPException(status_code=404, detail="Fund not found")
    
    nav_chart = MutualFundAnalyticsService.get_fund_nav_chart(db, fund_id, days=days)
    return nav_chart


@router.get("/{fund_id}/similar", response_model=RecommendationResponse)
async def get_similar_funds(
    fund_id: int,
    limit: int = Query(5, ge=1, le=10),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get similar fund recommendations"""
    recommendations = MutualFundAnalyticsService.recommend_similar_funds(db, fund_id, limit=limit)
    
    return {
        "recommendations": recommendations
    }


# ==================== Portfolio Mutual Fund Holdings ====================

@router.get("/portfolio/{portfolio_id}/summary", response_model=PortfolioMFSummaryResponse)
async def get_portfolio_mf_summary(
    portfolio_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get summary of mutual fund holdings in a portfolio"""
    # Verify portfolio belongs to current user
    portfolio = db.query(Portfolio).filter(
        (Portfolio.id == portfolio_id) & (Portfolio.user_id == current_user.id)
    ).first()
    
    if not portfolio:
        raise HTTPException(status_code=404, detail="Portfolio not found")
    
    summary = MutualFundAnalyticsService.get_portfolio_mf_summary(db, portfolio_id)
    return summary


@router.get("/portfolio/{portfolio_id}/holdings", response_model=PortfolioMFDetailsResponse)
async def get_portfolio_mf_holdings(
    portfolio_id: int,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get detailed list of mutual fund holdings in a portfolio"""
    # Verify portfolio belongs to current user
    portfolio = db.query(Portfolio).filter(
        (Portfolio.id == portfolio_id) & (Portfolio.user_id == current_user.id)
    ).first()
    
    if not portfolio:
        raise HTTPException(status_code=404, detail="Portfolio not found")
    
    details = MutualFundAnalyticsService.get_portfolio_mf_details(db, portfolio_id, skip=skip, limit=limit)
    return details


@router.post("/portfolio/{portfolio_id}/holdings", response_model=MutualFundHoldingResponse)
async def add_mf_holding(
    portfolio_id: int,
    holding_data: MutualFundHoldingCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Add a mutual fund holding to portfolio"""
    # Verify portfolio belongs to current user
    portfolio = db.query(Portfolio).filter(
        (Portfolio.id == portfolio_id) & (Portfolio.user_id == current_user.id)
    ).first()
    
    if not portfolio:
        raise HTTPException(status_code=404, detail="Portfolio not found")
    
    # Verify fund exists
    fund = db.query(MutualFund).filter(MutualFund.id == holding_data.mutual_fund_id).first()
    if not fund:
        raise HTTPException(status_code=404, detail="Fund not found")
    
    # Create holding
    mf_holding = MutualFundHolding(
        portfolio_id=portfolio_id,
        mutual_fund_id=holding_data.mutual_fund_id,
        units=holding_data.units,
        cost_basis=holding_data.cost_basis,
        current_value=holding_data.current_value,
        purchase_date=holding_data.purchase_date,
        nav_at_purchase=holding_data.nav_at_purchase,
        plan_type=holding_data.plan_type,
        source=holding_data.source,
        is_active=True
    )
    
    # Calculate gain/loss and tenure
    mf_holding.gain_loss = holding_data.current_value - holding_data.cost_basis
    mf_holding.gain_loss_pct = (mf_holding.gain_loss / holding_data.cost_basis * 100) if holding_data.cost_basis > 0 else 0
    holding_days = (datetime.utcnow().date() - mf_holding.purchase_date).days
    mf_holding.holding_days = holding_days
    mf_holding.is_long_term = holding_days >= 365
    
    db.add(mf_holding)
    db.commit()
    db.refresh(mf_holding)
    
    return mf_holding


@router.put("/portfolio/{portfolio_id}/holdings/{holding_id}", response_model=MutualFundHoldingResponse)
async def update_mf_holding(
    portfolio_id: int,
    holding_id: int,
    update_data: MutualFundHoldingUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update a mutual fund holding"""
    # Verify portfolio belongs to current user
    portfolio = db.query(Portfolio).filter(
        (Portfolio.id == portfolio_id) & (Portfolio.user_id == current_user.id)
    ).first()
    
    if not portfolio:
        raise HTTPException(status_code=404, detail="Portfolio not found")
    
    # Get holding
    holding = db.query(MutualFundHolding).filter(
        (MutualFundHolding.id == holding_id) & (MutualFundHolding.portfolio_id == portfolio_id)
    ).first()
    
    if not holding:
        raise HTTPException(status_code=404, detail="Holding not found")
    
    # Update fields
    if update_data.units is not None:
        holding.units = update_data.units
    if update_data.cost_basis is not None:
        holding.cost_basis = update_data.cost_basis
    if update_data.current_value is not None:
        holding.current_value = update_data.current_value
    if update_data.purchase_date is not None:
        holding.purchase_date = update_data.purchase_date
    if update_data.plan_type is not None:
        holding.plan_type = update_data.plan_type
    
    # Recalculate gain/loss and tenure
    holding.gain_loss = holding.current_value - holding.cost_basis
    holding.gain_loss_pct = (holding.gain_loss / holding.cost_basis * 100) if holding.cost_basis > 0 else 0
    holding_days = (datetime.utcnow().date() - holding.purchase_date).days
    holding.holding_days = holding_days
    holding.is_long_term = holding_days >= 365
    
    db.commit()
    db.refresh(holding)
    
    return holding


@router.delete("/portfolio/{portfolio_id}/holdings/{holding_id}")
async def delete_mf_holding(
    portfolio_id: int,
    holding_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a mutual fund holding (soft delete)"""
    # Verify portfolio belongs to current user
    portfolio = db.query(Portfolio).filter(
        (Portfolio.id == portfolio_id) & (Portfolio.user_id == current_user.id)
    ).first()
    
    if not portfolio:
        raise HTTPException(status_code=404, detail="Portfolio not found")
    
    # Get holding
    holding = db.query(MutualFundHolding).filter(
        (MutualFundHolding.id == holding_id) & (MutualFundHolding.portfolio_id == portfolio_id)
    ).first()
    
    if not holding:
        raise HTTPException(status_code=404, detail="Holding not found")
    
    # Soft delete
    holding.is_active = False
    db.commit()
    
    return {"message": "Holding deleted successfully"}


# ==================== Analytics ====================

@router.get("/portfolio/{portfolio_id}/xirr-performance")
async def get_portfolio_xirr_performance(
    portfolio_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """XIRR, per-fund CAGR, best/worst performers."""
    portfolio = db.query(Portfolio).filter(
        (Portfolio.id == portfolio_id) & (Portfolio.user_id == current_user.id)
    ).first()
    if not portfolio:
        raise HTTPException(status_code=404, detail="Portfolio not found")
    return get_xirr_performance(db, portfolio_id)


@router.get("/portfolio/{portfolio_id}/allocation-detail")
async def get_portfolio_allocation_detail(
    portfolio_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Allocation breakdown by category, AMC, asset type, plan type."""
    portfolio = db.query(Portfolio).filter(
        (Portfolio.id == portfolio_id) & (Portfolio.user_id == current_user.id)
    ).first()
    if not portfolio:
        raise HTTPException(status_code=404, detail="Portfolio not found")
    return get_allocation_detail(db, portfolio_id)


@router.get("/portfolio/{portfolio_id}/tax-deep-dive")
async def get_portfolio_tax_deep_dive(
    portfolio_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """LTCG/STCG breakdown with tax estimates, harvest opportunities, upcoming eligibility."""
    portfolio = db.query(Portfolio).filter(
        (Portfolio.id == portfolio_id) & (Portfolio.user_id == current_user.id)
    ).first()
    if not portfolio:
        raise HTTPException(status_code=404, detail="Portfolio not found")
    return get_tax_deep_dive(db, portfolio_id)


@router.get("/portfolio/{portfolio_id}/risk-overview")
async def get_portfolio_risk_overview(
    portfolio_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Weighted portfolio risk metrics: Sharpe, std dev, max drawdown, beta, concentration."""
    portfolio = db.query(Portfolio).filter(
        (Portfolio.id == portfolio_id) & (Portfolio.user_id == current_user.id)
    ).first()
    if not portfolio:
        raise HTTPException(status_code=404, detail="Portfolio not found")
    return get_risk_overview(db, portfolio_id)


@router.get("/portfolio/{portfolio_id}/tax-analysis", response_model=TaxAnalysisResponse)
async def get_tax_analysis(
    portfolio_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get tax planning analysis for mutual fund holdings"""
    # Verify portfolio belongs to current user
    portfolio = db.query(Portfolio).filter(
        (Portfolio.id == portfolio_id) & (Portfolio.user_id == current_user.id)
    ).first()
    
    if not portfolio:
        raise HTTPException(status_code=404, detail="Portfolio not found")
    
    tax_analysis = MutualFundAnalyticsService.get_tax_analysis(db, portfolio_id)
    return tax_analysis


@router.post("/compare", response_model=FundComparisonResponse)
async def compare_funds(
    fund_ids: List[int] = Query(..., description="List of fund IDs to compare"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Compare multiple mutual funds"""
    if not fund_ids or len(fund_ids) < 2:
        raise HTTPException(status_code=400, detail="Please provide at least 2 fund IDs for comparison")
    
    if len(fund_ids) > 10:
        raise HTTPException(status_code=400, detail="Maximum 10 funds can be compared at once")
    
    comparison = MutualFundAnalyticsService.compare_funds(db, fund_ids)
    
    if not comparison:
        raise HTTPException(status_code=404, detail="Funds not found")
    
    return {"funds": comparison}


# ==================== Import & Sync ====================

@router.post("/import/indmoney", response_model=INDmoneyImportResponse)
async def import_indmoney_csv(
    portfolio_id: Optional[int] = Query(None),
    portfolio_name: Optional[str] = Query(None),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Import mutual funds from INDmoney CSV export"""
    try:
        # Read CSV content
        content = await file.read()
        csv_content = content.decode('utf-8')
        
        # Validate CSV
        is_valid, validation_errors = INDmoneyCSVParser.validate_csv(csv_content)
        
        if not is_valid:
            return {
                "success": False,
                "imported_count": 0,
                "total_rows": 0,
                "errors": validation_errors,
                "message": "CSV validation failed"
            }

        portfolio = None
        if portfolio_id is not None:
            portfolio = db.query(Portfolio).filter(
                (Portfolio.id == portfolio_id) & (Portfolio.user_id == current_user.id)
            ).first()
            if not portfolio:
                raise HTTPException(status_code=404, detail="Portfolio not found")
        else:
            if not portfolio_name:
                portfolio_name = f"INDmoney Import {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')}"
            portfolio = Portfolio(
                user_id=current_user.id,
                name=portfolio_name,
                type='mutual_funds',
                description='Imported from INDmoney CSV',
            )
            db.add(portfolio)
            db.flush()
        
        # Parse CSV
        parsed_holdings, parse_errors = INDmoneyCSVParser.parse_csv_content(csv_content, portfolio.id)
        
        # Import to database
        imported_count, import_errors = INDmoneyCSVParser.import_holdings_to_db(db, parsed_holdings)
        
        all_errors = parse_errors + import_errors
        
        return {
            "success": len(all_errors) == 0,
            "imported_count": imported_count,
            "total_rows": len(parsed_holdings),
            "errors": all_errors,
            "message": f"Successfully imported {imported_count} holdings" if imported_count > 0 else "No holdings imported",
            "portfolio_id": portfolio.id,
        }
    
    except Exception as e:
        logger.error(f"Error importing INDmoney CSV: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Error processing CSV: {str(e)}")


@router.get("/sync-status")
async def get_sync_status(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get sync status for source integrations"""
    credentials = db.query(SourceCredentials).filter(
        SourceCredentials.user_id == current_user.id
    ).all()
    
    status_list = []
    for cred in credentials:
        status_list.append({
            "source": cred.source,
            "is_active": cred.is_active,
            "last_sync": cred.last_sync,
            "last_error": cred.last_error,
            "created_at": cred.created_at
        })
    
    return {"statuses": status_list}


# ==================== Fund Data Sync ====================

@router.post("/sync/fund-data")
async def sync_fund_data(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Trigger sync of mutual fund data from MFAPI"""
    try:
        updated_count = await MutualFundService.sync_all_funds(db)
        logger.info(f"Manual sync of fund data completed: {updated_count} funds updated")
        return {
            "success": True,
            "message": f"Fund data sync completed. Updated {updated_count} funds."
        }
    except Exception as e:
        logger.error(f"Error syncing fund data: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Sync failed: {str(e)}")
