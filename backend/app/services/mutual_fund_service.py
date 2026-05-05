"""Mutual Fund Service - Integration with MFAPI.in and data management"""
import logging
import aiohttp
import json
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import select, and_

from app.models.mutual_fund import MutualFund, MutualFundNAVHistory
from app.models.holding import Holding

logger = logging.getLogger(__name__)

MFAPI_BASE_URL = "https://api.mfapi.in/mf"
CACHE_EXPIRY_HOURS = 24  # Cache fund data for 24 hours
NAV_CACHE_EXPIRY_DAYS = 1  # Cache NAV history for 1 day


class MutualFundService:
    """Service for managing mutual fund data and API integrations"""

    @staticmethod
    async def fetch_all_funds_from_api() -> List[Dict[str, Any]]:
        """
        Fetch complete list of mutual funds from MFAPI.in
        
        Returns:
            List of fund dictionaries with metadata
        """
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(f"{MFAPI_BASE_URL}/", timeout=aiohttp.ClientTimeout(total=30)) as response:
                    if response.status == 200:
                        data = await response.json()
                        logger.info(f"Fetched {len(data)} funds from MFAPI.in")
                        return data
                    else:
                        logger.error(f"Failed to fetch funds: {response.status}")
                        return []
        except Exception as e:
            logger.error(f"Error fetching funds from MFAPI.in: {str(e)}")
            return []

    @staticmethod
    async def fetch_fund_details(fund_code: str) -> Optional[Dict[str, Any]]:
        """
        Fetch detailed information about a specific fund from MFAPI.in
        
        Args:
            fund_code: The fund code from MFAPI.in
            
        Returns:
            Fund details dictionary or None if not found
        """
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(
                    f"{MFAPI_BASE_URL}/{fund_code}/",
                    timeout=aiohttp.ClientTimeout(total=30)
                ) as response:
                    if response.status == 200:
                        return await response.json()
                    else:
                        logger.warning(f"Fund {fund_code} not found: {response.status}")
                        return None
        except Exception as e:
            logger.error(f"Error fetching fund details for {fund_code}: {str(e)}")
            return None

    @staticmethod
    async def fetch_fund_nav_history(fund_code: str, limit: int = 252) -> List[Dict[str, Any]]:
        """
        Fetch NAV history for a fund
        
        Args:
            fund_code: The fund code from MFAPI.in
            limit: Number of records to fetch (default 1 year = 252 trading days)
            
        Returns:
            List of NAV history records
        """
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(
                    f"{MFAPI_BASE_URL}/{fund_code}/series/Direct/nav/",
                    timeout=aiohttp.ClientTimeout(total=30)
                ) as response:
                    if response.status == 200:
                        data = await response.json()
                        nav_data = data.get('data', [])[:limit]
                        logger.info(f"Fetched {len(nav_data)} NAV records for {fund_code}")
                        return nav_data
                    else:
                        logger.warning(f"NAV history not found for {fund_code}: {response.status}")
                        return []
        except Exception as e:
            logger.error(f"Error fetching NAV history for {fund_code}: {str(e)}")
            return []

    @staticmethod
    def sync_fund_to_db(
        db: Session,
        fund_code: str,
        fund_details: Dict[str, Any],
        nav_history: List[Dict[str, Any]]
    ) -> Optional[MutualFund]:
        """
        Sync fund data from API to database
        
        Args:
            db: Database session
            fund_code: Fund code from MFAPI
            fund_details: Fund details from API
            nav_history: NAV history from API
            
        Returns:
            MutualFund object or None if sync failed
        """
        try:
            # Extract fund metadata
            meta = fund_details.get('meta', {})
            data = fund_details.get('data', {})
            
            # Get latest NAV
            latest_nav = None
            latest_nav_date = None
            if nav_history and len(nav_history) > 0:
                latest_record = nav_history[0]
                latest_nav = float(latest_record.get('nav', 0))
                latest_nav_date = datetime.strptime(latest_record.get('date', ''), '%d-%m-%Y').date()
            
            # Check if fund already exists
            fund = db.query(MutualFund).filter(MutualFund.fund_code == fund_code).first()
            
            if not fund:
                fund = MutualFund(
                    fund_code=fund_code,
                    isin=meta.get('isin', ''),
                    name=meta.get('fund_name', ''),
                    fund_house=meta.get('fund_house', ''),
                    category=meta.get('category', ''),
                    subcategory=meta.get('sub_category', ''),
                    fund_type=meta.get('scheme_type', ''),
                    current_nav=latest_nav,
                    nav_date=latest_nav_date,
                )
                db.add(fund)
            else:
                # Update existing fund
                fund.current_nav = latest_nav
                fund.nav_date = latest_nav_date
                fund.name = meta.get('fund_name', fund.name)
                fund.fund_house = meta.get('fund_house', fund.fund_house)
                fund.category = meta.get('category', fund.category)
            
            fund.last_updated = datetime.utcnow()
            db.commit()
            logger.info(f"Synced fund {fund_code} to database")
            
            # Save NAV history
            MutualFundService._save_nav_history(db, fund.id, nav_history)
            
            return fund
            
        except Exception as e:
            logger.error(f"Error syncing fund {fund_code} to database: {str(e)}")
            db.rollback()
            return None

    @staticmethod
    def _save_nav_history(db: Session, fund_id: int, nav_history: List[Dict[str, Any]]) -> None:
        """
        Save NAV history records to database
        
        Args:
            db: Database session
            fund_id: ID of the fund
            nav_history: List of NAV records from API
        """
        try:
            for record in nav_history:
                nav_date = datetime.strptime(record.get('date', ''), '%d-%m-%Y').date()
                
                # Check if record already exists
                existing = db.query(MutualFundNAVHistory).filter(
                    and_(
                        MutualFundNAVHistory.mutual_fund_id == fund_id,
                        MutualFundNAVHistory.nav_date == nav_date
                    )
                ).first()
                
                if not existing:
                    nav_record = MutualFundNAVHistory(
                        mutual_fund_id=fund_id,
                        nav_date=nav_date,
                        nav_value=float(record.get('nav', 0))
                    )
                    db.add(nav_record)
            
            db.commit()
            logger.info(f"Saved {len(nav_history)} NAV history records for fund {fund_id}")
        except Exception as e:
            logger.error(f"Error saving NAV history: {str(e)}")
            db.rollback()

    @staticmethod
    def search_funds(
        db: Session,
        query: Optional[str] = None,
        category: Optional[str] = None,
        fund_house: Optional[str] = None,
        skip: int = 0,
        limit: int = 20
    ) -> tuple[List[MutualFund], int]:
        """
        Search for mutual funds with filters
        
        Args:
            db: Database session
            query: Search query for fund name or code
            category: Filter by category
            fund_house: Filter by fund house
            skip: Pagination skip
            limit: Pagination limit
            
        Returns:
            Tuple of (funds list, total count)
        """
        filters = [MutualFund.is_active == True]
        
        if query:
            query_filter = f"%{query}%"
            filters.append(
                (MutualFund.name.ilike(query_filter)) |
                (MutualFund.fund_code.ilike(query_filter))
            )
        
        if category:
            filters.append(MutualFund.category.ilike(f"%{category}%"))
        
        if fund_house:
            filters.append(MutualFund.fund_house.ilike(f"%{fund_house}%"))
        
        # Get total count
        total = db.query(MutualFund).filter(*filters).count()
        
        # Get paginated results
        funds = db.query(MutualFund).filter(*filters).offset(skip).limit(limit).all()
        
        return funds, total

    @staticmethod
    def get_fund_by_isin(db: Session, isin: str) -> Optional[MutualFund]:
        """Get fund by ISIN"""
        return db.query(MutualFund).filter(MutualFund.isin == isin).first()

    @staticmethod
    def get_fund_by_code(db: Session, fund_code: str) -> Optional[MutualFund]:
        """Get fund by fund code"""
        return db.query(MutualFund).filter(MutualFund.fund_code == fund_code).first()

    @staticmethod
    def calculate_returns(nav_history: List[MutualFundNAVHistory], periods: List[str] = None) -> Dict[str, float]:
        """
        Calculate returns for different periods from NAV history
        
        Args:
            nav_history: List of NAV history records sorted by date (latest first)
            periods: List of periods like ['1w', '1m', '3m', '6m', '1y', '3y']
            
        Returns:
            Dictionary of period -> return percentage
        """
        if periods is None:
            periods = ['1w', '1m', '3m', '6m', '1y', '3y']
        
        returns = {}
        if not nav_history or len(nav_history) < 2:
            return returns
        
        latest_nav = nav_history[0].nav_value
        latest_date = nav_history[0].nav_date
        
        # Define days for each period
        period_days = {
            '1w': 7,
            '1m': 30,
            '3m': 90,
            '6m': 180,
            '1y': 365,
            '3y': 1095,
            '5y': 1825,
        }
        
        for period in periods:
            days = period_days.get(period)
            if not days:
                continue
            
            target_date = latest_date - timedelta(days=days)
            
            # Find the closest NAV record to the target date
            closest_record = None
            for record in nav_history:
                if record.nav_date <= target_date:
                    closest_record = record
                    break
            
            if closest_record:
                old_nav = closest_record.nav_value
                returns[period] = ((latest_nav - old_nav) / old_nav) * 100
        
        return returns

    @staticmethod
    def calculate_risk_metrics(nav_history: List[MutualFundNAVHistory]) -> Dict[str, float]:
        """
        Calculate risk metrics from NAV history
        
        Args:
            nav_history: List of NAV history records
            
        Returns:
            Dictionary with std_dev_1y, std_dev_3y, sharpe_ratio, max_drawdown
        """
        metrics = {}
        
        if not nav_history or len(nav_history) < 30:
            return metrics
        
        # Calculate 1-year standard deviation (assuming 252 trading days = 1 year)
        one_year_records = nav_history[:252]
        if len(one_year_records) > 1:
            navs = [r.nav_value for r in one_year_records]
            daily_returns = [(navs[i] - navs[i + 1]) / navs[i + 1] * 100 for i in range(len(navs) - 1)]
            
            if daily_returns:
                import statistics
                metrics['std_dev_1y'] = statistics.stdev(daily_returns)
        
        # Calculate maximum drawdown
        if nav_history:
            peak = nav_history[0].nav_value
            max_drawdown = 0
            for record in nav_history:
                drawdown = (peak - record.nav_value) / peak * 100
                max_drawdown = max(max_drawdown, drawdown)
                peak = max(peak, record.nav_value)
            
            metrics['max_drawdown'] = max_drawdown
        
        return metrics
