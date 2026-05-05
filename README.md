# Portfolio Evaluator

Portfolio Evaluator is a full-stack portfolio analysis app with a Next.js frontend and a FastAPI backend. It supports user authentication, Zerodha holdings import from Excel, imported-portfolio analytics, market-data refresh, and Zerodha account/API credential flows.

## Current State

- Local development flow is working.
- Backend migrations and health endpoint are verified.
- Frontend lint and production build are verified.
- The holdings upload flow from `.xlsx` to analytics is working.
- Zerodha OAuth and API-key flows are wired, but they depend on valid Zerodha credentials and external service availability.

## Stack

- Frontend: Next.js `14.2.35`, React `18`, TypeScript, Tailwind CSS, Recharts
- Backend: FastAPI, SQLAlchemy `2`, Alembic, Pydantic `2`
- Data: SQLite by default, PostgreSQL supported through `DATABASE_URL`
- Integrations: Zerodha, `yfinance`, `openpyxl`

## Repository Layout

```text
.
├── backend/                  FastAPI app, models, services, migrations
├── frontend/                 Next.js app, API proxy routes, UI
├── sample_holdings.xlsx      Sample Zerodha holdings export
├── README.md                 Project overview
├── SETUP_GUIDE.md            Full local setup and run guide
├── QUICK_REFERENCE.md        Commands, URLs, and common workflows
├── VERIFICATION_CHECKLIST.md Verification steps
└── DOCUMENTATION_INDEX.md    Documentation map
```

## What the App Does

### User-facing flows

- Sign up and log in
- Upload a Zerodha holdings export at `/import-mutual-funds`
- Review imported analytics at `/analytics/[portfolio_id]`
- Open the main dashboard at `/portfolio/total`
- Filter the dashboard into stock and mutual-fund views
- Save Zerodha API keys and start the connect flow

### Backend capabilities

- JWT-based authentication
- Imported portfolio creation from Excel
- Portfolio dashboard aggregation
- Market-data refresh for imported instruments
- Zerodha status, OAuth completion, holdings, orders, and positions endpoints

## Quick Start

### 1. Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
alembic upgrade head
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

### 2. Frontend

```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev
```

### 3. Open the app

- Frontend: `http://127.0.0.1:3000`
- Backend API: `http://127.0.0.1:8000`
- API docs: `http://127.0.0.1:8000/docs`

## Environment Files

### Backend: `backend/.env`

```env
DATABASE_URL=sqlite:///./portfolio_evaluator.db
SECRET_KEY=change-me
API_PREFIX=/api
ZERODHA_API_KEY=
ZERODHA_API_SECRET=
```

### Frontend: `frontend/.env.local`

```env
NEXT_PUBLIC_BACKEND_URL=http://127.0.0.1:8000
```

Notes:

- SQLite is the default local database.
- To use PostgreSQL, replace `DATABASE_URL` with a Postgres connection string.
- The frontend uses same-origin `/api/*` route handlers and proxies to the backend URL above.

## Main Routes

### Frontend

- `/`
- `/signup`
- `/login`
- `/portfolio`
- `/portfolio/total`
- `/portfolio/stocks`
- `/portfolio/mutual-funds`
- `/import-mutual-funds`
- `/analytics/[portfolio_id]`
- `/zerodha-api-keys`
- `/zerodha-connect`

Notes:

- `/portfolio` redirects into the main dashboard flow.
- `/portfolio/comparison` and `/portfolio/pseudo-fund` currently redirect to `/portfolio/total`.

### Backend

Authentication:

- `POST /api/auth/signup`
- `POST /api/auth/login`
- `GET /api/auth/me`

Portfolio and market data:

- `GET /api/portfolios/`
- `GET /api/portfolios/dashboard`
- `POST /api/market-data/refresh/{portfolio_id}`
- `GET /api/market-data/symbol/{symbol}`

Imported holdings and analytics:

- `POST /api/import/upload-holdings`
- `GET /api/import/analytics/overview/{portfolio_id}`
- `GET /api/import/analytics/sectors/{portfolio_id}`
- `GET /api/import/analytics/valuation/{portfolio_id}`
- `GET /api/import/analytics/growth/{portfolio_id}`
- `GET /api/import/analytics/promoter/{portfolio_id}`
- `GET /api/import/analytics/risk/{portfolio_id}`
- `GET /api/import/analytics/tax/{portfolio_id}`

Zerodha:

- `GET /api/zerodha/status`
- `POST /api/zerodha/connect`
- `POST /api/zerodha/connect/complete`
- `GET /api/zerodha/holdings`
- `GET /api/zerodha/orders`
- `GET /api/zerodha/api-keys`
- `POST /api/zerodha/api-keys`

## Verification Commands

From the repository root:

```bash
./.venv/bin/pytest
```

From `backend/`:

```bash
./.venv/bin/alembic upgrade head
./.venv/bin/python -c "from app.main import app; print(app.title)"
curl http://127.0.0.1:8000/health
```

From `frontend/`:

```bash
npm run lint
npm run build
```

## Production Notes

- The frontend currently stores the auth token in browser-managed storage and mirrors it into a cookie for the Next proxy routes. A move to `HttpOnly` cookie auth is still a worthwhile follow-up.
- Framework-level `npm audit` findings on Next.js now require a major-version upgrade beyond the current `14.x` line.
- The most important runtime flows are verified, but automated test coverage is still light.

## Documentation

- [SETUP_GUIDE.md](SETUP_GUIDE.md): full setup, environment, and run instructions
- [QUICK_REFERENCE.md](QUICK_REFERENCE.md): commands, URLs, and maintenance tasks
- [VERIFICATION_CHECKLIST.md](VERIFICATION_CHECKLIST.md): verification steps before shipping
- [backend/README.md](backend/README.md): backend-focused runbook
- [IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md): architecture and feature summary
- [PROJECT_COMPLETION_REPORT.md](PROJECT_COMPLETION_REPORT.md): current status and remaining follow-ups
- [DOCUMENTATION_INDEX.md](DOCUMENTATION_INDEX.md): documentation map
