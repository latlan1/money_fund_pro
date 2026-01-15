# Money Market Fund Tax-Equivalent Yield Optimizer

A modern web application that helps optimize cash allocation by comparing tax-equivalent yields across Schwab money market funds based on individual tax situations.

## Features

- **Real-time Fund Comparison**: Compare yields across ALL Schwab money market funds (18 funds)
- **Tax-Equivalent Yield Calculation**: Accounts for federal and state taxes with detailed math explanations
- **Historical Tracking**: View yield trends over time with interactive charts by Fund Category
- **Personalized Recommendations**: Get optimal fund suggestions based on your tax profile
- **Modern UI**: Glassmorphism design, responsive layout, Inter font typography
- **Data Export**: Export comparison results for your records
- **Row Numbers**: Easy reference with numbered table rows
- **Click for Details**: Click any row to see step-by-step tax calculation math
- **Dynamic Footer Date**: Footer automatically displays the date of the most recent CSV data file

## Fund Categories (Tax Treatment)

The app uses a two-level categorization system:

### Type (Original CSV Category)

- Taxable Money Funds
- Tax-Exempt Money Funds
- Sweep Money Fund
- Money Market ETF

### Fund Category (Tax Treatment)

1. **Taxable - Subject to all taxes** - Prime, Government, Sweep, ETF funds
2. **Treasury - State tax-free** - U.S. Treasury and Treasury Obligations funds
3. **Municipal - Federal tax-free** - Municipal and AMT Tax-Free funds
4. **State Municipal - Both tax-free (residents only)** - California and New York Municipal funds

## Quick Start

### Prerequisites

- Node.js 16+ and npm

### Installation

1. Clone the repository:

```bash
git clone <repository-url>
cd money_fund_pro
```

2. Install dependencies:

```bash
npm install
```

3. Start the development server:

```bash
npm run dev
```

4. Open your browser to `http://localhost:3000`

## Usage

### 1. Set Your Tax Profile

- Enter your annual income
- Select filing status (Single, Married, Head of Household)
- Choose your state of residence
- Default profile: $200,000, Single, Missouri

### 2. View Fund Comparison

- Automatically loads ALL Schwab money market funds (not just retail)
- View sortable table with:
  - Row number (#)
  - Fund name and ticker
  - Type (original category)
  - Fund Category (tax treatment)
  - 7-Day Yield, Expense Ratio, Net Yield
  - Tax-Equivalent Yield
  - Annual Return ($10k investment)
- Top recommendation highlighted in green
- Click any row to see detailed tax math

### 3. Analyze Historical Trends

- View yield trends by Fund Category over time
- Select date range: 7 days, 30 days, 90 days, All Time
- Chart shows 4 category lines with distinct colors

### 4. Refresh Data

- Click "Refresh Data" to reload latest yields
- Data stored in CSV files with date stamps

### 5. Export Results

- Export comparison table to CSV
- Save for your records or tax planning

## Understanding Tax-Equivalent Yield

**Tax-Equivalent Yield (TEY)** = The yield a taxable investment would need to equal the after-tax return of a tax-advantaged investment.

### Calculation Formula

```
TEY = Net Yield / (1 - Effective Tax Rate)

Where:
- Net Yield = Gross Yield - Expense Ratio
- Effective Tax Rate = Combined federal and state marginal rates (where applicable)
```

### Example

If a municipal fund yields 1.5% (federal tax-free) and your federal rate is 32%:

- TEY = 1.5% / (1 - 0.32) = 2.21%
- A taxable fund would need to yield 2.21% to match the after-tax return

## Project Structure

```
money_fund_pro/
├── AGENTS.md                   # Project requirements
├── DESIGN.md                   # Architecture documentation
├── README.md                   # This file
├── SETUP.md                    # Setup guide
├── package.json                # Dependencies
├── jest.config.js              # Test configuration
├── server.js                   # Express backend
├── public/                     # Frontend files
│   ├── index.html             # Main SPA
│   ├── css/
│   │   └── styles.css         # Modern glassmorphism styles
│   ├── js/
│   │   ├── app.js             # Main application logic
│   │   ├── data-utils.js      # CSV parsing, fund categorization
│   │   ├── tax-calculator.js  # Tax calculation module
│   │   └── chart-handler.js   # Chart.js visualization
│   ├── assets/                # Favicons and static assets
│   └── schwab_money_funds_*.csv  # Historical data snapshots
├── src/                        # Backend/test modules
│   └── data-utils.js          # Shared data utilities
└── tests/                      # Unit tests
    └── data-loading.test.js   # 61 tests, >95% coverage
```

## API Endpoints

### GET /api/csv-files

Returns list of available CSV data files.

**Response:**

```json
[
  { "name": "schwab_money_funds_01-13-2026.csv", "date": "01-13-2026" },
  { "name": "schwab_money_funds_12-31-2025.csv", "date": "12-31-2025" }
]
```

### Static CSV Files

CSV files are served directly from `/public/` directory:

- `GET /schwab_money_funds_MM-DD-YYYY.csv`

## Development

### Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm start` - Start production server
- `npm test` - Run unit tests with coverage
- `npm run test:watch` - Run tests in watch mode

### Testing

```bash
# Run all tests with coverage report
npm test

# Current status: 61 tests, >95% coverage
```

Tests cover:

- **CSV Parsing** - Quoted fields, commas, escaped quotes
- **Fund Categorization** - All 6 types + getFundCategory()
- **Date Handling** - MM-DD-YYYY format parsing and sorting
- **Chart Data** - Aggregation by Fund Category
- **Data Integrity** - Valid yields, expense ratios, tickers

### Pre-commit Hook

Tests run automatically before every commit via Husky.

## Tax Rates (2024/2025)

### Federal Tax Brackets (Single Filers)

- 10%: $0 - $11,600
- 12%: $11,601 - $47,150
- 22%: $47,151 - $100,525
- 24%: $100,526 - $191,950
- 32%: $191,951 - $243,725
- 35%: $243,726 - $609,350
- 37%: $609,351+

### State Tax Rates (Top Marginal)

- Missouri: 4.7%
- California: 13.3%
- New York: 10.9%
- _(More states available in app)_

## Important Disclaimers

**Educational Purpose Only**: This tool is for educational and informational purposes only. It is not financial advice.

**Consult Professionals**: Always consult with a qualified tax professional or financial advisor before making investment decisions.

**Data Accuracy**: Fund yields change frequently. Always verify current rates before investing.

**Tax Complexity**: Individual tax situations vary. This calculator uses marginal rates and may not account for all tax scenarios.

## Contributing

1. Follow existing code style
2. Write tests for new features
3. Update documentation
4. Run `npm test` before committing

## Troubleshooting

### Data not loading

- Check if server is running on port 3000
- Hard refresh browser (Cmd+Shift+R)
- Check browser console for errors

### Tests failing

- Run `npm install` to ensure dependencies are current
- Check that CSV files exist in `public/` directory

## License

MIT License - See LICENSE file for details

## Acknowledgments

- Tax calculation methodology from [Silly Money Tax-Equivalent Yield Calculator](https://sillymoney.com/tax-equivalent-yield-calculator)
- Fund data from [Charles Schwab](https://www.schwab.com/money-market-funds)
- Chart visualization powered by [Chart.js](https://www.chartjs.org/)
- Typography by [Inter Font](https://fonts.google.com/specimen/Inter)

---

**Version 1.1.0** | **Last Updated**: January 2026
