# Money Market Fund Tax-Equivalent Yield Optimizer

## Overview
Build a single-page HTML application that helps users optimize their cash allocation by comparing tax-equivalent yields across different money market funds from Schwab, accounting for their individual tax situation.

## Core Functionality

### 1. Data Collection
- Scrape money market fund data from https://www.schwab.com/money-market-funds
- Extract for retail funds with $0 minimum initial investment:
  - Fund names
  - Current yields (7-day yield)
  - Expense ratios (you will have to extract these from elsewhere)
  - Fund categories (for tax treatment determination)

### 2. Tax-Equivalent Yield Calculation
Based on methodology from https://sillymoney.com/tax-equivalent-yield-calculator

**Default User Profile:**
- Income: $200,000
- Filing Status: Single
- State: Missouri

**Fund Categories & Tax Treatment:**
1. **Taxable Money Market Funds**
   - Subject to federal and state income tax
   - No tax advantages

2. **Treasury Money Market Funds**
   - Tax-free at state and local level
   - Subject to federal income tax
   - Invest exclusively in US Treasuries

3. **Municipal Money Market Funds**
   - Tax-free at federal level
   - May be subject to state tax (unless from home state)
   - Invest in municipal bonds

4. **State-Specific Municipal Funds** (CA, NY, etc.)
   - Tax-free at both federal and state level
   - Only available for certain high-tax states
   - Not applicable for MO residents

**Calculation Formula:**
```
Tax-Equivalent Yield = Nominal Yield / (1 - Tax Rate)

Where Tax Rate depends on:
- Federal marginal tax rate (based on income/filing status)
- State marginal tax rate (Missouri: ~5.3%)
- Which taxes apply (based on fund category)
```

### 3. Expense Ratio Adjustment
- Net yield = Gross yield - Expense ratio
- Apply expense ratio before tax-equivalent yield calculation
- Display both gross and net yields in results

### 4. Results & Recommendation
Display sortable table with:
- Fund name
- Category
- Nominal yield
- Expense ratio
- Net yield (after expenses)
- Tax-equivalent yield
- Annual return estimate

**Highlight recommendation:**
- Fund with highest tax-equivalent yield (after expenses)
- Clear explanation of why it's optimal for the user's situation

### 5. Historical Tracking
- Store fund yield data in csv
- Track yields over time for each fund
- Display historical chart showing yield trends
- Allow users to see how optimal choice changes over time


## User Workflow

1. **View Current Funds**: App automatically loads and displays Schwab money market funds
2. **Adjust Tax Profile** (optional): User can modify income, filing status, state
3. **Compare Results**: View sorted table of tax-equivalent yields
4. **See Recommendation**: Top fund highlighted with explanation
5. **Review History**: Charts show how yields have changed over time
6. **Revisit Periodically**: App encourages regular checks as yields fluctuate

## Technical Implementation

### Frontend (Single HTML Page)
- Pure HTML/CSS/JavaScript (no frameworks required)
- Responsive design for mobile/desktop
- Interactive table with sorting capabilities
- Chart.js for historical yield visualization
- Form for tax profile customization

### Backend/Data Processing
- Web scraping of Schwab money market page (via proxy or CORS-friendly method)
- csv for historical data storage
- Tax calculation engine
- Data refresh mechanism (manual or automatic)

### Key Features
- Clean, intuitive UI
- Clear labeling of tax treatment for each fund type
- Tooltips explaining tax-equivalent yield concept
- Export functionality for results table
- Educational content about different fund types

## Important Considerations

1. **Data Accuracy**: Yields change frequently; timestamp all data
2. **Tax Rates**: Use current 2024/2025 tax brackets; allow manual override
3. **State Variations**: MO doesn't have state-specific muni funds; clearly communicate limitations
4. **Expense Ratios**: Ensure these are factored into final comparisons
5. **Disclaimer**: Add note that this is for educational purposes and not financial advice

## Success Metrics
- User can quickly identify optimal money market fund for their situation
- Clear understanding of why one fund beats another after taxes
- Historical data helps user make informed decisions about when to revisit allocation
- Simple enough for non-financial experts to use confidently