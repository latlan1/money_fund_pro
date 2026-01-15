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
│              Data Layer (optional, legacy)              │
│  ┌──────────────────────────────────────────────────┐   │
│  │  Historical CSV snapshots                       │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

## Project Structure

```
money_fund_pro/
├── AGENTS.md                    # Project requirements
├── DESIGN.md                    # This file
├── README.md                    # Setup/usage instructions
├── SETUP.md                     # Installation and setup guide
├── package.json                 # Node.js dependencies
├── jest.config.js               # Jest test configuration
├── server.js                    # Express backend server
├── public/                      # Frontend assets
│   ├── index.html              # Main SPA
│   ├── css/
│   │   └── styles.css          # Styles (glassmorphism design)
│   ├── js/
│   │   ├── app.js              # Main app logic
│   │   ├── data-utils.js       # CSV parsing & fund categorization
│   │   ├── tax-calculator.js   # Tax calculation module
│   │   ├── chart-handler.js    # Chart.js wrapper
│   │   └── csv-loader.js       # CSV file loading utilities
│   ├── assets/
│   │   ├── favicon-green-dollar.png    # Default favicon
│   │   └── favicon-coin-gradient.png   # Alternate favicon
│   └── schwab_money_funds_*.csv        # Historical CSV snapshots
├── src/                         # Backend/Node.js modules
│   ├── data-utils.js           # Shared data utilities (Node.js copy)
│   ├── scraper.js              # Web scraping logic
│   └── tax-engine.js           # Shared tax calculations
├── tests/                       # Jest test files
│   └── data-loading.test.js    # Data loading & parsing tests
└── docs/                        # GitHub Pages deployment
```

## Component Design

### 1. Frontend (Single-Page Application)

#### 1.1 HTML Structure (index.html)

```html
<body>
  <header>- App title and description - Disclaimer notice</header>

  <section id="tax-profile">
    - Income input - Filing status dropdown - State dropdown - Calculate button
  </section>

  <section id="results">
    - Loading indicator - Sortable table - Recommendation card (highlighted)
  </section>

  <section id="historical">
    - Chart.js canvas - Time range selector - Fund comparison selector
  </section>

  <footer>
    - Refresh data button - Export button - Dynamic data date - Educational
    tooltips
  </footer>
</body>
```

#### 1.2 CSS Design (styles.css)

- **Modern Glassmorphism**: Semi-transparent cards with backdrop blur
- **Layout**: CSS Grid/Flexbox responsive design
- **Typography**: Inter font family (Google Fonts)
- **Components**:
  - Cards with glassmorphism effects and subtle shadows
  - Responsive table with sticky header
  - Gradient buttons with hover animations
  - Tooltip styling
  - Mobile breakpoints (< 768px)

#### Color Palette

```css
:root {
  --primary-blue: #3b82f6;
  --secondary-blue: #60a5fa;
  --accent-purple: #8b5cf6;
  --success-green: #10b981;
  --warning-yellow: #f59e0b;
  --accent-cyan: #06b6d4;
  --text-dark: #1f2937;
  --text-light: #6b7280;
  --bg-light: #f8fafc;
  --bg-white: rgba(255, 255, 255, 0.9);
  --border-gray: #e2e8f0;
}
```

#### 1.3 JavaScript Modules

**app.js** - Main application controller

```javascript
- Initialize app on load
- Handle user input events
- Fetch data from API
- Update UI with results (table with row numbers)
- Manage application state
- Handle sorting and filtering
- Display Type (CSV category) and Fund Category columns
- updateLastUpdated(dateString) → Updates both header and footer data dates
```

**data-utils.js** - CSV parsing and fund categorization

```javascript
// Dual export for browser (window.DataUtils) and Node.js (module.exports)

// CSV Parsing
- parseCSV(text) → Array<Object>       // Parse CSV text to array of objects
- parseCSVLine(line) → Array<string>   // Handle quoted fields, escaped quotes
- cleanValue(val) → string             // Remove whitespace and quotes

// Fund Categorization
- categorizeFund(row) → string         // Internal category key (taxable, treasury, etc.)
- getFundCategory(fundName, csvCategory) → string  // User-friendly tax treatment

// Data Transformation
- transformRowToFund(row) → Object     // CSV row to fund object with both categories
- getAllFunds(rows) → Array<Object>    // Transform ALL funds for table display
- filterRetailFunds(rows) → Array<Object>  // Filter to $0 minimum retail funds

// Chart Data Processing
- transformRowsForChart(rows, dateStr) → Array<Object>  // Prepare chart data points
- aggregateChartData(dataPoints) → Object  // Average yields by Fund Category per date

// Date Utilities
- parseDateMMDDYYYY(dateStr) → Date    // Parse MM-DD-YYYY format
- sortCsvFilesByDate(csvList) → Array  // Sort CSV files newest first
```

**tax-calculator.js** - Tax calculation logic

```javascript
- Tax bracket constants (2024/2025)
- calculateFederalTax(income, filingStatus)
- calculateStateTax(income, state)
- calculateTaxEquivalentYield(fund, userProfile)  // Returns object with fundCategory
- getEffectiveTaxRate(income, filingStatus, state, fundCategory)
```

**chart-handler.js** - Historical visualization

```javascript
// Category colors for 4 Fund Categories
const CATEGORY_COLORS = {
  "Taxable - Subject to all taxes": { border: "#2563eb", ... },
  "Treasury - State tax-free": { border: "#10b981", ... },
  "Municipal - Federal tax-free": { border: "#f59e0b", ... },
  "State Municipal - Both tax-free (residents only)": { border: "#06b6d4", ... },
};

- initChart(canvasId) → Chart instance
- updateChartData(chart, chartData, selectedRange)
- Responsive legend placement (desktop: right, mobile: bottom)
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

(Database module removed for static-first build. Historical data is handled via CSV snapshots when needed.)

**tax-engine.js** - Tax calculations (shared)

```javascript
- Same logic as frontend tax-calculator.js
- Used for backend calculations
- Ensures consistency between frontend/backend
```

### 3. Data Handling

- Primary flow is static-first: frontend consumes CSV/JSON snapshots.
- For dynamic scraping, see `scripts/` utilities that write CSV snapshots.
- No live database is required for the current deployment model.

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
    { min: 0, max: 11600, rate: 0.1 },
    { min: 11600, max: 47150, rate: 0.12 },
    { min: 47150, max: 100525, rate: 0.22 },
    { min: 100525, max: 191950, rate: 0.24 },
    { min: 191950, max: 243725, rate: 0.32 },
    { min: 243725, max: 609350, rate: 0.35 },
    { min: 609350, max: Infinity, rate: 0.37 },
  ],
  married: [
    { min: 0, max: 23200, rate: 0.1 },
    { min: 23200, max: 94300, rate: 0.12 },
    { min: 94300, max: 201050, rate: 0.22 },
    { min: 201050, max: 383900, rate: 0.24 },
    { min: 383900, max: 487450, rate: 0.32 },
    { min: 487450, max: 731200, rate: 0.35 },
    { min: 731200, max: Infinity, rate: 0.37 },
  ],
};

const STATE_TAX_RATES = {
  MO: 0.053,
  CA: 0.133,
  NY: 0.109,
  // ... other states
};
```

#### Fund Category Tax Treatment

The app uses a **two-level categorization system**:

1. **Type** (csvCategory): Original category from Schwab CSV data
   - Taxable Money Funds
   - Tax-Exempt Money Funds
   - Sweep Money Fund
   - Money Market ETF

2. **Fund Category** (fundCategory): Tax treatment for calculations and display

```javascript
// getFundCategory() mapping logic (in data-utils.js)

const FUND_CATEGORIES = {
  "Taxable - Subject to all taxes": {
    // Prime funds, Government funds, Sweep, ETF
    federalTaxable: true,
    stateTaxable: true,
    description: "Subject to both federal and state income tax",
  },
  "Treasury - State tax-free": {
    // U.S. Treasury and Treasury Obligations funds
    federalTaxable: true,
    stateTaxable: false,
    description: "Federal taxable, exempt from state income tax",
  },
  "Municipal - Federal tax-free": {
    // Municipal and AMT Tax-Free funds
    federalTaxable: false,
    stateTaxable: true,
    description: "Exempt from federal tax, subject to state tax",
  },
  "State Municipal - Both tax-free (residents only)": {
    // California and New York Municipal funds
    federalTaxable: false,
    stateTaxable: false, // Only if resident of that state
    description: "Exempt from both taxes for state residents",
  },
};
```

**Fund Name → Fund Category Mapping:**

| Fund Name Contains                      | Fund Category                                    |
| --------------------------------------- | ------------------------------------------------ |
| "California", "New York"                | State Municipal - Both tax-free (residents only) |
| "Municipal", Tax-Exempt category        | Municipal - Federal tax-free                     |
| "U.S. Treasury", "Treasury Obligations" | Treasury - State tax-free                        |
| "Government", "Prime", Sweep, ETF       | Taxable - Subject to all taxes                   |

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

- **Modern & Clean**: Glassmorphism aesthetic with semi-transparent cards
- **Data-Driven**: Focus on numbers and comparisons
- **Educational**: Tooltips and explanations
- **Responsive**: Mobile-first design with Inter font

#### Color Palette

```css
:root {
  --primary-blue: #3b82f6;
  --secondary-blue: #60a5fa;
  --accent-purple: #8b5cf6;
  --success-green: #10b981;
  --warning-yellow: #f59e0b;
  --accent-cyan: #06b6d4;
  --text-dark: #1f2937;
  --text-light: #6b7280;
  --bg-gradient: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  --card-bg: rgba(255, 255, 255, 0.9);
  --border-gray: #e2e8f0;
}
```

#### Key UI Components

**Tax Profile Card**

- Clean form layout
- Input validation
- Real-time preview of tax rates
- Save/load profile functionality

**Results Table**

- Row numbers (# column) for easy reference
- Sticky header on scroll
- Sortable columns (click header)
- **Type column**: Original CSV category
- **Fund Category column**: Tax treatment description
- Highlighted top recommendation
- Expandable rows for detailed tax calculation
- Color coding (green for best)
- Scrollable with "scroll for more" indicator (~10 rows visible)

**Recommendation Card**

- Large, prominent display
- Fund name + key metrics
- "Why is this optimal?" explanation
- One-click action ("Learn More")

**Historical Chart**

- Line chart showing yield over time
- **Aggregated by Fund Category** (4 categories, not individual funds):
  - Taxable - Subject to all taxes (blue)
  - Treasury - State tax-free (green)
  - Municipal - Federal tax-free (yellow/amber)
  - State Municipal - Both tax-free (cyan)
- Date range selector (7 days, 30 days, 90 days, All Time)
- Responsive legend (right on desktop, bottom on mobile)
- Interactive tooltips with yield values

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
- Rate limiting: Return 429 with retry-after header

#### Backend

- Cache scrape results (6 hour TTL)
- Prefer cached/static data; avoid live DB writes in production static build
- Gzip compression for API responses

#### Data storage (optional)

- If using a datastore, keep only recent historical data
- Batch writes for historical data

### 10. Testing Strategy

#### Unit Tests (Jest)

- **61+ tests** with >95% code coverage
- Tax calculation functions (tax-calculator.js)
- CSV parsing and fund categorization (data-utils.js)
- getFundCategory() mapping validation
- Chart data aggregation

#### Test Files

```
tests/
└── data-loading.test.js    # Comprehensive data & tax calculation tests
```

#### Run Tests

```bash
npm test                    # Run all tests
npm test -- --coverage      # Run with coverage report
```

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

### Phase 1 (MVP) - COMPLETE

1. ✅ Design documentation (this file)
2. ✅ Project setup & dependencies
3. ✅ Basic HTML/CSS structure
4. ✅ Tax calculation engine
5. ✅ CSV data loading
6. ✅ Results table & sorting
7. ✅ Basic styling

### Phase 2 (Core Features) - COMPLETE

1. ✅ CSV-based data loading (no live scraping needed)
2. ✅ Backend API endpoints
3. ✅ Historical data tracking via CSV snapshots
4. ✅ Chart.js integration with Fund Category aggregation
5. ✅ User profile customization
6. ✅ Recommendation logic
7. ✅ Data export functionality

### Phase 3 (Polish) - COMPLETE

1. ✅ Modern glassmorphism design
2. ✅ Row numbers and Fund Category columns
3. ✅ Error handling & loading states
4. ✅ 61+ unit tests with >95% coverage
5. ✅ Cross-browser testing
6. ✅ Documentation updates

---

**Version**: 1.1.0
**Last Updated**: January 2026
