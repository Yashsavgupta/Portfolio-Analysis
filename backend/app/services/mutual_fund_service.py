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
                    f"{MFAPI_BASE_URL}/{fund_code}",
                    timeout=aiohttp.ClientTimeout(total=30)
                ) as response:
                    if response.status == 200:
                        return await response.json(content_type=None)
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
                    f"{MFAPI_BASE_URL}/{fund_code}",
                    timeout=aiohttp.ClientTimeout(total=30)
                ) as response:
                    if response.status == 200:
                        data = await response.json(content_type=None)
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
    async def _search_scheme_code(fund_name: str) -> Optional[str]:
        """Search mfapi.in for the best matching numeric scheme code for a fund name.
        Prefers Direct plan results when the fund name contains 'direct'.
        """
        import difflib, urllib.parse
        try:
            async with aiohttp.ClientSession() as session:
                query = urllib.parse.quote_plus(fund_name[:50])
                async with session.get(
                    f"{MFAPI_BASE_URL}/search?q={query}",
                    timeout=aiohttp.ClientTimeout(total=10),
                ) as resp:
                    results = await resp.json(content_type=None)
            if not results:
                return None

            want_direct = "direct" in fund_name.lower()

            # If we want a direct plan, narrow search to direct-plan results first
            if want_direct:
                direct_subset = [r for r in results if "direct" in r["schemeName"].lower()]
                if direct_subset:
                    direct_names = [r["schemeName"] for r in direct_subset]
                    matches = difflib.get_close_matches(fund_name, direct_names, n=1, cutoff=0.2)
                    if matches:
                        idx = direct_names.index(matches[0])
                        return str(direct_subset[idx]["schemeCode"])
                    # Best direct plan result even without a close match
                    return str(direct_subset[0]["schemeCode"])

            # Fall back to all results
            all_names = [r["schemeName"] for r in results]
            matches = difflib.get_close_matches(fund_name, all_names, n=1, cutoff=0.3)
            if matches:
                idx = all_names.index(matches[0])
                return str(results[idx]["schemeCode"])
            return str(results[0]["schemeCode"])
        except Exception:
            return None

    @staticmethod
    async def sync_all_funds(db: Session) -> int:
        """Sync all funds: resolve scheme codes, fetch NAV history, compute returns + full risk metrics."""
        import math
        import numpy as np
        import pandas as pd

        RISK_FREE_RATE = 6.5  # Indian 91-day T-bill approximate annualised %

        # ── Fetch Nifty 50 benchmark returns once for beta computation ──────────
        benchmark_returns: Optional[pd.Series] = None
        try:
            import yfinance as yf
            nifty_raw = yf.download("^NSEI", period="2y", interval="1d",
                                    progress=False, auto_adjust=True)
            if not nifty_raw.empty:
                close = nifty_raw["Close"]
                if hasattr(close, "squeeze"):
                    close = close.squeeze()
                bm = close.pct_change().dropna()
                bm.index = pd.to_datetime(bm.index).normalize()
                benchmark_returns = bm
                logger.info(f"Nifty 50 benchmark loaded: {len(benchmark_returns)} trading days")
        except Exception as e:
            logger.warning(f"Could not fetch Nifty 50 for beta computation: {e}")

        funds = db.query(MutualFund).filter(MutualFund.is_active == True).all()
        updated_count = 0

        for fund in funds:
            try:
                # ── 1. Resolve a real mfapi.in numeric scheme code ─────────────
                # ISINs (INF…, IN1…) and fake codes (MF_…, IND_…) are not accepted
                # by mfapi.in — search by fund name to get the numeric code.
                scheme_code = fund.fund_code
                if (
                    not scheme_code
                    or scheme_code.startswith("MF_")
                    or scheme_code.startswith("IND_")
                    or not scheme_code.strip().isdigit()
                ):
                    scheme_code = await MutualFundService._search_scheme_code(fund.name or "")
                    if not scheme_code:
                        logger.warning(f"Could not find scheme code for: {fund.name}")
                        continue
                    # Check for an existing record that already has this numeric code.
                    # This happens when the import created an ISIN-keyed duplicate of a
                    # fund that was already in the DB with its real mfapi code.
                    from app.models.mutual_fund import MutualFundHolding as _MFH
                    existing = (
                        db.query(MutualFund)
                        .filter(MutualFund.fund_code == scheme_code,
                                MutualFund.id != fund.id)
                        .first()
                    )
                    if existing:
                        # Re-point any holdings that reference the ISIN duplicate
                        db.query(_MFH).filter(_MFH.mutual_fund_id == fund.id).update(
                            {"mutual_fund_id": existing.id}
                        )
                        db.delete(fund)
                        db.commit()
                        logger.info(
                            f"Merged duplicate {fund.name} (id={fund.id}) "
                            f"into existing id={existing.id}"
                        )
                        continue  # process the existing record next iteration

                    # Persist the resolved numeric code so future syncs skip this step
                    fund.fund_code = scheme_code
                    db.commit()

                # ── 2. Fetch NAV history (up to 5 years) ──────────────────────
                nav_history_raw = await MutualFundService.fetch_fund_nav_history(
                    scheme_code, limit=1825
                )
                if not nav_history_raw:
                    logger.warning(f"No NAV history for {fund.name} (code {scheme_code})")
                    continue

                # ── 3. Update metadata from mfapi.in ──────────────────────────
                fund_details = await MutualFundService.fetch_fund_details(scheme_code)
                if fund_details:
                    meta = fund_details.get("meta", {})
                    fund.fund_code = scheme_code
                    if meta.get("fund_house"):
                        fund.fund_house = meta["fund_house"]
                    # mfapi.in uses "scheme_category", not "category"
                    scheme_cat = meta.get("scheme_category") or meta.get("category")
                    if scheme_cat:
                        fund.category = scheme_cat
                    if meta.get("scheme_type"):
                        fund.fund_type = meta["scheme_type"]

                # ── 4. Update current NAV ──────────────────────────────────────
                try:
                    latest = nav_history_raw[0]
                    fund.current_nav = float(latest.get("nav", fund.current_nav or 0))
                    fund.nav_date = datetime.strptime(latest["date"], "%d-%m-%Y").date()
                except Exception:
                    pass

                # ── 5. Persist NAV history rows ────────────────────────────────
                MutualFundService._save_nav_history(db, fund.id, nav_history_raw)
                db.flush()

                nav_history_db = (
                    db.query(MutualFundNAVHistory)
                    .filter(MutualFundNAVHistory.mutual_fund_id == fund.id)
                    .order_by(MutualFundNAVHistory.nav_date.desc())
                    .all()
                )

                # ── 6. Period returns ──────────────────────────────────────────
                returns = MutualFundService.calculate_returns(
                    nav_history_db,
                    periods=["1w", "1m", "3m", "6m", "1y", "3y", "5y"],
                )
                fund.return_1w = returns.get("1w")
                fund.return_1m = returns.get("1m")
                fund.return_3m = returns.get("3m")
                fund.return_6m = returns.get("6m")
                fund.return_1y = returns.get("1y")
                fund.return_3y = returns.get("3y")
                fund.return_5y = returns.get("5y")

                # ── 7. Volatility & drawdown ───────────────────────────────────
                risk = MutualFundService.calculate_risk_metrics(nav_history_db)
                daily_std = risk.get("std_dev_1y")
                fund.std_dev_1y = round(daily_std * math.sqrt(252), 2) if daily_std else None
                fund.max_drawdown = (
                    round(risk.get("max_drawdown", 0), 2)
                    if risk.get("max_drawdown") is not None else None
                )

                # ── 8. Sharpe ratio ────────────────────────────────────────────
                if fund.return_1y is not None and fund.std_dev_1y and fund.std_dev_1y > 0:
                    fund.sharpe_ratio = round(
                        (fund.return_1y - RISK_FREE_RATE) / fund.std_dev_1y, 2
                    )

                # ── 9. Beta vs Nifty 50 ───────────────────────────────────────
                if benchmark_returns is not None and len(nav_history_db) >= 30:
                    try:
                        # Build fund daily-return series (latest 1Y, sorted oldest→newest)
                        one_year = nav_history_db[:252]
                        f_dates = pd.to_datetime([r.nav_date for r in one_year]).normalize()
                        f_navs = pd.to_numeric(
                            [r.nav_value for r in one_year], errors="coerce"
                        )
                        fund_series = (
                            pd.Series(f_navs, index=f_dates)
                            .sort_index()
                        )
                        fund_ret = fund_series.pct_change().dropna()

                        # Inner-join on trading dates present in both series
                        aligned = pd.concat(
                            [fund_ret.rename("fund"), benchmark_returns.rename("bench")],
                            axis=1,
                        ).dropna()

                        if len(aligned) >= 30:
                            cov = np.cov(
                                aligned["fund"].values, aligned["bench"].values
                            )[0, 1]
                            var_bench = aligned["bench"].var()
                            if var_bench > 0:
                                fund.beta = round(cov / var_bench, 2)
                    except Exception as be:
                        logger.warning(f"Beta computation failed for {fund.name}: {be}")

                fund.last_updated = datetime.utcnow()
                db.commit()
                updated_count += 1
                logger.info(
                    f"Synced {fund.name}: 1Y={fund.return_1y}%, "
                    f"Sharpe={fund.sharpe_ratio}, StdDev={fund.std_dev_1y}%, "
                    f"Beta={fund.beta}, MaxDD={fund.max_drawdown}%"
                )

            except Exception as e:
                logger.error(f"Error syncing fund {fund.name}: {e}")
                db.rollback()

        # ── Post-sync: assign relative star ratings across the whole universe ──
        # Ratings are percentile-based within the tracked fund universe so they
        # remain meaningful even during broad market downturns (when absolute
        # Sharpe thresholds would leave most funds un-rated).
        #   Top 20 %  → ★★★★★   20-40 % → ★★★★   40-60 % → ★★★
        #   60-80 %   → ★★       Bottom 20 % → ★
        # Only funds with a computed Sharpe ratio are rated; others stay None.
        try:
            funds_with_sharpe = (
                db.query(MutualFund)
                .filter(MutualFund.is_active == True,
                        MutualFund.sharpe_ratio != None)
                .all()
            )
            if funds_with_sharpe:
                ranked = sorted(funds_with_sharpe,
                                key=lambda f: f.sharpe_ratio or 0,
                                reverse=True)
                n = len(ranked)
                for idx, f in enumerate(ranked):
                    pctile = (idx + 1) / n  # 0.0 = best, 1.0 = worst
                    if pctile <= 0.20:
                        f.rating = 5
                    elif pctile <= 0.40:
                        f.rating = 4
                    elif pctile <= 0.60:
                        f.rating = 3
                    elif pctile <= 0.80:
                        f.rating = 2
                    else:
                        f.rating = 1
                db.commit()
                logger.info(
                    f"Assigned relative ratings to {len(ranked)} funds "
                    f"(universe: {n} with Sharpe data)"
                )
        except Exception as re:
            logger.error(f"Rating assignment failed: {re}")
            db.rollback()

        return updated_count

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
        
        # Max drawdown over 3 years in chronological order (oldest→newest)
        three_year_records = nav_history[:min(len(nav_history), 756)]  # ~3Y of trading days
        if three_year_records:
            chronological = list(reversed(three_year_records))
            peak = chronological[0].nav_value
            max_drawdown = 0.0
            for record in chronological:
                if record.nav_value > peak:
                    peak = record.nav_value
                drawdown = (peak - record.nav_value) / peak * 100
                if drawdown > max_drawdown:
                    max_drawdown = drawdown
            metrics['max_drawdown'] = max_drawdown
        
        return metrics
