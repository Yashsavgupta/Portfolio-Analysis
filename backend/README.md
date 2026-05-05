# Backend Runbook

This document covers the FastAPI backend only.

## Stack

- FastAPI
- SQLAlchemy `2`
- Alembic
- Pydantic `2`
- SQLite by default
- Optional PostgreSQL via `DATABASE_URL`

## Local Setup

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
alembic upgrade head
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

Backend URLs:

- API: `http://127.0.0.1:8000`
- Docs: `http://127.0.0.1:8000/docs`
- Health: `http://127.0.0.1:8000/health`

## Environment Variables

Default `backend/.env`:

```env
DATABASE_URL=sqlite:///./portfolio_evaluator.db
SECRET_KEY=change-me
API_PREFIX=/api
ZERODHA_API_KEY=
ZERODHA_API_SECRET=
```

Notes:

- `DATABASE_URL` may point to SQLite or PostgreSQL.
- `ZERODHA_API_KEY` and `ZERODHA_API_SECRET` are optional unless you need the connect flow.

## Database and Migrations

Apply the current schema:

```bash
alembic upgrade head
```

Reset the local SQLite database:

```bash
rm -f portfolio_evaluator.db
alembic upgrade head
```

Create a new migration:

```bash
alembic revision --autogenerate -m "describe change"
```

## Important Modules

- `app/main.py`: FastAPI app entrypoint
- `app/core/config.py`: settings
- `app/core/security.py`: JWT and password hashing
- `app/api/api.py`: router assembly
- `app/api/routes/`: HTTP endpoints
- `app/services/`: business logic
- `app/models/`: SQLAlchemy models
- `alembic/`: migration scripts

## Endpoint Overview

Authentication:

```text
POST /api/auth/signup
POST /api/auth/login
GET  /api/auth/me
```

Portfolio:

```text
GET /api/portfolios/
GET /api/portfolios/dashboard
```

Imported holdings and analytics:

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

Market data:

```text
GET  /api/market-data/symbol/{symbol}
POST /api/market-data/refresh/{portfolio_id}
```

Zerodha:

```text
GET  /api/zerodha/status
POST /api/zerodha/connect
POST /api/zerodha/connect/complete
GET  /api/zerodha/holdings
GET  /api/zerodha/orders
GET  /api/zerodha/api-keys
POST /api/zerodha/api-keys
```

## Quick Checks

Health:

```bash
curl http://127.0.0.1:8000/health
```

App import:

```bash
./.venv/bin/python -c "from app.main import app; print(app.title)"
```

## Current Caveats

- Auth still depends on browser-managed tokens from the frontend side.
- Zerodha flows are only as reliable as the user-provided credentials and the external API.
- There is not yet deep automated backend test coverage beyond smoke checks and runtime verification.
