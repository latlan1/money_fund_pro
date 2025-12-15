# Money Market Fund Tax-Equivalent Yield Optimizer - Design Document

## Architecture Overview

### System Architecture
```
┌─────────────────────────────────────────────────────────┐
│                     Frontend (SPA)                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │   HTML/CSS   │  │  JavaScript  │  │  Chart.js    │  │
│  │   Interface  │  │   Tax Calc   │  │ Visualization│  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
└───────────────────────────┬─────────────────────────────┘
                            │ REST API
┌───────────────────────────▼─────────────────────────────┐
│                  Backend (Node.js/Express)               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │   Scraping   │  │   Database   │  │  Tax Engine  │  │
│  │   Service    │  │   Manager    │  │   (shared)   │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
└───────────────────────────┬─────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────┐
│              SQLite Database (fund_data.db)              │
│  ┌──────────────────────────────────────────────────┐   │
│  │  fund_yields table (historical data)             │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

## Project Structure
```
money_fund_pro/
├── AGENTS.md                    # Project requirements
├── DESIGN.md                    # This file
├── README.md                    # Setup/usage instructions
├── package.json                 # Node.js dependencies
├── server.js                    # Express backend server
├── public/                      # Frontend assets
│   ├── index.html              # Main SPA
│   ├── css/
│   │   └── styles.css          # Styles
│   └── js/
│       ├── app.js              # Main app logic
│       ├── tax-calculator.js   # Tax calculation module
│       └── chart-handler.js    # Chart.js wrapper
├── src/                         # Backend modules
│   ├── scraper.js              # Web scraping logic
│   ├── database.js             # SQLite operations
│   └── tax-engine.js           # Shared tax calculations
└── data/
    └── fund_data.db            # SQLite database (created at runtime)
```

## Component Design

### 1. Frontend (Single-Page Application)

#### 1.1 HTML Structure (index.html)
```html
<body>
  <header>
    - App title and description
    - Disclaimer notice
  </header>
  
  <section id="tax-profile">
    - Income input
    - Filing status dropdown
    - State dropdown
    - Calculate button
  </section>
  
  <section id="results">
    - Loading indicator
    - Sortable table
    - Recommendation card (highlighted)
  </section>
  
  <section id="historical">
    - Chart.js canvas
    - Time range selector
    - Fund comparison selector
  </section>
  
  <footer>
    - Refresh data button
    - Export button
    - Educational tooltips
  </footer>
</body>
```

#### 1.2 CSS Design (styles.css)
- **Color Scheme**: Professional financial theme (blues, greens for positive)
- **Layout**: CSS Grid/Flexbox responsive design
- **Typography**: Clean, readable fonts (system fonts)
- **Components**:
  - Cards for fund recommendations
  - Responsive table with sticky header
  - Button states and hover effects
  - Tooltip styling
  - Mobile breakpoints (< 768px)

#### 1.3 JavaScript Modules

**app.js** - Main application controller
```javascript
- Initialize app on load
- Handle user input events
- Fetch data from API
- Update UI with results
- Manage application state
- Handle sorting and filtering
```

**tax-calculator.js** - Tax calculation logic
```javascript
- Tax bracket constants (2024/2025)
- calculateFederalTax(income, filingStatus)
- calculateStateTax(income, state)
- calculateTaxEquivalentYield(fund, userProfile)
- getEffectiveTaxRate(income, filingStatus, state, fundCategory)
```

**chart-handler.js** - Historical visualization
```javascript
- Initialize Chart.js
- fetchHistoricalData(fundNames, dateRange)
- renderYieldTrendChart(data)
- renderComparisonChart(funds)
- updateChartData(newData)
```

### 2. Backend (Node.js/Express)

#### 2.1 API Endpoints

**GET /api/funds**
- Returns current fund data (from cache or fresh scrape)
- Response: Array of fund objects with yields, expense ratios, categories

**POST /api/calculate**
- Body: { userProfile, funds }
- Calculates tax-equivalent yields for all funds
- Returns: Sorted results with recommendations

**GET /api/history/:fundName**
- Returns historical yield data for specific fund
- Query params: startDate, endDate

**GET /api/history/compare**
- Query params: fundNames[] (array), startDate, endDate
- Returns: Historical data for multiple funds

**POST /api/refresh**
- Triggers fresh scrape of Schwab data
- Stores new data in database
- Returns: Updated fund data

**GET /api/tax-brackets**
- Returns current tax bracket data
- Used for manual override UI

#### 2.2 Backend Modules

**server.js** - Express application
```javascript
- Configure Express middleware
- Define API routes
- Handle errors
- Start server (port 3000)
- Serve static files from /public
```

**scraper.js** - Web scraping
```javascript
- Uses Puppeteer or Cheerio
- Scrapes https://www.schwab.com/money-market-funds
- Parses fund data (name, yield, category)
- Fetches expense ratios (may need separate source)
- Returns structured fund objects
- Implements caching (refresh every 6 hours)
```

**database.js** - SQLite operations
```javascript
- Initialize database connection
- Create tables if not exist
- insertFundYield(fundData)
- getFundHistory(fundName, dateRange)
- getAllCurrentFunds()
- getLatestYields()
- Database cleanup (old data > 1 year)
```

**tax-engine.js** - Tax calculations (shared)
```javascript
- Same logic as frontend tax-calculator.js
- Used for backend calculations
- Ensures consistency between frontend/backend
```

### 3. Database Schema

#### fund_yields Table
```sql
CREATE TABLE fund_yields (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fund_name TEXT NOT NULL,
  fund_symbol TEXT,
  category TEXT NOT NULL,
  gross_yield REAL NOT NULL,
  expense_ratio REAL NOT NULL,
  net_yield REAL NOT NULL,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  source_url TEXT,
  INDEX idx_fund_name (fund_name),
  INDEX idx_timestamp (timestamp)
);
```

#### fund_metadata Table (additional)
```sql
CREATE TABLE fund_metadata (
  fund_symbol TEXT PRIMARY KEY,
  fund_name TEXT NOT NULL,
  category TEXT NOT NULL,
  minimum_investment REAL DEFAULT 0,
  last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### 4. Tax Calculation Engine

#### Tax Bracket Data (2024/2025)
```javascript
const TAX_BRACKETS_2024 = {
  single: [
    { min: 0, max: 11600, rate: 0.10 },
    { min: 11600, max: 47150, rate: 0.12 },
    { min: 47150, max: 100525, rate: 0.22 },
    { min: 100525, max: 191950, rate: 0.24 },
    { min: 191950, max: 243725, rate: 0.32 },
    { min: 243725, max: 609350, rate: 0.35 },
    { min: 609350, max: Infinity, rate: 0.37 }
  ],
  married: [
    { min: 0, max: 23200, rate: 0.10 },
    { min: 23200, max: 94300, rate: 0.12 },
    { min: 94300, max: 201050, rate: 0.22 },
    { min: 201050, max: 383900, rate: 0.24 },
    { min: 383900, max: 487450, rate: 0.32 },
    { min: 487450, max: 731200, rate: 0.35 },
    { min: 731200, max: Infinity, rate: 0.37 }
  ]
};

const STATE_TAX_RATES = {
  'MO': 0.053,
  'CA': 0.133,
  'NY': 0.109,
  // ... other states
};
```

#### Fund Category Tax Treatment
```javascript
const TAX_TREATMENT = {
  taxable: {
    federalTaxable: true,
    stateTaxable: true
  },
  treasury: {
    federalTaxable: true,
    stateTaxable: false
  },
  municipal: {
    federalTaxable: false,
    stateTaxable: true  // unless home-state fund
  },
  stateSpecificMunicipal: {
    federalTaxable: false,
    stateTaxable: false  // only if resident of that state
  }
};
```

#### Calculation Flow
```
1. Get user's marginal tax rates:
   - Federal (based on income + filing status)
   - State (based on state + income)

2. For each fund:
   a. Calculate net yield = gross_yield - expense_ratio
   b. Determine applicable taxes based on category
   c. Calculate effective tax rate
   d. Calculate tax-equivalent yield:
      TEY = net_yield / (1 - effective_tax_rate)

3. Sort by TEY (descending)
4. Highlight optimal fund
```

### 5. UI/UX Design

#### Visual Design Principles
- **Clean & Professional**: Financial tool aesthetic
- **Data-Driven**: Focus on numbers and comparisons
- **Educational**: Tooltips and explanations
- **Responsive**: Mobile-first design

#### Color Palette
```css
--primary-blue: #0066cc
--secondary-blue: #4d94ff
--success-green: #28a745
--warning-yellow: #ffc107
--text-dark: #212529
--text-light: #6c757d
--bg-light: #f8f9fa
--bg-white: #ffffff
--border-gray: #dee2e6
```

#### Key UI Components

**Tax Profile Card**
- Clean form layout
- Input validation
- Real-time preview of tax rates
- Save/load profile functionality

**Results Table**
- Sticky header on scroll
- Sortable columns (click header)
- Highlighted top recommendation
- Expandable rows for details
- Color coding (green for best)

**Recommendation Card**
- Large, prominent display
- Fund name + key metrics
- "Why is this optimal?" explanation
- One-click action ("Learn More")

**Historical Chart**
- Line chart showing yield over time
- Multiple fund comparison
- Zoom/pan controls
- Date range selector
- Legend with fund categories

**Tooltips**
- Hover on terms like "tax-equivalent yield"
- Brief educational explanations
- Links to more detailed info

### 6. Data Flow

#### Initial Load
```
1. User opens app (index.html)
2. Frontend loads default user profile (MO, $200k, single)
3. Frontend calls GET /api/funds
4. Backend checks cache (< 6 hours old)
5. If cache valid: return cached data
6. If cache stale: scrape Schwab, store in DB, return fresh data
7. Frontend displays fund data with default calculations
8. Frontend calls GET /api/history/compare for initial chart
```

#### User Customization
```
1. User modifies tax profile inputs
2. Frontend validates inputs
3. Frontend recalculates TEY locally (no server call needed)
4. Frontend re-sorts table
5. Frontend updates recommendation
6. Frontend updates chart if needed
```

#### Data Refresh
```
1. User clicks "Refresh Data" button
2. Frontend shows loading indicator
3. Frontend calls POST /api/refresh
4. Backend scrapes Schwab (takes 5-10 seconds)
5. Backend stores new data in DB
6. Backend returns fresh data
7. Frontend updates display
8. Frontend notifies user of update timestamp
```

### 7. Web Scraping Strategy

#### Target Page
- URL: https://www.schwab.com/money-market-funds
- Data needed: Fund names, yields, categories

#### Scraping Approach
**Option A: Puppeteer (headless browser)**
- Pros: Handles JavaScript, full page rendering
- Cons: Slower, more resource-intensive
- Use case: If data is dynamically loaded

**Option B: Cheerio (HTML parsing)**
- Pros: Fast, lightweight
- Cons: Won't execute JavaScript
- Use case: If data is in initial HTML

#### Expense Ratio Data
- May need to scrape individual fund pages
- Alternative: Use Schwab's fund screener tool
- Fallback: Manual curated data file for common funds

#### Rate Limiting & Caching
- Cache data for 6 hours minimum
- Implement exponential backoff on errors
- Respect robots.txt
- Add User-Agent header

### 8. Error Handling

#### Frontend
- Network errors: Show retry button
- Invalid input: Inline validation messages
- No data: Display friendly "please refresh" message
- Chart errors: Fallback to table view

#### Backend
- Scraping failures: Use cached data, log error
- Database errors: Return 500 with message
- Invalid requests: Return 400 with validation errors
- Rate limiting: Return 429 with retry-after header

### 9. Performance Considerations

#### Frontend
- Lazy load Chart.js (only when historical view opened)
- Debounce user input for calculations
- Virtual scrolling for large fund tables
- Minimize repaints/reflows

#### Backend
- Cache scrape results (6 hour TTL)
- Database indexing on fund_name and timestamp
- Connection pooling for SQLite
- Gzip compression for API responses

#### Database
- Keep only 1 year of historical data
- Run vacuum periodically
- Use prepared statements
- Batch inserts for historical data

### 10. Testing Strategy

#### Unit Tests
- Tax calculation functions
- Data parsing/scraping logic
- Database operations

#### Integration Tests
- API endpoint responses
- Frontend-backend communication
- Database transactions

#### Manual Testing
- Cross-browser compatibility
- Mobile responsiveness
- Edge cases (extreme incomes, etc.)
- Data accuracy verification

### 11. Deployment Options

#### Local Development
```bash
npm install
npm run dev  # Starts server on http://localhost:3000
```

#### Production Deployment Options
1. **Desktop App**: Package with Electron
2. **Cloud**: Deploy to Heroku/Railway/Vercel
3. **Self-hosted**: Run on local server/NAS
4. **Docker**: Containerize for easy deployment

### 12. Future Enhancements

#### Phase 2 Features
- User authentication & saved profiles
- Email alerts when optimal fund changes
- Mobile app (React Native)
- Additional brokerages (Vanguard, Fidelity)
- Portfolio allocation suggestions
- Tax-loss harvesting recommendations

#### Data Improvements
- Real-time yield updates (websocket)
- Historical performance beyond yields
- Risk metrics (standard deviation)
- Fund holdings transparency

## Security Considerations

1. **Input Validation**: Sanitize all user inputs
2. **Rate Limiting**: Prevent API abuse
3. **CORS**: Restrict to known origins
4. **SQL Injection**: Use parameterized queries
5. **XSS Protection**: Sanitize displayed data
6. **HTTPS**: Use SSL in production
7. **Environment Variables**: Store sensitive config separately

## Accessibility (A11Y)

1. **Semantic HTML**: Use proper tags
2. **ARIA Labels**: For interactive elements
3. **Keyboard Navigation**: Full keyboard support
4. **Screen Reader**: Test with NVDA/JAWS
5. **Color Contrast**: WCAG AA compliance
6. **Focus Indicators**: Clear focus states

## Documentation

1. **README.md**: Setup and usage instructions
2. **API.md**: API endpoint documentation
3. **CONTRIBUTING.md**: Development guidelines
4. **CHANGELOG.md**: Version history

## Success Metrics

1. Accurate tax-equivalent yield calculations
2. Data refresh within 10 seconds
3. Mobile-responsive (< 600ms interaction time)
4. Clear visual hierarchy (user testing)
5. < 5 second time to recommendation
6. Historical data retention (1 year minimum)

---

## Implementation Priority

### Phase 1 (MVP)
1. ✓ Design documentation (this file)
2. Project setup & dependencies
3. Database schema & initialization
4. Basic HTML/CSS structure
5. Tax calculation engine
6. Mock data (before scraping)
7. Results table & sorting
8. Basic styling

### Phase 2 (Core Features)
1. Web scraping implementation
2. Backend API endpoints
3. Historical data tracking
4. Chart.js integration
5. User profile customization
6. Recommendation logic
7. Data export functionality

### Phase 3 (Polish)
1. Responsive design refinement
2. Tooltips & educational content
3. Error handling & loading states
4. Performance optimization
5. Cross-browser testing
6. Documentation
7. Deploy preparation
