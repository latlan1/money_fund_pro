# Money Market Fund Tax-Equivalent Yield Optimizer

A web application that helps optimize cash allocation by comparing tax-equivalent yields across Schwab money market funds based on individual tax situations.

## Features

- 📊 **Real-time Fund Comparison**: Compare yields across multiple money market fund types
- 💰 **Tax-Equivalent Yield Calculation**: Accounts for federal and state taxes
- 📈 **Historical Tracking**: View yield trends over time with interactive charts
- 🎯 **Personalized Recommendations**: Get optimal fund suggestions based on your tax profile
- 📱 **Responsive Design**: Works seamlessly on desktop and mobile devices
- 💾 **Data Export**: Export comparison results for your records

## Fund Categories Supported

1. **Taxable Money Market Funds** - Subject to federal and state taxes
2. **Treasury Money Market Funds** - Federal taxable, state tax-free
3. **Municipal Money Market Funds** - Federal tax-free, state taxable (unless home state)
4. **State-Specific Municipal Funds** - Tax-free at both levels (for residents)

## Quick Start

### Prerequisites

- Node.js 16+ and npm
- SQLite3

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
- Automatically loads current Schwab money market fund data
- View sortable table with all fund metrics
- Top recommendation highlighted in green

### 3. Analyze Historical Trends
- Select funds to compare over time
- Choose date range for analysis
- Interactive charts show yield movements

### 4. Refresh Data
- Click "Refresh Data" to fetch latest yields from Schwab
- Data automatically cached for 6 hours

### 5. Export Results
- Export comparison table to CSV or JSON
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
If a municipal bond yields 3.5% (tax-free) and your combined tax rate is 35%:
- TEY = 3.5% / (1 - 0.35) = 5.38%
- A taxable fund would need to yield 5.38% to match the after-tax return

## Project Structure

```
money_fund_pro/
├── AGENTS.md                   # Project requirements
├── DESIGN.md                   # Architecture documentation
├── README.md                   # This file
├── package.json                # Dependencies
├── server.js                   # Express backend
├── public/                     # Frontend files
│   ├── index.html             # Main SPA
│   ├── css/
│   │   └── styles.css         # Application styles
│   └── js/
│       ├── app.js             # Main application logic
│       ├── tax-calculator.js  # Tax calculation module
│       └── chart-handler.js   # Chart visualization
├── src/                        # Backend modules
│   ├── scraper.js             # Web scraping
│   ├── database.js            # SQLite operations
│   └── tax-engine.js          # Tax calculations
└── data/
    └── fund_data.db           # SQLite database (auto-created)
```

## API Endpoints

### GET /api/funds
Returns current money market fund data with yields and expense ratios.

**Response:**
```json
[
  {
    "fundName": "Schwab Value Advantage Money Fund",
    "symbol": "SWVXX",
    "category": "taxable",
    "grossYield": 4.84,
    "expenseRatio": 0.34,
    "netYield": 4.50,
    "lastUpdated": "2024-12-14T19:30:00Z"
  }
]
```

### POST /api/calculate
Calculate tax-equivalent yields based on user profile.

**Request Body:**
```json
{
  "income": 200000,
  "filingStatus": "single",
  "state": "MO",
  "funds": [...] // Fund array from GET /api/funds
}
```

### GET /api/history/:fundName
Get historical yield data for a specific fund.

**Query Parameters:**
- `startDate` (optional): ISO date string
- `endDate` (optional): ISO date string

### POST /api/refresh
Trigger fresh scrape of Schwab data (rate-limited).

## Development

### Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm start` - Start production server
- `npm test` - Run test suite
- `npm run scrape` - Manually trigger data scrape
- `npm run db:init` - Initialize database
- `npm run db:seed` - Seed with sample data

### Environment Variables

Create a `.env` file in the root directory:

```env
PORT=3000
NODE_ENV=development
DATABASE_PATH=./data/fund_data.db
CACHE_DURATION=21600  # 6 hours in seconds
LOG_LEVEL=info
```

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
- Missouri: 5.3%
- California: 13.3%
- New York: 10.9%
- *(More states available in app)*

## Important Disclaimers

⚠️ **Educational Purpose Only**: This tool is for educational and informational purposes only. It is not financial advice.

⚠️ **Consult Professionals**: Always consult with a qualified tax professional or financial advisor before making investment decisions.

⚠️ **Data Accuracy**: Fund yields change frequently. Always verify current rates before investing.

⚠️ **Tax Complexity**: Individual tax situations vary. This calculator uses marginal rates and may not account for all tax scenarios (AMT, AGI limitations, etc.).

## Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

### Development Guidelines
1. Follow existing code style
2. Write tests for new features
3. Update documentation
4. Keep commits atomic and descriptive

## Troubleshooting

### Data not loading
- Check if server is running on port 3000
- Verify Schwab website is accessible
- Check console for error messages

### Database errors
- Ensure `data/` directory exists with write permissions
- Try running `npm run db:init` to reinitialize

### Scraping issues
- Schwab website structure may change
- Check `src/scraper.js` for updates needed
- Consider using cached data temporarily

## License

MIT License - See [LICENSE](LICENSE) file for details

## Acknowledgments

- Tax calculation methodology from [Silly Money Tax-Equivalent Yield Calculator](https://sillymoney.com/tax-equivalent-yield-calculator)
- Fund data from [Charles Schwab](https://www.schwab.com/money-market-funds)
- Chart visualization powered by [Chart.js](https://www.chartjs.org/)

## Support

For issues, questions, or suggestions:
- Open an issue on GitHub
- Email: support@example.com
- Documentation: See [DESIGN.md](DESIGN.md) for technical details

## Roadmap

### Version 1.1
- [ ] Additional brokerage support (Vanguard, Fidelity)
- [ ] User authentication and saved profiles
- [ ] Email alerts when optimal fund changes
- [ ] Mobile app version

### Version 2.0
- [ ] Portfolio allocation recommendations
- [ ] Tax-loss harvesting suggestions
- [ ] Real-time yield updates
- [ ] Risk metrics and analysis

---

**Last Updated**: December 2025 | **Version**: 1.0.0
