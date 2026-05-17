# Portfolio Evaluator

A personal wealth dashboard for Indian investors. Track your Zerodha stocks and mutual fund holdings in one place — with benchmark comparisons, risk metrics, tax estimates, and allocation analysis.

Built by [Yashsav Gupta](https://www.linkedin.com/in/yashsav-gupta/) 

---

## Features

**Stocks**
- Upload Zerodha holdings export (Excel/CSV)
- Portfolio dashboard with sector allocation, valuation signals, and promoter holding trends
- Benchmark comparison against NIFTY 50
- Risk analysis — concentration, volatility, drawdown

**Mutual Funds**
- Import INDmoney CSV exports
- Allocation breakdown by category, fund house, and asset type
- Performance tracking with XIRR and CAGR per fund
- Risk metrics — Sharpe ratio, standard deviation, max drawdown, beta vs NIFTY 50
- LTCG/STCG tax estimates and harvest opportunities

**General**
- JWT-based authentication
- Private by default — your data never leaves your own instance
- SQLite for local use, PostgreSQL for production

---

## Tech Stack

| Layer | Tech |
|---|---|
| Frontend | Next.js 14, React 18, TypeScript, Tailwind CSS, Recharts |
| Backend | FastAPI, SQLAlchemy 2, Alembic, Pydantic 2 |
| Database | SQLite (default) · PostgreSQL (production) |
| Data sources | mfapi.in, yfinance, AMFI India |

---

## Local Setup

### Prerequisites

- Python 3.9+
- Node.js 18+

### 1. Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env             # then edit .env
alembic upgrade head
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

**`backend/.env`**

```env
DATABASE_URL=sqlite:///./portfolio_evaluator.db
SECRET_KEY=change-me-use-a-long-random-string
API_PREFIX=/api
ZERODHA_API_KEY=
ZERODHA_API_SECRET=
```

Generate a strong secret key:

```bash
python3 -c "import secrets; print(secrets.token_hex(32))"
```

### 2. Frontend

```bash
cd frontend
npm install
cp .env.example .env.local       # default values work for local dev
npm run dev
```

**`frontend/.env.local`**

```env
NEXT_PUBLIC_BACKEND_URL=http://127.0.0.1:8000
```

### 3. Open the app

| Service | URL |
|---|---|
| App | http://localhost:3000 |
| API | http://localhost:8000 |
| API docs | http://localhost:8000/docs |

---

## Importing Data

### Stocks (Zerodha)
Download your holdings from **Zerodha Console → Portfolio → Holdings → Download** and upload the Excel file at `/import`.

### Mutual Funds (INDmoney)
Export your holdings from the INDmoney app and upload the CSV at `/import`.

---

## Production Deployment

1. Set `DATABASE_URL` to a PostgreSQL connection string
2. Set a strong `SECRET_KEY`
3. Update CORS origins in `backend/app/main.py` to your domain
4. Run `alembic upgrade head` on first deploy
5. Build the frontend: `npm run build && npm run start`
6. Serve behind HTTPS (nginx, Caddy, or Cloudflare)

---

## Project Structure

```
.
├── backend/
│   ├── app/
│   │   ├── api/          # Route handlers
│   │   ├── models/       # SQLAlchemy models
│   │   ├── schemas/      # Pydantic schemas
│   │   ├── services/     # Business logic
│   │   └── core/         # Config, security, JWT
│   ├── alembic/          # Database migrations
│   └── requirements.txt
├── frontend/
│   ├── app/              # Next.js app directory
│   ├── components/       # Shared UI components
│   └── lib/              # API helpers, auth utils
└── README.md
```

---

## License

MIT
