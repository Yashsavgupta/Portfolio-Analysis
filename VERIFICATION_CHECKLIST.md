# Verification Checklist

Use this checklist before handing the repo to someone else, cutting a release, or claiming the app is in a good state.

## Environment

- [ ] Python `3.10+` is available
- [ ] Node.js `18+` is available
- [ ] `backend/.env` exists
- [ ] `frontend/.env.local` exists

## Backend

- [ ] Backend dependencies install successfully

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

- [ ] Migrations apply cleanly

```bash
alembic upgrade head
```

- [ ] FastAPI app imports cleanly

```bash
./.venv/bin/python -c "from app.main import app; print(app.title)"
```

- [ ] Health endpoint responds

```bash
curl http://127.0.0.1:8000/health
```

Expected:

```json
{"status":"ok"}
```

## Frontend

- [ ] Frontend dependencies install successfully

```bash
cd frontend
npm install
```

- [ ] Lint runs cleanly enough for the current codebase

```bash
npm run lint
```

- [ ] Production build succeeds

```bash
npm run build
```

- [ ] Home page loads at `http://127.0.0.1:3000`
- [ ] Login page loads at `/login`
- [ ] Signup page loads at `/signup`

## Authentication Flow

- [ ] Sign-up works from the UI or the API
- [ ] Login works from the UI or the API
- [ ] `/api/auth/me` works with a valid bearer token
- [ ] `/api/auth/me` fails without a token

API smoke test:

```bash
curl -X POST "http://127.0.0.1:8000/api/auth/signup" \
  -H "Content-Type: application/json" \
  -d '{"email":"verify@example.com","password":"pass123","full_name":"Verify User"}'
```

```bash
curl -X POST "http://127.0.0.1:8000/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"verify@example.com","password":"pass123"}'
```

## Holdings Import Flow

- [ ] Open `/import-mutual-funds`
- [ ] Upload `sample_holdings.xlsx`
- [ ] Upload succeeds and returns a portfolio ID
- [ ] The success CTA opens `/analytics/[portfolio_id]`
- [ ] Dashboard data loads at `/portfolio/total`

Optional API smoke test:

```bash
curl -X POST "http://127.0.0.1:8000/api/import/upload-holdings" \
  -H "Authorization: Bearer TOKEN_HERE" \
  -F "file=@sample_holdings.xlsx"
```

## Portfolio and Market Data

- [ ] `/api/portfolios/dashboard` returns authenticated data
- [ ] `/api/market-data/symbol/{symbol}` works for a known symbol
- [ ] `/api/market-data/refresh/{portfolio_id}` returns a refresh summary

## Zerodha Flow

- [ ] `/zerodha-api-keys` loads
- [ ] API key save works
- [ ] `/zerodha-connect` loads
- [ ] Zerodha status endpoint returns a sensible response

Notes:

- This flow depends on real Zerodha credentials.
- A failed connect flow without credentials is expected.

## Automated Checks

- [ ] Repository root smoke tests pass

```bash
./.venv/bin/pytest
```

## Final Review

- [ ] No stale placeholder wording remains in primary docs
- [ ] Environment variable names match code
- [ ] Links and routes in the docs match the current app
- [ ] Known caveats are documented honestly
