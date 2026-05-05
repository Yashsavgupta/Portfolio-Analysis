"""Schemas for mutual fund API endpoints"""
from datetime import date, datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


class MutualFundBase(BaseModel):
    """Base mutual fund schema"""
    name: str
    fund_house: str
    category: str
    isin: Optional[str] = None
    fund_code: Optional[str] = None


class MutualFundCreate(MutualFundBase):
    """Schema for creating a mutual fund"""
    pass


class MutualFundResponse(MutualFundBase):
    """Schema for mutual fund response"""
    id: int
    current_nav: Optional[float] = None
    nav_date: Optional[date] = None
    aum: Optional[float] = None
    expense_ratio: Optional[float] = None
    rating: Optional[int] = None
    rank_in_category: Optional[int] = None
    return_1y: Optional[float] = None
    return_3y: Optional[float] = None
    return_5y: Optional[float] = None
    std_dev_1y: Optional[float] = None
    sharpe_ratio: Optional[float] = None
    max_drawdown: Optional[float] = None

    class Config:
        from_attributes = True


class MutualFundDetailedResponse(MutualFundResponse):
    """Detailed mutual fund response with all fields"""
    subcategory: Optional[str] = None
    fund_type: Optional[str] = None
    inception_date: Optional[date] = None
    category_average_return: Optional[float] = None
    benchmark_name: Optional[str] = None
    benchmark_return: Optional[float] = None
    fund_manager: Optional[str] = None
    description: Optional[str] = None
    return_1w: Optional[float] = None
    return_1m: Optional[float] = None
    return_3m: Optional[float] = None
    return_6m: Optional[float] = None
    return_10y: Optional[float] = None
    return_inception: Optional[float] = None
    sortino_ratio: Optional[float] = None
    beta: Optional[float] = None
    alpha: Optional[float] = None


class MutualFundHoldingCreate(BaseModel):
    """Schema for creating a mutual fund holding"""
    mutual_fund_id: int
    units: float
    cost_basis: float
    current_value: float
    purchase_date: date
    plan_type: str = Field(default='direct', pattern='^(direct|regular)$')
    nav_at_purchase: Optional[float] = None
    source: str = Field(default='manual', pattern='^(zerodha|indmoney|manual)$')


class MutualFundHoldingUpdate(BaseModel):
    """Schema for updating a mutual fund holding"""
    units: Optional[float] = None
    cost_basis: Optional[float] = None
    current_value: Optional[float] = None
    purchase_date: Optional[date] = None
    plan_type: Optional[str] = None


class MutualFundHoldingResponse(BaseModel):
    """Schema for mutual fund holding response"""
    id: int
    portfolio_id: int
    mutual_fund_id: int
    units: float
    cost_basis: float
    current_value: float
    gain_loss: Optional[float] = None
    gain_loss_pct: Optional[float] = None
    purchase_date: date
    plan_type: str
    source: str
    is_long_term: bool
    holding_days: Optional[int] = None
    nav_at_purchase: Optional[float] = None
    
    # Fund details
    fund_name: Optional[str] = None
    fund_house: Optional[str] = None
    category: Optional[str] = None
    current_nav: Optional[float] = None

    class Config:
        from_attributes = True


class PortfolioMFSummaryResponse(BaseModel):
    """Portfolio mutual fund summary response"""
    total_invested: float
    total_value: float
    total_gain_loss: float
    total_gain_loss_pct: float
    num_funds: int
    by_category: Dict[str, Any]
    by_house: Dict[str, Any]


class TaxAnalysisResponse(BaseModel):
    """Tax analysis response"""
    long_term: Dict[str, Any]
    short_term: Dict[str, Any]
    tax_implication: Dict[str, str]


class FundComparisonResponse(BaseModel):
    """Fund comparison response"""
    funds: Dict[int, Dict[str, Any]]


class MutualFundSearchResponse(BaseModel):
    """Fund search response with pagination"""
    funds: List[MutualFundResponse]
    total: int
    skip: int
    limit: int


class NAVHistoryResponse(BaseModel):
    """NAV history response"""
    fund_name: str
    fund_house: str
    data: List[Dict[str, Any]]


class INDmoneyImportRequest(BaseModel):
    """Request for INDmoney CSV import"""
    portfolio_id: int
    csv_content: str = Field(..., description="CSV file content as string")


class INDmoneyImportResponse(BaseModel):
    """Response for INDmoney import"""
    success: bool
    imported_count: int
    total_rows: int
    errors: List[str] = []
    message: str


class ImportValidationResponse(BaseModel):
    """Validation response for CSV import"""
    is_valid: bool
    errors: List[str]
    message: str


class PortfolioMFDetailsResponse(BaseModel):
    """Detailed portfolio mutual fund holdings response"""
    holdings: List[MutualFundHoldingResponse]
    total: int
    skip: int
    limit: int


class RecommendationResponse(BaseModel):
    """Fund recommendation response"""
    recommendations: List[Dict[str, Any]]


class SyncStatusResponse(BaseModel):
    """Sync status response"""
    source: str
    user_id: int
    is_active: bool
    last_sync: Optional[datetime] = None
    last_error: Optional[str] = None
    next_sync_scheduled: Optional[datetime] = None
