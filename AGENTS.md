# Money Market Fund Tax-Equivalent Yield Optimizer

## Overview

Build a single-page HTML application that helps users optimize their cash allocation by comparing tax-equivalent yields across different money market funds from Schwab, accounting for their individual tax situation.

## Core Functionality

### 1. Data Collection

- Scrape money market fund data from https://www.schwab.com/money-market-funds
- Extract ALL funds (not just retail with $0 minimum):
  - Fund names
  - Current yields (7-day yield)
  - Expense ratios
  - Fund types (from CSV Category column)
- Store data in CSV files with naming convention: `schwab_money_funds_MM-DD-YYYY.csv`

### 2. Tax-Equivalent Yield Calculation

Based on methodology from https://sillymoney.com/tax-equivalent-yield-calculator

**Default User Profile:**

- Income: $200,000
- Filing Status: Single
- State: Missouri

**Fund Categories (Tax Treatment):**

The app uses a two-level categorization system:

1. **Type** (from CSV): The original category from Schwab data
   - Taxable Money Funds
   - Tax-Exempt Money Funds
   - Sweep Money Fund
   - Money Market ETF

2. **Fund Category** (derived from fund name): Tax treatment for calculations
   - **Taxable - Subject to all taxes**: Prime funds, Government funds, Sweep, ETF
   - **Treasury - State tax-free**: U.S. Treasury and Treasury Obligations funds
   - **Municipal - Federal tax-free**: Municipal and AMT Tax-Free funds
   - **State Municipal - Both tax-free (residents only)**: California and New York Municipal funds

**Calculation Formula:**

```
Tax-Equivalent Yield = Nominal Yield / (1 - Tax Rate)

Where Tax Rate depends on:
- Federal marginal tax rate (based on income/filing status)
- State marginal tax rate (Missouri: ~4.7%)
- Which taxes apply (based on Fund Category)
```

### 3. Expense Ratio Adjustment

- Net yield = Gross yield - Expense ratio
- Apply expense ratio before tax-equivalent yield calculation
- Display both gross and net yields in results

### 4. Results & Recommendation

Display sortable table with:

- Row number (#)
- Fund name
- Ticker symbol
- Type (original CSV category)
- Fund Category (tax treatment description)
- 7-Day Yield (gross)
- Expense ratio
- Net yield (after expenses)
- Tax-equivalent yield
- Annual return estimate ($10k investment)

**Highlight recommendation:**

- Fund with highest tax-equivalent yield (after expenses)
- Clear explanation of why it's optimal for the user's situation
- Click any row to see detailed tax calculation math

### 5. Historical Tracking

- Store fund yield data in CSV files (one per data pull date)
- Track yields over time for each fund
- Display historical chart showing yield trends by Fund Category:
  - Taxable - Subject to all taxes (blue)
  - Treasury - State tax-free (green)
  - Municipal - Federal tax-free (yellow)
  - State Municipal - Both tax-free (cyan)
- Date range selector: 7 days, 30 days, 90 days, All Time

## User Workflow

1. **View Current Funds**: App automatically loads and displays ALL Schwab money market funds
2. **Adjust Tax Profile** (optional): User can modify income, filing status, state
3. **Compare Results**: View sortable table with row numbers and tax treatment
4. **See Recommendation**: Top fund highlighted with explanation
5. **View Calculation Details**: Click any row to see step-by-step tax math
6. **Review History**: Charts show yield trends by Fund Category over time
7. **Revisit Periodically**: App encourages regular checks as yields fluctuate

## Technical Implementation

### Frontend (Single HTML Page)

- Pure HTML/CSS/JavaScript (no frameworks required)
- Responsive design for mobile/desktop
- Scrollable table (~10 rows visible) with sorting capabilities
- Chart.js for historical yield visualization by Fund Category
- Form for tax profile customization
- Modal for detailed calculation explanations

### Data Layer

- CSV files stored in `public/` directory
- Server endpoint `/api/csv-files` returns list of available CSV files
- `data-utils.js` module handles CSV parsing and fund categorization
- No database required - static CSV approach

### Key JavaScript Modules

- `data-utils.js` - CSV parsing, fund categorization, getFundCategory()
- `tax-calculator.js` - Tax bracket data, TEY calculations
- `chart-handler.js` - Chart.js visualization by Fund Category
- `app.js` - Main application orchestration

### Key Features

- Clean, intuitive UI with row numbers for easy reference
- Dual categorization: Type (original) + Fund Category (tax treatment)
- Scrollable table with "scroll for more" indicator
- Click-to-expand tax calculation details
- Export functionality for results table
- Educational content about different fund types
- **Dynamic footer date**: Footer automatically displays the date of the most recent CSV data file

## Important Considerations

1. **Data Accuracy**: Yields change frequently; timestamp all data via CSV filename
2. **Tax Rates**: Use current 2024/2025 tax brackets; allow manual override
3. **State Variations**: MO doesn't have state-specific muni funds; clearly communicate limitations
4. **Expense Ratios**: Ensure these are factored into final comparisons
5. **Disclaimer**: Add note that this is for educational purposes and not financial advice
6. **Assets**: Favicons live in `public/assets` (green dollar is default; gradient coin kept as alternative)
7. **All Funds**: Display ALL funds regardless of minimum investment or investor eligibility

## Success Metrics

- User can quickly identify optimal money market fund for their situation
- Clear understanding of why one fund beats another after taxes
- Historical data helps user make informed decisions about when to revisit allocation
- Simple enough for non-financial experts to use confidently
- 61+ unit tests with >95% code coverage
