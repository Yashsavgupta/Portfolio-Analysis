# Portfolio Evaluator Setup Guide

This guide describes the current local-development path for the app as it exists today.

## Prerequisites

- Python `3.10+`
- Node.js `18+`
- `npm`
- Optional: PostgreSQL if you do not want to use the default SQLite setup

## 1. Backend Setup

### 1.1 Create the environment

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### 1.2 Configure environment variables

```bash
cp .env.example .env
```

Default `backend/.env`:

```env
DATABASE_URL=sqlite:///./portfolio_evaluator.db
SECRET_KEY=change-me
API_PREFIX=/api
ZERODHA_API_KEY=
ZERODHA_API_SECRET=
```

Notes:

- The default SQLite path is good for local development.
- To use PostgreSQL instead, replace `DATABASE_URL` with a Postgres connection string.
- `ZERODHA_API_KEY` and `ZERODHA_API_SECRET` are optional unless you want the Zerodha connect flow to work.

### 1.3 Run database migrations

```bash
alembic upgrade head
```

### 1.4 Start the backend

```bash
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

Backend URLs:

- API: `http://127.0.0.1:8000`
- Docs: `http://127.0.0.1:8000/docs`
- Health: `http://127.0.0.1:8000/health`

## 2. Frontend Setup

### 2.1 Install dependencies

```bash
cd frontend
npm install
```

### 2.2 Configure environment variables

```bash
cp .env.example .env.local
```

Default `frontend/.env.local`:

```env
NEXT_PUBLIC_BACKEND_URL=http://127.0.0.1:8000
```

Notes:

- Frontend client code talks to same-origin Next route handlers under `/api/*`.
- Those route handlers proxy to `NEXT_PUBLIC_BACKEND_URL`.

### 2.3 Start the frontend

```bash
npm run dev
```

Frontend URL:

- App: `http://127.0.0.1:3000`

## 3. First Local Verification

### Backend

```bash
curl http://127.0.0.1:8000/health
```

Expected response:

```json
{"status":"ok"}
```

### Frontend

Open:

- `http://127.0.0.1:3000`
- `http://127.0.0.1:3000/login`
- `http://127.0.0.1:3000/signup`

### Build and lint

```bash
cd frontend
npm run lint
npm run build
```

## 4. Default User Flow

### 4.1 Create an account

Use either:

- the UI at `/signup`, or
- the API directly:

```bash
curl -X POST "http://127.0.0.1:8000/api/auth/signup" \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"pass123","full_name":"Test User"}'
```

### 4.2 Log in

```bash
curl -X POST "http://127.0.0.1:8000/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"pass123"}'
```

### 4.3 Upload sample holdings

Use the UI:

- open `http://127.0.0.1:3000/import-mutual-funds`
- upload `sample_holdings.xlsx`

Or use the API:

```bash
curl -X POST "http://127.0.0.1:8000/api/import/upload-holdings" \
  -H "Authorization: Bearer TOKEN_HERE" \
  -F "file=@sample_holdings.xlsx"
```

### 4.4 Review analytics

- Imported analytics page: `/analytics/[portfolio_id]`
- Main dashboard: `/portfolio/total`
- Filtered dashboard views:
  - `/portfolio/stocks`
  - `/portfolio/mutual-funds`

## 5. Zerodha Setup

You have two supported paths:

### Option A: Save API credentials first

1. Open `/zerodha-api-keys`
2. Save the API key
3. Save the API secret
4. Open `/zerodha-connect`
5. Start the connect flow

### Option B: Use backend environment variables

Set these in `backend/.env`:

```env
ZERODHA_API_KEY=...
ZERODHA_API_SECRET=...
```

Then open `/zerodha-connect`.

## 6. Optional Docker Compose Flow

The repository includes `docker-compose.yml` for a simple two-container setup:

```bash
docker compose up --build
```

Expected URLs:

- Frontend: `http://127.0.0.1:3000`
- Backend: `http://127.0.0.1:8000`

Notes:

- Compose uses SQLite by default.
- The backend container runs `alembic upgrade head` before starting the API.

## 7. Common Maintenance Commands

### Re-run backend migrations

```bash
cd backend
source .venv/bin/activate
alembic upgrade head
```

### Reset local SQLite database

```bash
cd backend
rm -f portfolio_evaluator.db
alembic upgrade head
```

### Clean frontend build output

```bash
cd frontend
rm -rf .next
```

### Rebuild the frontend for production

```bash
cd frontend
npm run build
npm run start -- --hostname 127.0.0.1 --port 3000
```

## 8. Troubleshooting

### `alembic upgrade head` fails with import errors

- Run it from `backend/`
- Make sure the backend virtual environment is active

### Frontend login works but authenticated API calls fail

- Make sure the backend is running on `127.0.0.1:8000`
- Check `frontend/.env.local`
- Clear browser storage and sign in again

### Upload fails

- Confirm the file ends in `.xlsx`
- Start with `sample_holdings.xlsx`
- Check backend logs for parser errors

### Zerodha connect fails immediately

- Confirm a valid API key is available either in `backend/.env` or via `/zerodha-api-keys`
- Confirm the API secret exists before finishing the OAuth flow

### `npm run build` fails

- Reinstall dependencies with `npm install`
- Delete `.next`
- Re-run `npm run lint` first
