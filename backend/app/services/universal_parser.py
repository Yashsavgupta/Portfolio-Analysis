"""
Universal broker CSV/Excel parser.

Detects broker from column headers, normalises rows into canonical schemas,
and classifies each row as a stock holding, MF holding, stock trade, or MF trade
using the ISIN prefix (INF* = mutual fund, INE* / others = equity).
"""
from __future__ import annotations

import csv
import io
import re
from dataclasses import dataclass, field
from datetime import date, datetime
from typing import Any

# ── ISIN classification ───────────────────────────────────────────────────────

MF_KEYWORDS = [
    'fund', 'growth', 'direct', 'regular', 'dividend', 'idcw',
    'liquid', 'gilt', 'debt', 'equity fund', 'hybrid', 'balanced',
    'elss', 'nifty 50', 'sensex', 'index fund', 'etf',
]


def classify_isin(isin: str | None, name: str = '') -> str:
    """Return 'mutual_fund' or 'stock'."""
    if isin and isin.upper().startswith('INF'):
        return 'mutual_fund'
    name_lower = name.lower()
    if any(kw in name_lower for kw in MF_KEYWORDS):
        return 'mutual_fund'
    return 'stock'


# ── Canonical schemas ─────────────────────────────────────────────────────────

@dataclass
class CanonicalHolding:
    symbol: str
    name: str
    isin: str | None
    quantity: float
    avg_cost: float
    current_price: float | None
    current_value: float | None
    instrument_type: str  # 'stock' or 'mutual_fund'
    broker: str
    raw: dict = field(default_factory=dict)


@dataclass
class CanonicalTrade:
    symbol: str
    name: str
    isin: str | None
    trade_date: date
    trade_type: str   # 'buy' or 'sell'
    quantity: float
    price: float
    trade_value: float
    exchange: str | None
    segment: str | None
    series: str | None
    trade_id: str | None
    order_id: str | None
    order_execution_time: str | None
    instrument_type: str  # 'stock' or 'mutual_fund'
    broker: str
    raw: dict = field(default_factory=dict)


# ── Broker fingerprints ───────────────────────────────────────────────────────
# Each entry: { 'name': str, 'headers': set of lowered header substrings that must all be present }

HOLDINGS_BROKERS = [
    {
        'name': 'zerodha',
        'required': {'instrument', 'qty.', 'avg. cost'},
        'col': {
            'symbol':        lambda h: _find(h, ['instrument']),
            'name':          lambda h: _find(h, ['instrument']),
            'isin':          lambda h: _find(h, ['isin']),
            'quantity':      lambda h: _find(h, ['qty.']),
            'avg_cost':      lambda h: _find(h, ['avg. cost']),
            'current_price': lambda h: _find(h, ['ltp']),
            'current_value': lambda h: _find(h, ['cur. val']),
        },
    },
    {
        'name': 'groww',
        'required': {'stock name', 'average price', 'nse symbol'},
        'col': {
            'symbol':        lambda h: _find(h, ['nse symbol', 'bse symbol', 'symbol']),
            'name':          lambda h: _find(h, ['stock name', 'fund name', 'name']),
            'isin':          lambda h: _find(h, ['isin']),
            'quantity':      lambda h: _find(h, ['quantity']),
            'avg_cost':      lambda h: _find(h, ['average price', 'avg price']),
            'current_price': lambda h: _find(h, ['current price', 'ltp']),
            'current_value': lambda h: _find(h, ['current value']),
        },
    },
    {
        'name': 'upstox',
        'required': {'instrument name', 'avg. buy price'},
        'col': {
            'symbol':        lambda h: _find(h, ['symbol', 'instrument name']),
            'name':          lambda h: _find(h, ['instrument name', 'name']),
            'isin':          lambda h: _find(h, ['isin']),
            'quantity':      lambda h: _find(h, ['quantity remaining', 'quantity']),
            'avg_cost':      lambda h: _find(h, ['avg. buy price', 'avg buy price', 'average price']),
            'current_price': lambda h: _find(h, ['ltp', 'current price']),
            'current_value': lambda h: _find(h, ['current value']),
        },
    },
    {
        'name': 'angel_one',
        'required': {'net quantity', 'average price'},
        'col': {
            'symbol':        lambda h: _find(h, ['symbol', 'scrip name']),
            'name':          lambda h: _find(h, ['scrip name', 'symbol']),
            'isin':          lambda h: _find(h, ['isin']),
            'quantity':      lambda h: _find(h, ['net quantity', 'quantity']),
            'avg_cost':      lambda h: _find(h, ['average price', 'avg price']),
            'current_price': lambda h: _find(h, ['ltp', 'current price']),
            'current_value': lambda h: _find(h, ['current value', 'present value']),
        },
    },
    {
        'name': 'hdfc_securities',
        'required': {'scrip name', 'avg rate'},
        'col': {
            'symbol':        lambda h: _find(h, ['scrip name', 'symbol']),
            'name':          lambda h: _find(h, ['scrip name']),
            'isin':          lambda h: _find(h, ['isin']),
            'quantity':      lambda h: _find(h, ['qty', 'quantity']),
            'avg_cost':      lambda h: _find(h, ['avg rate', 'average rate']),
            'current_price': lambda h: _find(h, ['ltp', 'current rate']),
            'current_value': lambda h: _find(h, ['current value', 'market value']),
        },
    },
    {
        'name': 'kuvera',
        'required': {'fund name', 'units', 'folio'},
        'col': {
            'symbol':        lambda h: _find(h, ['scheme code', 'fund name']),
            'name':          lambda h: _find(h, ['fund name']),
            'isin':          lambda h: _find(h, ['isin']),
            'quantity':      lambda h: _find(h, ['units']),
            'avg_cost':      lambda h: _find(h, ['avg nav', 'average nav', 'purchase nav']),
            'current_price': lambda h: _find(h, ['current nav', 'nav']),
            'current_value': lambda h: _find(h, ['current value']),
        },
    },
    # Generic MF holdings snapshot (e.g. our sample CSV format):
    # Fund Name, Fund House, ISIN, Units, NAV, Current Value, Invested Value, Purchase Date, Plan
    {
        'name': 'generic_mf_holdings',
        'required': {'fund name', 'units', 'invested value'},
        'col': {
            'symbol':        lambda h: _find(h, ['fund name', 'scheme name', 'fund']),
            'name':          lambda h: _find(h, ['fund name', 'scheme name', 'fund']),
            'isin':          lambda h: _find(h, ['isin']),
            'quantity':      lambda h: _find(h, ['units', 'balance units']),
            'avg_cost':      lambda h: _find(h, ['nav', 'current nav', 'latest nav']),
            'current_price': lambda h: _find(h, ['nav', 'current nav']),
            'current_value': lambda h: _find(h, ['current value', 'value']),
        },
    },
]

TRADEBOOK_BROKERS = [
    {
        'name': 'zerodha',
        'required': {'trade_type', 'trade_date', 'order_execution_time'},
        'col': {
            'symbol':                lambda h: _find(h, ['symbol']),
            'name':                  lambda h: _find(h, ['symbol']),
            'isin':                  lambda h: _find(h, ['isin']),
            'trade_date':            lambda h: _find(h, ['trade_date']),
            'trade_type':            lambda h: _find(h, ['trade_type']),
            'quantity':              lambda h: _find(h, ['quantity']),
            'price':                 lambda h: _find(h, ['price']),
            'exchange':              lambda h: _find(h, ['exchange']),
            'segment':               lambda h: _find(h, ['segment']),
            'series':                lambda h: _find(h, ['series']),
            'trade_id':              lambda h: _find(h, ['trade_id']),
            'order_id':              lambda h: _find(h, ['order_id']),
            'order_execution_time':  lambda h: _find(h, ['order_execution_time']),
        },
    },
    {
        'name': 'groww',
        'required': {'transaction type', 'trade date', 'scrip name'},
        'col': {
            'symbol':       lambda h: _find(h, ['nse scrip code', 'bse scrip code', 'symbol', 'scrip name']),
            'name':         lambda h: _find(h, ['scrip name', 'name']),
            'isin':         lambda h: _find(h, ['isin']),
            'trade_date':   lambda h: _find(h, ['trade date']),
            'trade_type':   lambda h: _find(h, ['transaction type', 'buy/sell']),
            'quantity':     lambda h: _find(h, ['quantity']),
            'price':        lambda h: _find(h, ['trade price', 'price']),
            'exchange':     lambda h: _find(h, ['exchange']),
            'segment':      lambda h: None,
            'series':       lambda h: None,
            'trade_id':     lambda h: _find(h, ['trade no', 'trade number', 'trade id']),
            'order_id':     lambda h: _find(h, ['order no', 'order number', 'order id']),
            'order_execution_time': lambda h: _find(h, ['trade time', 'time']),
        },
    },
    {
        'name': 'upstox',
        'required': {'action', 'scrip name', 'trade date'},
        'col': {
            'symbol':       lambda h: _find(h, ['symbol', 'scrip name']),
            'name':         lambda h: _find(h, ['scrip name', 'name']),
            'isin':         lambda h: _find(h, ['isin']),
            'trade_date':   lambda h: _find(h, ['trade date']),
            'trade_type':   lambda h: _find(h, ['action', 'buy/sell']),
            'quantity':     lambda h: _find(h, ['quantity']),
            'price':        lambda h: _find(h, ['price', 'trade price']),
            'exchange':     lambda h: _find(h, ['exchange']),
            'segment':      lambda h: _find(h, ['segment']),
            'series':       lambda h: _find(h, ['series']),
            'trade_id':     lambda h: _find(h, ['trade id', 'trade no']),
            'order_id':     lambda h: _find(h, ['order id', 'order no']),
            'order_execution_time': lambda h: _find(h, ['time', 'trade time']),
        },
    },
    {
        'name': 'angel_one',
        'required': {'transaction type', 'order date'},
        'col': {
            'symbol':       lambda h: _find(h, ['symbol', 'scrip name']),
            'name':         lambda h: _find(h, ['scrip name', 'name', 'symbol']),
            'isin':         lambda h: _find(h, ['isin']),
            'trade_date':   lambda h: _find(h, ['trade date', 'order date']),
            'trade_type':   lambda h: _find(h, ['transaction type', 'buy/sell']),
            'quantity':     lambda h: _find(h, ['quantity', 'qty']),
            'price':        lambda h: _find(h, ['price', 'trade price']),
            'exchange':     lambda h: _find(h, ['exchange']),
            'segment':      lambda h: _find(h, ['segment']),
            'series':       lambda h: _find(h, ['series']),
            'trade_id':     lambda h: _find(h, ['trade number', 'trade id', 'trade no']),
            'order_id':     lambda h: _find(h, ['order number', 'order id', 'order no']),
            'order_execution_time': lambda h: _find(h, ['trade time', 'time']),
        },
    },
]


# ── Header utilities ──────────────────────────────────────────────────────────

def _find(headers_lower: list[str], candidates: list[str]) -> str | None:
    """Return first header that contains any candidate substring."""
    for candidate in candidates:
        for h in headers_lower:
            if candidate in h:
                return h
    return None


def _detect_broker(headers: list[str], broker_list: list[dict]) -> dict | None:
    lower = [h.strip().lower() for h in headers]
    for broker in broker_list:
        if all(any(req in h for h in lower) for req in broker['required']):
            return broker
    return None


def _normalise_headers(headers: list[str]) -> list[str]:
    return [h.strip().lower() for h in headers]


# ── Date parsing ──────────────────────────────────────────────────────────────

DATE_FORMATS = [
    '%Y-%m-%d', '%d-%m-%Y', '%d/%m/%Y', '%m/%d/%Y',
    '%d-%b-%Y', '%d %b %Y', '%b %d, %Y', '%Y/%m/%d',
]


def _parse_date(raw: str) -> date | None:
    raw = raw.strip()
    for fmt in DATE_FORMATS:
        try:
            return datetime.strptime(raw, fmt).date()
        except ValueError:
            pass
    # Try truncating datetime strings: "2024-01-15 10:30:00"
    try:
        return datetime.strptime(raw[:10], '%Y-%m-%d').date()
    except ValueError:
        pass
    return None


# ── Float parsing ─────────────────────────────────────────────────────────────

def _float(val: Any) -> float:
    if val is None:
        return 0.0
    try:
        return float(str(val).replace(',', '').replace('₹', '').replace('$', '').strip())
    except (ValueError, TypeError):
        return 0.0


# ── Trade type normalisation ──────────────────────────────────────────────────

def _trade_type(raw: str) -> str | None:
    r = raw.strip().lower()
    if r in ('buy', 'b', 'purchase', 'credit'):
        return 'buy'
    if r in ('sell', 's', 'sale', 'debit'):
        return 'sell'
    return None


# ── CSV content reader ────────────────────────────────────────────────────────

def _read_csv(content: str) -> tuple[list[str], list[dict]]:
    """Return (headers, rows). Skips blank/comment lines before the header."""
    lines = content.splitlines()
    # Find the first line that looks like a header (contains a comma)
    start = 0
    for i, line in enumerate(lines):
        if ',' in line and not line.strip().startswith('#'):
            start = i
            break
    cleaned = '\n'.join(lines[start:])
    reader = csv.DictReader(io.StringIO(cleaned.strip()))
    headers = reader.fieldnames or []
    rows = list(reader)
    return list(headers), rows


# ── Public API ────────────────────────────────────────────────────────────────

class ParseResult:
    def __init__(self):
        self.broker: str = 'unknown'
        self.file_type: str = 'unknown'   # 'holdings' or 'tradebook'
        self.stocks: list[CanonicalHolding | CanonicalTrade] = []
        self.mutual_funds: list[CanonicalHolding | CanonicalTrade] = []
        self.raw_headers: list[str] = []
        self.unrecognised: bool = False
        self.error: str | None = None

    @property
    def all_items(self):
        return self.stocks + self.mutual_funds


def parse_holdings(content: str) -> ParseResult:
    result = ParseResult()
    result.file_type = 'holdings'

    try:
        headers, rows = _read_csv(content)
        result.raw_headers = headers
        lower_headers = _normalise_headers(headers)

        broker = _detect_broker(headers, HOLDINGS_BROKERS)
        if broker is None:
            result.unrecognised = True
            result.broker = 'unknown'
            return result

        result.broker = broker['name']
        col = {k: fn(lower_headers) for k, fn in broker['col'].items()}

        for row in rows:
            # Normalise keys to lowercase for lookup
            row_lower = {k.strip().lower(): v for k, v in row.items()}

            def get(key: str) -> str:
                mapped = col.get(key)
                return row_lower.get(mapped, '') if mapped else ''

            symbol = get('symbol').strip().upper().split(' ')[0]
            name = get('name').strip()
            isin = get('isin').strip() or None
            quantity = _float(get('quantity'))
            avg_cost = _float(get('avg_cost'))

            if not symbol or quantity <= 0:
                continue

            instrument_type = classify_isin(isin, name)
            holding = CanonicalHolding(
                symbol=symbol,
                name=name or symbol,
                isin=isin,
                quantity=quantity,
                avg_cost=avg_cost,
                current_price=_float(get('current_price')) or None,
                current_value=_float(get('current_value')) or None,
                instrument_type=instrument_type,
                broker=broker['name'],
                raw=dict(row),
            )

            if instrument_type == 'mutual_fund':
                result.mutual_funds.append(holding)
            else:
                result.stocks.append(holding)

    except Exception as e:
        result.error = str(e)

    return result


def parse_tradebook(content: str) -> ParseResult:
    result = ParseResult()
    result.file_type = 'tradebook'

    try:
        headers, rows = _read_csv(content)
        result.raw_headers = headers
        lower_headers = _normalise_headers(headers)

        broker = _detect_broker(headers, TRADEBOOK_BROKERS)
        if broker is None:
            result.unrecognised = True
            result.broker = 'unknown'
            return result

        result.broker = broker['name']
        col = {k: fn(lower_headers) for k, fn in broker['col'].items()}

        for row in rows:
            row_lower = {k.strip().lower(): v for k, v in row.items()}

            def get(key: str) -> str:
                mapped = col.get(key)
                return row_lower.get(mapped, '') if mapped else ''

            symbol = get('symbol').strip().upper().split(' ')[0]
            name = get('name').strip()
            isin = get('isin').strip() or None
            trade_date = _parse_date(get('trade_date'))
            trade_type = _trade_type(get('trade_type'))
            quantity = _float(get('quantity'))
            price = _float(get('price'))

            if not symbol or trade_date is None or trade_type is None or quantity <= 0:
                continue

            instrument_type = classify_isin(isin, name)
            trade = CanonicalTrade(
                symbol=symbol,
                name=name or symbol,
                isin=isin,
                trade_date=trade_date,
                trade_type=trade_type,
                quantity=quantity,
                price=price,
                trade_value=round(quantity * price, 2),
                exchange=get('exchange').strip() or None,
                segment=get('segment').strip() or None,
                series=get('series').strip() or None,
                trade_id=get('trade_id').strip() or None,
                order_id=get('order_id').strip() or None,
                order_execution_time=get('order_execution_time').strip() or None,
                instrument_type=instrument_type,
                broker=broker['name'],
                raw=dict(row),
            )

            if instrument_type == 'mutual_fund':
                result.mutual_funds.append(trade)
            else:
                result.stocks.append(trade)

    except Exception as e:
        result.error = str(e)

    return result


def detect_file_type(content: str) -> str:
    """Heuristic: if headers match tradebook brokers, return 'tradebook', else 'holdings'."""
    headers, _ = _read_csv(content)
    if _detect_broker(headers, TRADEBOOK_BROKERS):
        return 'tradebook'
    if _detect_broker(headers, HOLDINGS_BROKERS):
        return 'holdings'
    # Fallback: look for date+buy/sell patterns in first few data lines
    lower = ' '.join(headers).lower()
    if any(w in lower for w in ['trade_type', 'transaction type', 'action', 'buy/sell']):
        return 'tradebook'
    return 'holdings'
