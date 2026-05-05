"""Service for portfolio analytics calculations"""
from typing import Dict, List, Optional
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from app.models.holding import Holding
from app.models.instrument import Instrument
import logging

logger = logging.getLogger(__name__)


class PortfolioAnalyticsService:
    """Calculate portfolio analytics from holdings"""
    
    # FY 2025-26 India tax rates
    LTCG_EXEMPTION = 125000  # ₹1,25,000 LTCG exemption
    LTCG_TAX_RATE = 0.125    # 12.5%
    STCG_TAX_RATE = 0.20     # 20%
    
    def __init__(self, holdings: List[Holding], db: Session = None):
        self.holdings = holdings
        self.db = db
    
    def get_portfolio_overview(self) -> Dict:
        """Calculate portfolio overview metrics"""
        total_invested = sum(h.invested_value for h in self.holdings)
        total_market_value = sum(h.market_value for h in self.holdings)
        total_pnl = total_market_value - total_invested
        pnl_pct = (total_pnl / total_invested * 100) if total_invested > 0 else 0
        
        return {
            'invested_value': round(total_invested, 2),
            'current_value': round(total_market_value, 2),
            'unrealized_pnl': round(total_pnl, 2),
            'unrealized_pnl_pct': round(pnl_pct, 2),
            'total_holdings': len(self.holdings),
            'holdings': self._format_holdings(),
        }
    
    def get_sector_segmentation(self) -> Dict:
        """Breakdown portfolio by sector"""
        sector_data = {}
        total_value = sum(h.market_value for h in self.holdings)
        
        for holding in self.holdings:
            sector = holding.instrument.sector or 'Others'
            is_etf = holding.instrument.is_etf
            
            if sector not in sector_data:
                sector_data[sector] = {
                    'value': 0,
                    'pct': 0,
                    'holdings_count': 0,
                    'is_etf': is_etf,
                    'has_concentration': False,
                    'holdings': []
                }
            
            sector_data[sector]['value'] += holding.market_value
            sector_data[sector]['holdings_count'] += 1
            sector_data[sector]['holdings'].append({
                'symbol': holding.instrument.symbol,
                'value': round(holding.market_value, 2),
                'pct': 0,
            })
        
        # Calculate percentages and identify concentration
        for sector in sector_data:
            value = sector_data[sector]['value']
            pct = (value / total_value * 100) if total_value > 0 else 0
            sector_data[sector]['pct'] = round(pct, 2)
            sector_data[sector]['has_concentration'] = pct > 30  # Flag if >30%
            
            # Update holding percentages
            for holding in sector_data[sector]['holdings']:
                holding['pct'] = round(holding['value'] / value * 100, 2) if value > 0 else 0
        
        return {
            'total_value': round(total_value, 2),
            'sectors': sector_data,
            'concentration_risk': any(s['has_concentration'] for s in sector_data.values()),
        }
    
    def get_valuation_metrics(self) -> Dict:
        """Calculate PE and valuation metrics"""
        pe_holdings = [h for h in self.holdings if not h.instrument.is_etf and h.instrument.pe_ratio]
        forward_pe_holdings = [h for h in pe_holdings if h.instrument.forward_pe]
        
        if not pe_holdings:
            return {
                'portfolio_pe': None,
                'portfolio_forward_pe': None,
                'benchmark_pe': 20.5,  # Nifty50 approximate PE
                'holdings': [],
            }
        
        # Calculate weighted PE
        total_value = sum(h.market_value for h in pe_holdings)
        weighted_pe = sum(
            h.market_value * h.instrument.pe_ratio 
            for h in pe_holdings if h.instrument.pe_ratio
        ) / total_value if total_value > 0 else None
        
        total_forward_value = sum(h.market_value for h in forward_pe_holdings)
        weighted_forward_pe = sum(
            h.market_value * h.instrument.forward_pe 
            for h in forward_pe_holdings
        ) / total_forward_value if total_forward_value > 0 else None
        
        holdings_pe = [{
            'symbol': h.instrument.symbol,
            'pe': round(h.instrument.pe_ratio, 2) if h.instrument.pe_ratio else None,
            'forward_pe': round(h.instrument.forward_pe, 2) if h.instrument.forward_pe else None,
            'value': round(h.market_value, 2),
        } for h in pe_holdings]
        
        return {
            'portfolio_pe': round(weighted_pe, 2) if weighted_pe else None,
            'portfolio_forward_pe': round(weighted_forward_pe, 2) if weighted_forward_pe else None,
            'benchmark_pe': 20.5,  # Nifty50 benchmark
            'holdings': holdings_pe,
        }
    
    def get_growth_forecast(self) -> Dict:
        """Get analyst growth estimates"""
        holdings_data = []
        weighted_upside_sum = 0.0
        weighted_value = 0.0
        
        for holding in self.holdings:
            if not holding.instrument.is_etf:
                current_price = holding.instrument.current_price or holding.current_price
                target_price = holding.instrument.target_price or current_price
                upside_pct = ((target_price - current_price) / current_price * 100) if current_price > 0 else 0
                market_value = float(holding.market_value)
                weighted_upside_sum += upside_pct * market_value
                weighted_value += market_value
                
                holdings_data.append({
                    'symbol': holding.instrument.symbol,
                    'current_price': round(current_price, 2),
                    'target_price': round(target_price, 2) if target_price else None,
                    'upside_downside_pct': round(upside_pct, 2),
                    'eps_growth': holding.instrument.eps_growth,
                    'revenue_growth': holding.instrument.revenue_growth,
                })
        
        return {
            'holdings': holdings_data,
            'avg_target_upside': round(weighted_upside_sum / weighted_value, 2) if weighted_value > 0 else 0,
        }
    
    def get_promoter_institutional(self) -> Dict:
        """Get promoter and institutional holding data"""
        holdings_data = []
        total_value = sum(h.market_value for h in self.holdings)
        
        for holding in self.holdings:
            if not holding.instrument.is_etf:
                value_pct = (holding.market_value / total_value * 100) if total_value > 0 else 0
                
                holdings_data.append({
                    'symbol': holding.instrument.symbol,
                    'portfolio_pct': round(value_pct, 2),
                    'promoter_holding': holding.instrument.promoter_holding,
                    'fii_holding': holding.instrument.fii_holding,
                    'dii_holding': holding.instrument.dii_holding,
                    'promoter_pledge': holding.instrument.promoter_pledge,
                    'is_risky': (holding.instrument.promoter_holding or 0) < 20 or 
                               (holding.instrument.promoter_pledge or 0) > 10,
                })
        
        return {
            'holdings': holdings_data,
            'risky_count': sum(1 for h in holdings_data if h['is_risky']),
        }
    
    def get_risk_health(self) -> Dict:
        """Assess portfolio risk and health"""
        long_term_qty = sum(h.quantity_long_term for h in self.holdings)
        short_term_qty = sum(h.quantity - h.quantity_long_term for h in self.holdings)
        total_qty = sum(h.quantity for h in self.holdings)
        
        holdings_below_52w = []
        for holding in self.holdings:
            if holding.instrument.high_52w:
                current_price = holding.instrument.current_price or holding.current_price
                pct_below = ((holding.instrument.high_52w - current_price) / 
                           holding.instrument.high_52w * 100)
                if pct_below > 10:
                    holdings_below_52w.append({
                        'symbol': holding.instrument.symbol,
                        'current_price': round(current_price, 2),
                        'high_52w': round(holding.instrument.high_52w, 2),
                        'pct_below': round(pct_below, 2),
                    })
        
        # Diversification score (0-100)
        num_stocks = len(self.holdings)
        top_3_pct = sum(sorted([h.market_value for h in self.holdings], reverse=True)[:3]) / \
                   sum(h.market_value for h in self.holdings) * 100 if self.holdings else 0
        
        # Simple diversification metric
        diversification_score = max(0, min(100, (num_stocks - 2) * 10 - (top_3_pct - 30)))
        
        return {
            'long_term_qty_pct': round(long_term_qty / total_qty * 100, 2) if total_qty > 0 else 0,
            'short_term_qty_pct': round(short_term_qty / total_qty * 100, 2) if total_qty > 0 else 0,
            'diversification_score': round(max(0, min(100, diversification_score)), 2),
            'holdings_below_52w_high': holdings_below_52w,
            'num_holdings': len(self.holdings),
        }
    
    def get_tax_snapshot(self) -> Dict:
        """Calculate tax liability and LTCG exemption usage"""
        ltcg_gains = 0
        stcg_gains = 0
        ltcg_losses = 0
        stcg_losses = 0
        
        for holding in self.holdings:
            pnl = holding.unrealized_pnl
            total_quantity = float(holding.quantity)
            if total_quantity > 0:
                long_term_ratio = min(max(float(holding.quantity_long_term) / total_quantity, 0), 1)
            else:
                long_term_ratio = 1.0 if holding.is_long_term else 0.0
            short_term_ratio = 1 - long_term_ratio

            long_term_pnl = pnl * long_term_ratio
            short_term_pnl = pnl * short_term_ratio

            if long_term_pnl > 0:
                ltcg_gains += long_term_pnl
            elif long_term_pnl < 0:
                ltcg_losses += abs(long_term_pnl)

            if short_term_pnl > 0:
                stcg_gains += short_term_pnl
            elif short_term_pnl < 0:
                stcg_losses += abs(short_term_pnl)
        
        # Apply exemption
        net_stcg_gains = max(0, stcg_gains - stcg_losses)
        remaining_stcg_losses = max(0, stcg_losses - stcg_gains)
        ltcg_after_stcg_setoff = max(0, ltcg_gains - remaining_stcg_losses)
        net_ltcg_gains = max(0, ltcg_after_stcg_setoff - ltcg_losses)

        exemption_used = min(net_ltcg_gains, self.LTCG_EXEMPTION)
        ltcg_taxable = max(0, net_ltcg_gains - exemption_used)
        
        # Calculate tax
        ltcg_tax = ltcg_taxable * self.LTCG_TAX_RATE
        stcg_tax = net_stcg_gains * self.STCG_TAX_RATE
        total_tax = ltcg_tax + stcg_tax
        
        return {
            'ltcg_gains': round(ltcg_gains, 2),
            'ltcg_losses': round(ltcg_losses, 2),
            'stcg_gains': round(stcg_gains, 2),
            'stcg_losses': round(stcg_losses, 2),
            'net_ltcg_gains': round(net_ltcg_gains, 2),
            'net_stcg_gains': round(net_stcg_gains, 2),
            'ltcg_exemption_limit': self.LTCG_EXEMPTION,
            'ltcg_exemption_used': round(exemption_used, 2),
            'ltcg_exemption_remaining': round(max(0, self.LTCG_EXEMPTION - exemption_used), 2),
            'ltcg_tax_rate': self.LTCG_TAX_RATE * 100,
            'stcg_tax_rate': self.STCG_TAX_RATE * 100,
            'estimated_ltcg_tax': round(ltcg_tax, 2),
            'estimated_stcg_tax': round(stcg_tax, 2),
            'total_estimated_tax': round(total_tax, 2),
            'effective_tax_rate': round(total_tax / (net_ltcg_gains + net_stcg_gains) * 100, 2) if (net_ltcg_gains + net_stcg_gains) > 0 else 0,
        }
    
    def _format_holdings(self) -> List[Dict]:
        """Format holdings for display"""
        return [{
            'symbol': h.instrument.symbol,
            'quantity': round(h.quantity, 2),
            'average_price': round(h.average_price, 2),
            'current_price': round(h.current_price, 2),
            'invested_value': round(h.invested_value, 2),
            'market_value': round(h.market_value, 2),
            'unrealized_pnl': round(h.unrealized_pnl, 2),
            'unrealized_pnl_pct': round(h.unrealized_pnl_pct, 2),
        } for h in self.holdings]


def get_analytics_summary() -> dict:
    return {'message': 'Analytics placeholder'}
