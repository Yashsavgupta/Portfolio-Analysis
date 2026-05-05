# Implementation Summary

This document summarizes the current architecture and feature surface of Portfolio Evaluator.

## Overview

Portfolio Evaluator is split into:

- a Next.js frontend under `frontend/`
- a FastAPI backend under `backend/`
- SQLite by default for local persistence
- same-origin frontend API proxy routes that forward to the backend

## Current Feature Set

### Authentication

- User signup
- User login
- Protected backend endpoints
- Frontend route guarding for portfolio pages

Relevant files:

- `backend/app/api/routes/auth.py`
- `backend/app/core/security.py`
- `backend/app/services/auth_service.py`
- `frontend/hooks/useAuth.ts`
- `frontend/lib/auth.ts`
- `frontend/app/login/page.tsx`
- `frontend/app/signup/page.tsx`

### Imported Holdings Flow

- Upload Zerodha `.xlsx` holdings exports
- Parse workbook summary and holdings rows
- Create a portfolio and holdings records
- Open imported analytics

Relevant files:

- `backend/app/services/excel_parser.py`
- `backend/app/api/routes/import_holdings.py`
- `backend/app/models/holdings_import.py`
- `frontend/components/holdings/HoldingsUpload.tsx`
- `frontend/app/import-mutual-funds/page.tsx`
- `frontend/app/analytics/[id]/page.tsx`

### Main Portfolio Dashboard

- Portfolio summary metrics
- Benchmark comparison
- Sector allocation
- Risk metrics
- Holdings table with derived metrics and signals
- Market commentary and data-gap notes

Relevant files:

- `backend/app/services/portfolio_dashboard_service.py`
- `backend/app/api/routes/portfolios.py`
- `backend/app/services/market_data_service.py`
- `frontend/components/portfolio/PortfolioDashboard.tsx`
- `frontend/app/portfolio/total/page.tsx`
- `frontend/app/portfolio/stocks/page.tsx`
- `frontend/app/portfolio/mutual-funds/page.tsx`

### Zerodha Integration

- Save API credentials per user
- Start connect flow
- Complete OAuth callback
- Query status, holdings, orders, and positions

Relevant files:

- `backend/app/api/routes/zerodha.py`
- `backend/app/services/zerodha_service.py`
- `backend/app/models/zerodha_account.py`
- `frontend/app/zerodha-api-keys/page.tsx`
- `frontend/app/zerodha-connect/page.tsx`
- `frontend/components/dashboard/ZerodhaConnectButton.tsx`

## Backend Architecture

### Routing

The backend router is assembled in `backend/app/api/api.py`.

Primary route groups:

- `auth`
- `portfolios`
- `holdings`
- `analytics`
- `zerodha`
- `import`
- `market-data`

### Models

Key SQLAlchemy models:

- `User`
- `Portfolio`
- `Holding`
- `Instrument`
- `HoldingsImport`
- `MutualFundImport`
- `PortfolioSnapshot`
- `ZerodhaAccount`

### Services

The backend uses a service-oriented pattern:

- `auth_service.py`: user creation and login logic
- `excel_parser.py`: workbook parsing
- `analytics_service.py`: imported-holdings analytics
- `portfolio_dashboard_service.py`: dashboard aggregation
- `market_data_service.py`: market-data fetch and refresh
- `zerodha_service.py`: Zerodha credential and API flow

## Frontend Architecture

### Routing

The frontend uses the Next.js App Router.

Important routes:

- `/`
- `/login`
- `/signup`
- `/portfolio/total`
- `/portfolio/stocks`
- `/portfolio/mutual-funds`
- `/import-mutual-funds`
- `/analytics/[id]`
- `/zerodha-api-keys`
- `/zerodha-connect`

Legacy placeholder routes now redirect back into the main dashboard flow:

- `/portfolio/comparison`
- `/portfolio/pseudo-fund`

### API Proxy Layer

The frontend talks to same-origin route handlers under `frontend/app/api/`.

These handlers:

- read the browser token cookie when needed
- proxy requests to the backend
- preserve backend status codes and response bodies

This keeps frontend code on `/api/*` while still reaching the backend service.

### Client State

- `useAuth` handles user/bootstrap state
- local browser storage holds the current token
- route components fetch data on mount and display loading, error, or success states

## Data Flow

### Import to Analytics

1. User uploads a Zerodha workbook
2. Backend saves the file temporarily
3. Parser extracts summary and holdings rows
4. Backend creates instruments, holdings, and import metadata
5. Frontend opens the imported analytics page

### Dashboard

1. Frontend requests `/api/portfolios/dashboard`
2. Backend loads the latest user portfolio
3. Dashboard service computes summary, history, sectors, holdings, fundamentals, and commentary
4. Frontend renders the portfolio dashboard and filtered views

### Market Data Refresh

1. Frontend requests a market-data refresh
2. Backend resolves instruments to candidate tickers
3. `yfinance` is queried
4. Instrument records are updated and persisted

## Configuration

### Backend

Required:

- `DATABASE_URL`
- `SECRET_KEY`

Optional:

- `API_PREFIX`
- `ZERODHA_API_KEY`
- `ZERODHA_API_SECRET`

### Frontend

Optional but recommended:

- `NEXT_PUBLIC_BACKEND_URL`

## Verified Today

The following checks were run successfully against the current codebase:

- backend app import
- backend health check
- backend migrations
- root smoke tests via `pytest`
- frontend lint
- frontend production build

## Known Follow-ups

- Move auth away from localStorage toward `HttpOnly` cookies or another stronger session model.
- Upgrade from Next.js `14.x` to `16.x` to clear the remaining framework-level audit items.
- Add deeper backend and end-to-end test coverage.
