# Portfolio Evaluator Quick Reference

## Local Run Commands

### Backend

```bash
cd backend
source .venv/bin/activate
alembic upgrade head
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

### Frontend

```bash
cd frontend
npm run dev
```

### Production-style frontend run

```bash
cd frontend
npm run build
npm run start -- --hostname 127.0.0.1 --port 3000
```

## URLs

- Frontend: `http://127.0.0.1:3000`
- Backend API: `http://127.0.0.1:8000`
- Backend docs: `http://127.0.0.1:8000/docs`
- Health: `http://127.0.0.1:8000/health`

## Main App Routes

- `/`
- `/signup`
- `/login`
- `/portfolio/total`
- `/portfolio/stocks`
- `/portfolio/mutual-funds`
- `/import-mutual-funds`
- `/analytics/[portfolio_id]`
- `/zerodha-api-keys`
- `/zerodha-connect`

## Core API Endpoints

Authentication:

```text
POST /api/auth/signup
POST /api/auth/login
GET  /api/auth/me
```

Portfolio dashboard:

```text
GET  /api/portfolios/
GET  /api/portfolios/dashboard
POST /api/market-data/refresh/{portfolio_id}
GET  /api/market-data/symbol/{symbol}
```

Import and analytics:

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

## Smoke Tests

### Health

```bash
curl http://127.0.0.1:8000/health
```

### Sign up

```bash
curl -X POST "http://127.0.0.1:8000/api/auth/signup" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"pass123","full_name":"Test User"}'
```

### Log in

```bash
curl -X POST "http://127.0.0.1:8000/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"pass123"}'
```

### Fetch dashboard

```bash
curl -X GET "http://127.0.0.1:8000/api/portfolios/dashboard" \
  -H "Authorization: Bearer TOKEN_HERE"
```

### Upload sample holdings

```bash
curl -X POST "http://127.0.0.1:8000/api/import/upload-holdings" \
  -H "Authorization: Bearer TOKEN_HERE" \
  -F "file=@sample_holdings.xlsx"
```

## Verification Commands

### Repository root

```bash
./.venv/bin/pytest
```

### Backend

```bash
cd backend
./.venv/bin/alembic upgrade head
./.venv/bin/python -c "from app.main import app; print(app.title)"
```

### Frontend

```bash
cd frontend
npm run lint
npm run build
```

## Reset and Cleanup

### Reset SQLite database

```bash
cd backend
rm -f portfolio_evaluator.db
alembic upgrade head
```

### Clear Next build cache

```bash
cd frontend
rm -rf .next
```

### Reinstall frontend packages

```bash
cd frontend
rm -rf node_modules package-lock.json
npm install
```

## Important Files

### Environment

- `backend/.env`
- `backend/.env.example`
- `frontend/.env.local`
- `frontend/.env.example`
- `.env.example`

### Backend

- `backend/app/main.py`
- `backend/app/core/config.py`
- `backend/app/core/security.py`
- `backend/app/api/api.py`
- `backend/app/api/routes/`
- `backend/app/services/`
- `backend/alembic/versions/`

### Frontend

- `frontend/app/layout.tsx`
- `frontend/app/api/`
- `frontend/app/portfolio/`
- `frontend/components/portfolio/PortfolioDashboard.tsx`
- `frontend/components/holdings/HoldingsUpload.tsx`
- `frontend/lib/api.ts`
- `frontend/lib/auth.ts`

## Current Caveats

- Auth tokens are still stored in browser-managed storage.
- Zerodha features require valid credentials and external connectivity.
- Automated test coverage is lighter than the production build and lint checks.
