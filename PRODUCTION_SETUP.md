# Portfolio Evaluator - Production Setup Guide

This document provides comprehensive instructions for setting up and running the Portfolio Evaluator application in both development and production environments.

## ✅ Current Status

- **Backend**: FastAPI with SQLAlchemy ORM ✅
- **Frontend**: Next.js 14 with React 18 ✅
- **Database**: SQLite (development) / PostgreSQL (production) ✅
- **Authentication**: JWT-based auth with bcrypt/pbkdf2 ✅
- **API Communication**: Frontend proxy routes ✅

## 🚀 Quick Start

### Prerequisites

- Python 3.9+
- Node.js 18+
- Git

### 1. Backend Setup

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
pip install -r requirements.txt

# Copy and configure environment
cp .env.example .env
# Edit .env with your settings (SECRET_KEY, DATABASE_URL, etc.)

# Run migrations
alembic upgrade head

# Start backend (from project root directory)
cd ..
PYTHONPATH=backend python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

### 2. Frontend Setup

```bash
cd frontend
npm install

# Copy and configure environment
cp .env.example .env.local
# Default values should work for local development

# Start frontend (from frontend directory)
npm run dev
```

### 3. Access the Application

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **API Docs**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

## 📋 Configuration

### Backend Environment (`.env`)

```env
# Database Configuration
DATABASE_URL=sqlite:////path/to/portfolio_evaluator.db
# For PostgreSQL: DATABASE_URL=postgresql://user:password@localhost/dbname

# Security
SECRET_KEY=your-secret-key-change-this-in-production

# API Configuration
API_PREFIX=/api

# Zerodha Integration (optional)
ZERODHA_API_KEY=your-zerodha-api-key
ZERODHA_API_SECRET=your-zerodha-api-secret
```

### Frontend Environment (`.env.local`)

```env
NEXT_PUBLIC_BACKEND_URL=http://localhost:8000
NEXT_PUBLIC_API_URL=http://localhost:8000/api
NEXT_PUBLIC_FRONTEND_URL=http://localhost:3000
```

## 🔐 Security Notes

1. **Secret Key**: Generate a strong secret key for production
   ```bash
   python3 -c "import secrets; print(secrets.token_hex(32))"
   ```

2. **CORS**: Backend CORS is configured for localhost ports (3000-3003). Update in `backend/app/main.py` for production domains.

3. **Database**: 
   - Use PostgreSQL in production instead of SQLite
   - Always set appropriate file permissions

4. **HTTPS**: Use a reverse proxy (nginx, Cloudflare) in production

## 📦 Database Migrations

### Create a New Migration

```bash
cd backend
alembic revision --autogenerate -m "description of changes"
alembic upgrade head
```

### Downgrade

```bash
alembic downgrade -1
```

## 🧪 Testing

### Backend Tests

```bash
cd backend
pytest tests/
pytest tests/test_indmoney_import_parser.py -v
```

### Frontend Build

```bash
cd frontend
npm run build
npm run start  # Start production build
```

## 📊 API Endpoints

### Authentication
- `POST /api/auth/signup` - Create account
- `POST /api/auth/login` - Login
- `GET /api/auth/me` - Get current user

### Portfolio Management
- `GET /api/portfolios` - List portfolios
- `POST /api/portfolios` - Create portfolio
- `GET /api/portfolios/{id}` - Get portfolio details
- `DELETE /api/portfolios/{id}` - Delete portfolio

### Holdings
- `GET /api/holdings` - List holdings
- `POST /api/holdings` - Upload holdings (Excel/CSV)

### Analytics
- `GET /api/analytics/{portfolio_id}` - Get analytics

### Market Data
- `GET /api/market-data/refresh` - Refresh market prices

## 🐳 Docker Deployment

### Build Docker Images

```bash
docker-compose build
docker-compose up
```

Access at:
- Frontend: http://localhost:3000
- Backend: http://localhost:8000

## 🔧 Troubleshooting

### Login Returns 500 Error

**Issue**: Password verification fails
**Solution**: 
- Verify database has users table
- Ensure .env DATABASE_URL is correct
- Run migrations: `alembic upgrade head`

### Frontend Cannot Connect to Backend

**Issue**: CORS errors or connection timeout
**Solution**:
- Check NEXT_PUBLIC_BACKEND_URL in .env.local
- Verify backend is running on port 8000
- Check CORS origins in backend/app/main.py

### Database Tables Missing

**Issue**: "no such table" errors
**Solution**:
```bash
cd backend
alembic upgrade head
```

### Build Errors

**Frontend TypeScript errors**:
```bash
cd frontend
npm run lint  # Check for issues
npm run build  # Full build check
```

**Backend Import Errors**:
```bash
cd backend
pip install -r requirements.txt
```

## 📈 Performance Optimization

1. **Frontend**: 
   - Next.js production build uses automatic code splitting
   - Run `npm run build` to optimize

2. **Backend**:
   - Use PostgreSQL for better performance
   - Enable query caching
   - Use uvicorn workers: `uvicorn app.main:app --workers 4`

3. **Database**:
   - Add indexes for frequently queried fields
   - Regular backups

## 📝 File Structure

```
.
├── backend/
│   ├── app/
│   │   ├── api/          # API routes
│   │   ├── models/       # Database models
│   │   ├── schemas/      # Request/response schemas
│   │   ├── services/     # Business logic
│   │   └── core/         # Config, security
│   ├── alembic/          # Database migrations
│   ├── tests/            # Test suite
│   ├── .env              # Environment config
│   └── requirements.txt   # Dependencies
├── frontend/
│   ├── app/              # Next.js app directory
│   ├── components/       # Reusable components
│   ├── lib/              # Utilities
│   ├── hooks/            # Custom React hooks
│   ├── .env.local        # Environment config
│   └── package.json      # Dependencies
└── README.md
```

## 🚀 Deployment Checklist

- [ ] Environment variables configured
- [ ] Database migrations run
- [ ] CORS origins updated for production domain
- [ ] Secret key generated and set
- [ ] Frontend build tested
- [ ] Backend tests passing
- [ ] SSL/HTTPS configured
- [ ] Database backups configured
- [ ] Monitoring/logging setup
- [ ] Rate limiting configured

## 📞 Support

For issues or questions:
1. Check the troubleshooting section above
2. Review API documentation at `/docs`
3. Check application logs
4. File an issue on GitHub

## 📄 License

MIT License - See LICENSE file for details
