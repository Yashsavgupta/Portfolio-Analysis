# Holdings Upload Feature

This document covers the current imported-holdings flow.

## Summary

The feature accepts a Zerodha holdings export in `.xlsx` format, creates an imported portfolio, stores instruments and holdings, and exposes analytics for the imported portfolio.

## User Flow

1. Sign in
2. Open `/import-mutual-funds`
3. Upload a Zerodha `.xlsx` holdings export
4. Review the success summary
5. Open `/analytics/[portfolio_id]`
6. Optionally review the main dashboard at `/portfolio/total`

## Frontend Pieces

- `frontend/app/import-mutual-funds/page.tsx`
  Entry page for the upload flow.

- `frontend/components/holdings/HoldingsUpload.tsx`
  Upload UI, validation, success summary, and analytics CTA.

- `frontend/app/analytics/[id]/page.tsx`
  Imported analytics page.

- `frontend/components/analytics/AnalyticsCards.tsx`
  Card components for imported analytics endpoints.

## Backend Pieces

- `backend/app/api/routes/import_holdings.py`
  Upload endpoint plus imported analytics endpoints.

- `backend/app/services/excel_parser.py`
  Parses the workbook summary block and holdings table.

- `backend/app/services/analytics_service.py`
  Calculates imported-portfolio analytics outputs.

- `backend/app/models/holdings_import.py`
  Stores upload metadata.

## API Surface

```text
POST /api/import/upload-holdings
GET  /api/import/analytics/overview/{portfolio_id}
GET  /api/import/analytics/sectors/{portfolio_id}
GET  /api/import/analytics/valuation/{portfolio_id}
GET  /api/import/analytics/growth/{portfolio_id}
GET  /api/import/analytics/promoter/{portfolio_id}
GET  /api/import/analytics/risk/{portfolio_id}
GET  /api/import/analytics/tax/{portfolio_id}
```

## Input Expectations

- File type must be `.xlsx`
- The parser currently expects the structure of a Zerodha holdings export
- The workbook must contain both the summary section and the holdings table in the expected layout

## What Gets Created

On a successful upload the backend:

- creates a new `Portfolio`
- creates or reuses `Instrument` rows by symbol
- creates `Holding` rows for the imported positions
- creates a `HoldingsImport` record with upload metadata

## Output Available After Upload

Imported analytics endpoints currently expose:

- portfolio overview
- sector segmentation
- valuation metrics
- growth forecast
- promoter and institutional data
- risk health
- tax snapshot

## Local Test Path

Backend:

```bash
cd backend
source .venv/bin/activate
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

Frontend:

```bash
cd frontend
npm run dev
```

Then:

- sign in
- open `/import-mutual-funds`
- upload `sample_holdings.xlsx`
- confirm the success summary appears
- open the analytics page from the success button

## Known Caveats

- The parser is tuned to Zerodha exports rather than arbitrary broker files.
- The upload path is strong for local use, but broader integration test coverage would still be helpful.
- The main dashboard and imported analytics are related but separate surfaces with different endpoint families.
