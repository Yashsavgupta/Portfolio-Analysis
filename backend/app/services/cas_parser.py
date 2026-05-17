"""
CAS (Consolidated Account Statement) CSV parser.

Supports CAMS mailback, KFintech, Kuvera, Groww, and generic CSV exports.
"""
from __future__ import annotations

import csv
import io
import re
from datetime import date, datetime
from typing import Optional

# ─── Type normalisation map ──────────────────────────────────────────────────

BUY_TYPES = {
    "purchase", "p", "new purchase", "sip", "additional purchase",
    "buy", "buy", "subscription", "nfo allotment", "allotment",
    "sip investment", "systematic investment plan",
    "invest", "investment", "lumpsum", "lump sum",
}

SELL_TYPES = {
    "redemption", "r", "redeem", "sell", "switch out", "switch-out",
    "swo", "withdrawal", "swp", "systematic withdrawal plan",
}

SWITCH_IN_TYPES = {
    "switch in", "switch-in", "swi",
}

DIVIDEND_REINVEST_TYPES = {
    "dividend reinvestment", "div reinvest", "idcw reinvestment",
    "idcw - reinvestment", "dividend reinvest",
}

DIVIDEND_PAYOUT_TYPES = {
    "dividend payout", "idcw payout", "dividend", "idcw",
    "idcw - payout",
}


def _normalise_type(raw: str) -> str:
    """Map raw transaction type string to canonical type."""
    cleaned = raw.strip().lower()
    if cleaned in BUY_TYPES:
        return "buy"
    if cleaned in SELL_TYPES:
        return "sell"
    if cleaned in SWITCH_IN_TYPES:
        return "switch_in"
    if cleaned in DIVIDEND_REINVEST_TYPES:
        return "dividend_reinvest"
    if cleaned in DIVIDEND_PAYOUT_TYPES:
        return "dividend_payout"
    # Fallback: partial match
    if any(t in cleaned for t in ["sip", "purchase", "buy", "invest", "allotment", "subscription"]):
        return "buy"
    if any(t in cleaned for t in ["redeem", "sell", "withdrawal", "switch out"]):
        return "sell"
    if "switch in" in cleaned or "switch-in" in cleaned:
        return "switch_in"
    if "reinvest" in cleaned:
        return "dividend_reinvest"
    if "dividend" in cleaned or "idcw" in cleaned:
        return "dividend_payout"
    return "buy"  # safe default


# ─── Date parsing ────────────────────────────────────────────────────────────

_DATE_FORMATS = [
    "%d-%m-%Y",       # 01-01-2020
    "%d/%m/%Y",       # 01/01/2020
    "%Y-%m-%d",       # 2020-01-01
    "%d %b %Y",       # 01 Jan 2020
    "%d-%b-%Y",       # 01-Jan-2020
    "%d %B %Y",       # 01 January 2020
    "%d-%B-%Y",       # 01-January-2020
    "%d/%b/%Y",       # 01/Jan/2020
    "%Y/%m/%d",       # 2020/01/01
    "%m/%d/%Y",       # 01/13/2020 (US — less common but handle)
]


def _parse_date(s: str) -> Optional[date]:
    s = s.strip()
    for fmt in _DATE_FORMATS:
        try:
            return datetime.strptime(s, fmt).date()
        except ValueError:
            continue
    return None


def _parse_float(s: str) -> Optional[float]:
    if not s:
        return None
    # Remove currency symbols, commas, spaces
    cleaned = re.sub(r'[₹,\s]', '', s.strip())
    try:
        return float(cleaned)
    except ValueError:
        return None


# ─── Format detection ────────────────────────────────────────────────────────

def detect_cas_format(headers: list[str]) -> str:
    """Return 'cams' | 'kfintech' | 'kuvera' | 'groww' | 'generic'."""
    h = {c.strip().lower() for c in headers}

    # CAMS: has "transaction type" or "type" + "amount (rs.)" + "price (rs.)"
    if ("transaction type" in h or "type" in h) and (
        "amount (rs.)" in h or "price (rs.)" in h
    ):
        if "folio no" in h and "scheme name" in h:
            return "cams"

    # KFintech: has "trans date" or "trans type"
    if "trans date" in h or "trans type" in h:
        return "kfintech"

    # Kuvera: has "fund" (not "scheme name") + "amount (inr)" or "nav (inr)"
    if "fund" in h and ("amount (inr)" in h or "nav (inr)" in h):
        return "kuvera"

    # Groww: has "amount (₹)" or "nav (₹)"
    if "amount (₹)" in h or "nav (₹)" in h or "amount (rs.)" in h or "nav (rs.)" in h:
        if "scheme name" in h:
            return "groww"

    return "generic"


# ─── Column resolution per format ────────────────────────────────────────────

def _resolve_columns(headers: list[str], source: str) -> dict[str, Optional[str]]:
    """Return a mapping from canonical field → actual CSV header."""
    h_lower = {c.strip().lower(): c for c in headers}

    def pick(*candidates: str) -> Optional[str]:
        for c in candidates:
            if c.lower() in h_lower:
                return h_lower[c.lower()]
        return None

    return {
        "fund_name":   pick("scheme name", "fund", "scheme"),
        "folio":       pick("folio no", "folio"),
        "isin":        pick("isin"),
        "date":        pick("transaction date", "trans date", "date"),
        "type":        pick("transaction type", "trans type", "type"),
        "amount":      pick("amount (rs.)", "amount (inr)", "amount (₹)", "amount (rs)", "amount"),
        "units":       pick("units"),
        "nav":         pick("price (rs.)", "nav (inr)", "nav (₹)", "nav (rs.)", "nav", "price"),
    }


# ─── Main parser ─────────────────────────────────────────────────────────────

def parse_cas_csv(content: str) -> dict:
    """
    Parse a CAS CSV (CAMS, KFintech, Kuvera, Groww, or generic).

    Returns:
        {
          'source': str,
          'transactions': list[dict],
          'total_rows': int,
          'skipped_rows': int,
          'date_from': str | None,
          'date_to': str | None,
          'funds': list[str],
          'preview': list[dict],
          'raw_headers': list[str],
        }
    """
    # Strip BOM if present
    content = content.lstrip('﻿')

    # Detect encoding issues (replace any remaining bad chars)
    reader = csv.DictReader(io.StringIO(content))
    raw_headers: list[str] = reader.fieldnames or []

    source = detect_cas_format(raw_headers)
    col = _resolve_columns(raw_headers, source)

    transactions: list[dict] = []
    skipped = 0
    dates: list[date] = []
    fund_set: set[str] = set()

    for row_num, row in enumerate(reader, start=2):  # 2 because row 1 is header
        try:
            # Extract raw values
            raw_fund  = row.get(col["fund_name"] or "", "").strip() if col["fund_name"] else ""
            raw_folio = row.get(col["folio"] or "", "").strip() if col["folio"] else None
            raw_isin  = row.get(col["isin"] or "", "").strip() if col["isin"] else None
            raw_date  = row.get(col["date"] or "", "").strip() if col["date"] else ""
            raw_type  = row.get(col["type"] or "", "").strip() if col["type"] else ""
            raw_amt   = row.get(col["amount"] or "", "").strip() if col["amount"] else ""
            raw_units = row.get(col["units"] or "", "").strip() if col["units"] else ""
            raw_nav   = row.get(col["nav"] or "", "").strip() if col["nav"] else None

            # Skip blank / summary rows
            if not raw_fund and not raw_date and not raw_amt:
                skipped += 1
                continue
            if not raw_fund:
                skipped += 1
                continue

            # Skip summary or total lines
            fund_lower = raw_fund.lower()
            if any(kw in fund_lower for kw in ["total", "grand total", "sub total", "summary"]):
                skipped += 1
                continue

            txn_date = _parse_date(raw_date) if raw_date else None
            if txn_date is None:
                skipped += 1
                continue

            amount = _parse_float(raw_amt)
            units_val = _parse_float(raw_units)

            # Skip rows with no meaningful amount or units
            if (amount is None or amount <= 0) and (units_val is None or units_val <= 0):
                skipped += 1
                continue

            amount = amount or 0.0
            units_val = units_val or 0.0
            nav_val = _parse_float(raw_nav) if raw_nav else None

            txn_type = _normalise_type(raw_type)

            isin = raw_isin if raw_isin and len(raw_isin) >= 10 else None
            folio = raw_folio if raw_folio else None

            dates.append(txn_date)
            fund_set.add(raw_fund)

            transactions.append({
                "fund_name":        raw_fund,
                "folio":            folio,
                "isin":             isin,
                "transaction_date": txn_date,
                "transaction_type": txn_type,
                "raw_type":         raw_type,
                "amount":           amount,
                "units":            units_val,
                "nav":              nav_val,
            })

        except Exception:
            skipped += 1
            continue

    date_from = min(dates).isoformat() if dates else None
    date_to   = max(dates).isoformat() if dates else None

    # Map source string to canonical source tag
    source_tag = {
        "cams":     "cas_cams",
        "kfintech": "cas_kfintech",
        "kuvera":   "kuvera",
        "groww":    "groww",
        "generic":  "generic",
    }.get(source, "generic")

    preview = []
    for t in transactions[:5]:
        preview.append({
            "fund_name":        t["fund_name"][:40] + ("…" if len(t["fund_name"]) > 40 else ""),
            "date":             t["transaction_date"].isoformat(),
            "type":             t["transaction_type"],
            "amount":           t["amount"],
            "units":            t["units"],
            "nav":              t["nav"],
        })

    return {
        "source":       source_tag,
        "transactions": transactions,
        "total_rows":   len(transactions),
        "skipped_rows": skipped,
        "date_from":    date_from,
        "date_to":      date_to,
        "funds":        sorted(fund_set),
        "preview":      preview,
        "raw_headers":  raw_headers,
    }
