# Mutual Fund Analysis Feature - Comprehensive Plan

## 1. Mutual Fund Analysis Features - Display Strategy

### 1.1 Core Display Information

#### Fund Overview
- **Fund Name & ISIN**: Unique identifier
- **Fund House**: Asset management company
- **Fund Category**: Equity, Debt, Hybrid, Liquid, Gold, International, FOF
- **Sub-category**: Growth, Value, Large Cap, Mid Cap, Small Cap, Multi-Cap, etc.
- **Fund Type**: Open-ended, Close-ended, Interval
- **Inception Date**: When fund was created
- **Fund Manager/Team**: Current fund management details

#### NAV & Returns
- **Current NAV**: Latest Net Asset Value per unit
- **NAV Date**: As of which date
- **Returns**: 
  - 1-week, 1-month, 3-month, 6-month, 1-year, 3-year, 5-year, 10-year, Since inception
  - Both absolute and annualized returns
- **Benchmark Returns**: For comparison
- **Rank**: Against category funds (1st percentile, quartile ranking)
- **Expense Ratio**: Annual charges
- **Plan Type**: Direct vs Regular plan indicator

#### Portfolio Holdings (Top 10)
- **Stock Name**: Individual holdings
- **Sector**: Industry classification
- **Weight %**: Portfolio allocation percentage
- **Market Value**: Contribution to total AUM

#### Risk & Performance Metrics
- **Standard Deviation**: Volatility (1-year, 3-year, 5-year)
- **Sharpe Ratio**: Risk-adjusted returns
- **Sortino Ratio**: Downside risk-adjusted returns
- **Beta**: Correlation with market
- **Alpha**: Excess returns vs benchmark
- **Maximum Drawdown**: Largest peak-to-trough decline
- **Treynor Ratio**: Return per unit of systematic risk

#### Fund Details
- **Assets Under Management (AUM)**: Total fund size
- **Number of Investors**: Investor base size
- **Minimum Investment**: Entry barrier
- **Exit Load**: Redemption charges (if any)
- **Lock-in Period**: If any restriction
- **SIP Details**: Minimum SIP amount, SIP frequency options

#### Historical Data
- **NAV History**: Last 252 trading days (1-year chart)
- **Performance Chart**: Returns over different time periods
- **AUM History**: Fund size tracking

### 1.2 User Portfolio Integration
- **Holdings**: Number of units held
- **Investment Amount**: Total invested (cost basis)
- **Current Value**: Current market value
- **Gain/Loss**: Absolute and percentage
- **Holding Period**: Time held
- **Time to Long-term**: For tax planning

### 1.3 Comparison & Benchmarking
- **Category Average Comparison**: How fund performs vs category mean
- **Peer Fund Comparison**: Compare with similar funds
- **Benchmark Comparison**: NSE 50, Nifty 500, Nifty Next 50, etc.
- **Performance vs Category**: Percentile ranking

### 1.4 Alerts & Recommendations
- **Fund Quality Alerts**: If fund performance deteriorates
- **Risk Alerts**: If volatility increases
- **Rebalancing Suggestions**: Portfolio allocation insights
- **Similar Fund Recommendations**: Alternative investment options

---

## 2. Free APIs & Data Sources

### 2.1 Mutual Fund Data APIs

#### Option 1: **MFAPI.in** (RECOMMENDED - Completely Free, No Auth Required)
- **Endpoint Base**: `https://api.mfapi.in/`
- **Data Available**:
  - Fund list with metadata
  - Daily NAV history
  - Fund performance data
  - Scheme information
- **Rate Limit**: Reasonable (seems unlimited for basic usage)
- **Documentation**: https://mfapi.in/
- **Example Endpoints**:
  ```
  GET /mf/  # List all mutual funds
  GET /mf/{code}/  # Get fund details
  GET /mf/{code}/series/{plan}/nav/  # Get NAV history
  ```

#### Option 2: **NRSE Data Portal** (Indian Stock Exchange)
- **Free Historical Data**: Available for download
- **Coverage**: Equity indices, historical prices
- **Limitation**: Limited real-time capability

#### Option 3: **RBI Data** (Reserve Bank of India)
- **Forex Rates**: For international fund valuations
- **Interest Rates**: For debt fund analysis
- **API**: https://www.rbi.org.in/scripts/db_rss.aspx

#### Option 4: **XRAY (Morningstar Alternative)**
- **Manual Integration**: Web scraping for fund data (if needed)
- **Not Recommended**: Terms of service restrictions

### 2.2 External Data Enhancement

#### Stock/Equity Data
- **yfinance** (Already integrated): Stock prices, fundamentals
- **Financial Databases**: For fundamental analysis

#### International Funds
- **Alpha Vantage API**: (Limited free tier - 5 API calls/min)
- **IEX Cloud**: Stock data (freemium model)

---

## 3. Zerodha Coin Integration Strategy

### 3.1 Data Extraction from Zerodha Coin
**What Zerodha Coin API can provide** (through their official API):
- Mutual fund holdings with current values
- NAV information
- Transaction history
- Fund details (name, house, category)
- Redemption status

**Implementation Approach**:
- Use Zerodha's official MF API endpoints (requires API key)
- Store holdings in database
- Link holdings to detailed fund info from MFAPI.in
- Display on portfolio dashboard

**Zerodha API Endpoints for MF**:
```
GET /order/trades - Get historical trades (includes MF buys/sells)
GET /holdings - Get current holdings (includes MF units)
GET /portfolio/holdings - Detailed holdings with valuation
```

### 3.2 Data Flow
```
User OAuth → Zerodha API → Extract MF Holdings 
  → Store in DB → Enrich with MFAPI.in data 
  → Display in UI
```

---

## 4. INDmoney Integration Strategy

### 4.1 Data from INDmoney
**What can be extracted**:
- Fund holdings data (through manual import/web scraping if API not available)
- Portfolio allocation
- Goal-based recommendations
- Cross-holding visibility

**Challenges**:
- No official public API available
- Would need web scraping (using Selenium/Playwright)
- Terms of service may restrict scraping

**Recommended Approach**:
- **Phase 1**: Manual CSV export option (user exports data and uploads)
- **Phase 2**: If API becomes available, integrate it
- **Alternative**: Partner APIs like **Groww**, **Kuvera** that have better API support

### 4.2 Data Import Process
```
User → INDmoney CSV Export → Upload to Portal 
  → Parse & Store → Enrich with MFAPI.in 
  → Display in Unified View
```

---

## 5. Database Schema Design

### 5.1 New Models

#### MutualFund Model
```python
class MutualFund(Base):
    __tablename__ = 'mutual_funds'
    
    id: Mapped[int]  # Primary key
    isin: Mapped[str]  # Unique identifier
    fund_code: Mapped[str]  # MFAPI code
    name: Mapped[str]  # Fund name
    fund_house: Mapped[str]  # AMC name
    category: Mapped[str]  # Category (Equity, Debt, etc.)
    subcategory: Mapped[str]  # Sub-category
    fund_type: Mapped[str]  # Open-ended, Close-ended
    inception_date: Mapped[date]  # Fund start date
    
    # Performance metrics
    current_nav: Mapped[float]  # Latest NAV
    nav_date: Mapped[date]  # As of date
    aum: Mapped[float]  # Assets under management
    expense_ratio: Mapped[float]  # Annual charges
    
    # Returns
    return_1w: Mapped[float]
    return_1m: Mapped[float]
    return_3m: Mapped[float]
    return_6m: Mapped[float]
    return_1y: Mapped[float]
    return_3y: Mapped[float]
    return_5y: Mapped[float]
    return_10y: Mapped[float]
    return_inception: Mapped[float]
    
    # Risk metrics
    std_dev_1y: Mapped[float]
    std_dev_3y: Mapped[float]
    sharpe_ratio: Mapped[float]
    sortino_ratio: Mapped[float]
    beta: Mapped[float]
    alpha: Mapped[float]
    max_drawdown: Mapped[float]
    
    # Ratings & Rankings
    rating: Mapped[int]  # 1-5 stars
    rank_in_category: Mapped[int]  # Percentile rank
    category_average_return: Mapped[float]
    benchmark_name: Mapped[str]
    benchmark_return: Mapped[float]
    
    # Holdings
    top_holdings: Mapped[str]  # JSON stored as string
    portfolio_allocation: Mapped[str]  # JSON sector/type allocation
    
    created_at: Mapped[datetime]
    updated_at: Mapped[datetime]
```

#### MutualFundHolding Model
```python
class MutualFundHolding(Base):
    __tablename__ = 'mutual_fund_holdings'
    
    id: Mapped[int]
    portfolio_id: Mapped[int]  # FK to portfolio
    mutual_fund_id: Mapped[int]  # FK to mutual_fund
    units: Mapped[float]  # Number of units held
    cost_basis: Mapped[float]  # Total investment
    current_value: Mapped[float]  # Current market value
    purchase_date: Mapped[date]  # When purchased
    source: Mapped[str]  # 'zerodha', 'indmoney', 'manual', etc.
    plan_type: Mapped[str]  # 'direct' or 'regular'
    
    # Tax data
    is_long_term: Mapped[bool]
    holding_days: Mapped[int]
    gain_loss: Mapped[float]
    gain_loss_pct: Mapped[float]
    
    updated_at: Mapped[datetime]
```

#### MutualFundNAVHistory Model
```python
class MutualFundNAVHistory(Base):
    __tablename__ = 'mf_nav_history'
    
    id: Mapped[int]
    mutual_fund_id: Mapped[int]  # FK to mutual_fund
    nav_date: Mapped[date]
    nav_value: Mapped[float]
    aum: Mapped[float]  # AUM on that date
    units_in_circulation: Mapped[int]
    
    # Cache performance calculations
    return_since_date: Mapped[float]  # % return from this date to latest
```

#### SourceCredentials Model (for Zerodha/INDmoney)
```python
class SourceCredentials(Base):
    __tablename__ = 'source_credentials'
    
    id: Mapped[int]
    user_id: Mapped[int]  # FK to user
    source: Mapped[str]  # 'zerodha_coin', 'indmoney', etc.
    access_token: Mapped[str]  # Encrypted
    refresh_token: Mapped[str]  # Encrypted (if available)
    expires_at: Mapped[datetime]
    last_sync: Mapped[datetime]
    is_active: Mapped[bool]
    
    created_at: Mapped[datetime]
    updated_at: Mapped[datetime]
```

---

## 6. API Integration Architecture

### 6.1 Services Layer

#### MutualFundService
- Fetch fund data from MFAPI.in
- Cache fund information (24-hour cache)
- Calculate performance metrics
- Process fund list

#### MutualFundDataService
- Fetch NAV history
- Calculate returns for different periods
- Compute risk metrics (standard deviation, Sharpe ratio, etc.)
- Handle data aggregation

#### ZerodhaCoopIntegrationService (extends existing ZerodhaService)
- Authenticate with Zerodha
- Fetch mutual fund holdings from Zerodha Coin API
- Parse holdings data
- Create/update MutualFundHolding records

#### INDmoneyIntegrationService
- Parse CSV uploads from INDmoney
- Validate and normalize data
- Create/update MutualFundHolding records
- Handle duplicate detection

#### MutualFundAnalyticsService
- Portfolio-level MF analysis
- Asset allocation analysis
- Risk analysis across MF portfolio
- Comparison with benchmarks
- Tax planning analysis

### 6.2 Data Sync Strategy
```
Scheduled Task (Daily 8 PM IST):
1. For each active Zerodha integration:
   - Fetch latest MF holdings
   - Update portfolio with new holdings
   - Sync NAV data from MFAPI.in

2. Update fund master data:
   - Fetch latest NAV for all funds in portfolio
   - Update performance metrics
   - Update risk metrics

3. Calculate derived metrics:
   - Portfolio returns
   - Sector allocation
   - Risk metrics
```

---

## 7. Frontend Features - Mutual Fund Dashboard

### 7.1 Pages/Sections

#### 1. **Mutual Funds Overview** (`/portfolio/mutual-funds`)
- Summary cards:
  - Total MF portfolio value
  - Total invested amount
  - Gain/loss
  - Number of funds held
- Filters: Category, House, Return period
- List of all MF holdings with key metrics
- Quick actions: Add fund, Import from Zerodha

#### 2. **Fund Details Page** (`/portfolio/mutual-funds/[isin]`)
- Fund overview section
- NAV chart (1-week to 5-year)
- Performance comparison (category, peer, benchmark)
- Top 10 holdings
- Risk metrics dashboard
- Historical returns table
- User's holding details (if owned)
- Similar fund recommendations

#### 3. **MF Analytics Dashboard** (`/analytics/mutual-funds`)
- Portfolio breakdown by category
- Sector allocation (aggregated from all holdings)
- Returns analysis (compare against benchmarks)
- Risk analysis
- Asset allocation optimization suggestions
- Tax-loss harvesting opportunities

#### 4. **Fund Comparison** (`/portfolio/mutual-funds/compare`)
- Multi-select fund comparison
- Side-by-side performance metrics
- Risk-return scatter plot
- Category-wise comparison
- Holdings overlap analysis

#### 5. **Import/Sync Management** (`/portfolio/mutual-funds/import-sync`)
- Connect Zerodha Coin account
- Upload INDmoney CSV
- Manual fund addition
- View sync history
- Manage integrated accounts

### 7.2 Components

#### MutualFundCard
- Fund name, house, category
- Current NAV
- Latest return %
- Quick view details

#### PerformanceChart
- NAV trend chart
- Returns chart
- Benchmark comparison overlay

#### RiskMetricsWidget
- Volatility gauge
- Sharpe ratio display
- Maximum drawdown indicator
- Risk rating

#### PortfolioAllocationWidget
- Category-wise pie chart
- Sector-wise pie chart
- Geographic allocation (if applicable)
- House-wise allocation

#### HoldingsTable
- Fund name, units, cost basis, current value
- Gain/loss with % 
- Holding period
- Holding type indicator (direct/regular)
- Actions (view details, sell suggestion, tax loss harvest)

---

## 8. Implementation Phases

### Phase 1: Data Foundation (Week 1)
- Create database models
- Create Alembic migration
- Implement MutualFundService with MFAPI.in integration
- Basic fund data caching

### Phase 2: Backend Integration (Week 2)
- Implement Zerodha Coin integration
- Implement INDmoney CSV parser
- Create analytics service
- Build all API endpoints

### Phase 3: Frontend UI (Week 3)
- MF portfolio overview page
- Fund details page
- Fund comparison page
- Analytics dashboard

### Phase 4: Testing & Polish (Week 4)
- End-to-end testing
- Performance optimization
- Error handling and edge cases
- Documentation and help text

---

## 9. API Endpoints - Backend

### Fund Management
- `GET /api/mutual-funds/` - List all funds with filters
- `GET /api/mutual-funds/{isin}` - Get fund details
- `GET /api/mutual-funds/{isin}/nav-history` - Get NAV history
- `GET /api/mutual-funds/{isin}/holdings` - Get fund's top holdings
- `GET /api/mutual-funds/compare` - Compare multiple funds

### Portfolio MF Holdings
- `GET /api/portfolios/{portfolio_id}/mutual-funds` - Get MF holdings
- `POST /api/portfolios/{portfolio_id}/mutual-funds` - Add MF manually
- `PUT /api/portfolios/{portfolio_id}/mutual-funds/{mf_id}` - Update holding
- `DELETE /api/portfolios/{portfolio_id}/mutual-funds/{mf_id}` - Remove holding

### Integration
- `POST /api/zerodha/sync-mutual-funds` - Sync from Zerodha
- `POST /api/indmoney/import-csv` - Import from INDmoney CSV
- `GET /api/sync-status` - Check last sync status

### Analytics
- `GET /api/mutual-funds/portfolio/{portfolio_id}/analytics` - Portfolio analysis
- `GET /api/mutual-funds/portfolio/{portfolio_id}/tax-analysis` - Tax planning data

---

## 10. Success Criteria

- [x] Comprehensive plan created
- [ ] Database schema implemented
- [ ] MFAPI.in integration working
- [ ] Zerodha Coin integration (if API available)
- [ ] INDmoney CSV import working
- [ ] Frontend UI complete and responsive
- [ ] All endpoints tested and documented
- [ ] End-to-end flow verified
- [ ] Performance optimized (NAV updates < 2 seconds)
- [ ] Error handling for all edge cases
- [ ] User documentation complete

---

## 11. Technical Considerations

### Caching Strategy
- Fund master data: 24-hour cache
- NAV history: 7-day cache
- Performance metrics: 24-hour cache
- User holdings: Real-time (on demand), 1-hour background refresh

### Error Handling
- API rate limit handling (with exponential backoff)
- Failed sync notifications
- Data validation and sanitization
- Graceful degradation if external API is down

### Performance
- Batch API calls for efficiency
- Database indexing on frequently queried fields (isin, fund_code)
- Async processing for sync operations
- CDN caching for static fund assets

### Security
- Encrypt stored API tokens
- Validate all inputs
- Rate limiting on public endpoints
- Audit logging for data access

---

## 12. Future Enhancements

1. **SIP Management**: Auto-invest in funds
2. **Goal-based Allocation**: Invest for retirement, education, etc.
3. **Smart Rebalancing**: Automatic or suggested portfolio rebalancing
4. **AI-powered Recommendations**: Based on risk profile and goals
5. **Tax Optimization**: Auto calculate tax liability and suggestions
6. **Regulatory Integration**: Form 26AS data integration
7. **Robo Advisory**: Automated portfolio suggestions
8. **Export Reports**: PDF portfolio reports, tax documents

