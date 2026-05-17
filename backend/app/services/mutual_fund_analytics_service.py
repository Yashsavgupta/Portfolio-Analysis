"""Mutual Fund Analytics Service - Portfolio analysis and comparisons"""
import logging
from datetime import datetime
from typing import Dict, List, Any, Optional
from sqlalchemy.orm import Session
from sqlalchemy import select, and_

from app.models.mutual_fund import MutualFund, MutualFundHolding, MutualFundNAVHistory
from app.models.portfolio import Portfolio

logger = logging.getLogger(__name__)


class MutualFundAnalyticsService:
    """Service for mutual fund portfolio analysis"""

    @staticmethod
    def get_portfolio_mf_summary(db: Session, portfolio_id: int) -> Dict[str, Any]:
        """
        Get summary of mutual fund holdings in portfolio
        
        Args:
            db: Database session
            portfolio_id: Portfolio ID
            
        Returns:
            Summary dictionary with total value, gains, etc.
        """
        holdings = db.query(MutualFundHolding).filter(
            and_(
                MutualFundHolding.portfolio_id == portfolio_id,
                MutualFundHolding.is_active == True
            )
        ).all()
        
        if not holdings:
            return {
                'total_invested': 0,
                'total_value': 0,
                'total_gain_loss': 0,
                'total_gain_loss_pct': 0,
                'num_funds': 0,
                'by_category': {},
                'by_house': {}
            }
        
        total_invested = sum(float(h.cost_basis or 0) for h in holdings)
        total_value = sum(float(h.current_value or 0) for h in holdings)
        total_gain_loss = total_value - total_invested
        total_gain_loss_pct = (total_gain_loss / total_invested * 100) if total_invested > 0 else 0

        # Breakdown by category
        by_category = {}
        by_house = {}

        for holding in holdings:
            fund = holding.mutual_fund

            # By category
            category = (fund.category if fund else None) or 'Unknown'
            if category not in by_category:
                by_category[category] = {
                    'value': 0,
                    'invested': 0,
                    'num_funds': 0,
                    'holdings': []
                }
            by_category[category]['value'] += float(holding.current_value or 0)
            by_category[category]['invested'] += float(holding.cost_basis or 0)
            by_category[category]['num_funds'] += 1
            by_category[category]['holdings'].append(holding.id)

            # By fund house
            house = (fund.fund_house if fund else None) or 'Unknown'
            if house not in by_house:
                by_house[house] = {
                    'value': 0,
                    'invested': 0,
                    'num_funds': 0,
                    'holdings': []
                }
            by_house[house]['value'] += float(holding.current_value or 0)
            by_house[house]['invested'] += float(holding.cost_basis or 0)
            by_house[house]['num_funds'] += 1
            by_house[house]['holdings'].append(holding.id)
        
        # Calculate percentages for category and house
        for category in by_category:
            by_category[category]['pct'] = (by_category[category]['value'] / total_value * 100) if total_value > 0 else 0
            by_category[category]['gain_loss'] = by_category[category]['value'] - by_category[category]['invested']
            by_category[category]['gain_loss_pct'] = (
                by_category[category]['gain_loss'] / by_category[category]['invested'] * 100
                if by_category[category]['invested'] > 0 else 0
            )
        
        for house in by_house:
            by_house[house]['pct'] = (by_house[house]['value'] / total_value * 100) if total_value > 0 else 0
            by_house[house]['gain_loss'] = by_house[house]['value'] - by_house[house]['invested']
            by_house[house]['gain_loss_pct'] = (
                by_house[house]['gain_loss'] / by_house[house]['invested'] * 100
                if by_house[house]['invested'] > 0 else 0
            )
        
        return {
            'total_invested': total_invested,
            'total_value': total_value,
            'total_gain_loss': total_gain_loss,
            'total_gain_loss_pct': total_gain_loss_pct,
            'num_funds': len(holdings),
            'by_category': by_category,
            'by_house': by_house
        }

    @staticmethod
    def get_portfolio_mf_details(db: Session, portfolio_id: int, skip: int = 0, limit: int = 50) -> Dict[str, Any]:
        """
        Get detailed list of mutual fund holdings
        
        Args:
            db: Database session
            portfolio_id: Portfolio ID
            skip: Pagination skip
            limit: Pagination limit
            
        Returns:
            Dictionary with holdings list and metadata
        """
        holdings = db.query(MutualFundHolding).filter(
            and_(
                MutualFundHolding.portfolio_id == portfolio_id,
                MutualFundHolding.is_active == True
            )
        ).offset(skip).limit(limit).all()
        
        total = db.query(MutualFundHolding).filter(
            and_(
                MutualFundHolding.portfolio_id == portfolio_id,
                MutualFundHolding.is_active == True
            )
        ).count()
        
        holdings_data = []
        for holding in holdings:
            fund = holding.mutual_fund
            nav_history = db.query(MutualFundNAVHistory).filter(
                MutualFundNAVHistory.mutual_fund_id == fund.id
            ).order_by(MutualFundNAVHistory.nav_date.desc()).limit(365).all()
            
            holding_data = {
                'id': holding.id,
                'portfolio_id': holding.portfolio_id,
                'mutual_fund_id': fund.id,
                'fund_name': fund.name,
                'fund_house': fund.fund_house,
                'category': fund.category,
                'units': holding.units,
                'current_nav': fund.current_nav,
                'nav_date': fund.nav_date.isoformat() if fund.nav_date else None,
                'cost_basis': holding.cost_basis,
                'current_value': holding.current_value,
                'gain_loss': holding.gain_loss,
                'gain_loss_pct': holding.gain_loss_pct,
                'purchase_date': holding.purchase_date.isoformat(),
                'plan_type': holding.plan_type,
                'source': holding.source,
                'is_long_term': holding.is_long_term,
                'holding_days': holding.holding_days,
                'nav_at_purchase': holding.nav_at_purchase,
                'fund_1y_return': fund.return_1y,
                'fund_3y_return': fund.return_3y,
                'fund_5y_return': fund.return_5y,
            }
            holdings_data.append(holding_data)
        
        return {
            'holdings': holdings_data,
            'total': total,
            'skip': skip,
            'limit': limit
        }

    @staticmethod
    def get_tax_analysis(db: Session, portfolio_id: int) -> Dict[str, Any]:
        """
        Get tax planning information for mutual fund holdings
        
        Args:
            db: Database session
            portfolio_id: Portfolio ID
            
        Returns:
            Tax analysis including short-term and long-term holdings
        """
        holdings = db.query(MutualFundHolding).filter(
            and_(
                MutualFundHolding.portfolio_id == portfolio_id,
                MutualFundHolding.is_active == True
            )
        ).all()
        
        long_term_value = 0
        short_term_value = 0
        long_term_gain = 0
        short_term_gain = 0
        
        holdings_breakdown = {
            'long_term': [],
            'short_term': []
        }
        
        for holding in holdings:
            if holding.is_long_term:
                long_term_value += holding.current_value
                long_term_gain += holding.gain_loss
                holdings_breakdown['long_term'].append({
                    'fund_name': holding.mutual_fund.name,
                    'current_value': holding.current_value,
                    'gain_loss': holding.gain_loss,
                    'purchase_date': holding.purchase_date.isoformat(),
                    'holding_days': holding.holding_days
                })
            else:
                short_term_value += holding.current_value
                short_term_gain += holding.gain_loss
                holdings_breakdown['short_term'].append({
                    'fund_name': holding.mutual_fund.name,
                    'current_value': holding.current_value,
                    'gain_loss': holding.gain_loss,
                    'purchase_date': holding.purchase_date.isoformat(),
                    'holding_days': holding.holding_days,
                    'days_to_long_term': 365 - (holding.holding_days or 0)
                })
        
        return {
            'long_term': {
                'value': long_term_value,
                'gain': long_term_gain,
                'num_holdings': len(holdings_breakdown['long_term']),
                'holdings': holdings_breakdown['long_term']
            },
            'short_term': {
                'value': short_term_value,
                'gain': short_term_gain,
                'num_holdings': len(holdings_breakdown['short_term']),
                'holdings': holdings_breakdown['short_term']
            },
            'tax_implication': {
                'long_term_tax_rate': '0% (IndexationBenefit/Exempt)',
                'short_term_tax_rate': 'As per income slab',
                'note': 'Tax rates vary by individual and fund type. Consult CA for accurate calculations.'
            }
        }

    @staticmethod
    def compare_funds(db: Session, fund_ids: List[int]) -> Dict[str, Any]:
        """
        Compare multiple mutual funds side by side
        
        Args:
            db: Database session
            fund_ids: List of fund IDs to compare
            
        Returns:
            Comparison data for multiple funds
        """
        funds = db.query(MutualFund).filter(MutualFund.id.in_(fund_ids)).all()
        
        if not funds:
            return {}
        
        comparison = {}
        
        for fund in funds:
            comparison[fund.id] = {
                'name': fund.name,
                'fund_house': fund.fund_house,
                'category': fund.category,
                'current_nav': fund.current_nav,
                'nav_date': fund.nav_date.isoformat() if fund.nav_date else None,
                'aum': fund.aum,
                'expense_ratio': fund.expense_ratio,
                'returns': {
                    '1w': fund.return_1w,
                    '1m': fund.return_1m,
                    '3m': fund.return_3m,
                    '6m': fund.return_6m,
                    '1y': fund.return_1y,
                    '3y': fund.return_3y,
                    '5y': fund.return_5y,
                    '10y': fund.return_10y,
                    'inception': fund.return_inception
                },
                'risk': {
                    'std_dev_1y': fund.std_dev_1y,
                    'std_dev_3y': fund.std_dev_3y,
                    'sharpe_ratio': fund.sharpe_ratio,
                    'sortino_ratio': fund.sortino_ratio,
                    'beta': fund.beta,
                    'alpha': fund.alpha,
                    'max_drawdown': fund.max_drawdown
                },
                'ratings': {
                    'rating': fund.rating,
                    'rank_in_category': fund.rank_in_category,
                    'category_average_return': fund.category_average_return,
                    'benchmark_name': fund.benchmark_name,
                    'benchmark_return': fund.benchmark_return
                }
            }
        
        return comparison

    @staticmethod
    def get_fund_nav_chart(db: Session, fund_id: int, days: int = 365) -> Dict[str, Any]:
        """
        Get NAV chart data for a fund
        
        Args:
            db: Database session
            fund_id: Fund ID
            days: Number of days of history
            
        Returns:
            Chart data with dates and NAV values
        """
        nav_history = db.query(MutualFundNAVHistory).filter(
            MutualFundNAVHistory.mutual_fund_id == fund_id
        ).order_by(MutualFundNAVHistory.nav_date.desc()).limit(days).all()
        nav_history = list(reversed(nav_history))
        
        fund = db.query(MutualFund).filter(MutualFund.id == fund_id).first()
        
        if not fund or not nav_history:
            return {'data': [], 'fund_name': fund.name if fund else ''}
        
        chart_data = {
            'fund_name': fund.name,
            'fund_house': fund.fund_house,
            'data': [
                {
                    'date': record.nav_date.isoformat(),
                    'nav': record.nav_value
                }
                for record in nav_history
            ]
        }
        
        return chart_data

    @staticmethod
    def recommend_similar_funds(
        db: Session,
        fund_id: int,
        limit: int = 5
    ) -> List[Dict[str, Any]]:
        """
        Find similar funds based on category and performance
        
        Args:
            db: Database session
            fund_id: Fund ID to find similar funds for
            limit: Maximum number of recommendations
            
        Returns:
            List of similar funds
        """
        fund = db.query(MutualFund).filter(MutualFund.id == fund_id).first()
        
        if not fund:
            return []
        
        # Find funds in same category with similar returns
        similar_funds = db.query(MutualFund).filter(
            and_(
                MutualFund.category == fund.category,
                MutualFund.id != fund_id,
                MutualFund.is_active == True
            )
        ).order_by(
            MutualFund.rank_in_category  # Higher rank (lower number) comes first
        ).limit(limit).all()
        
        recommendations = []
        for similar_fund in similar_funds:
            recommendations.append({
                'id': similar_fund.id,
                'name': similar_fund.name,
                'fund_house': similar_fund.fund_house,
                'category': similar_fund.category,
                'return_1y': similar_fund.return_1y,
                'return_3y': similar_fund.return_3y,
                'return_5y': similar_fund.return_5y,
                'rating': similar_fund.rating,
                'rank_in_category': similar_fund.rank_in_category,
                'expense_ratio': similar_fund.expense_ratio,
                'current_nav': similar_fund.current_nav
            })
        
        return recommendations
