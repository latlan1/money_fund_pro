# Money Market Fund Tax-Equivalent Yield Optimizer - Setup Guide

## Quick Start

### 1. Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** 16.x or higher ([Download](https://nodejs.org/))
- **npm** 8.x or higher (comes with Node.js)

### 2. Installation

1. **Clone or navigate to the project directory:**

```bash
cd money_fund_pro
```

2. **Install dependencies:**

```bash
npm install
```

This will install all required packages including:

- Express (web server)
- Puppeteer (web scraping)
- Chart.js (visualization)
- And other dependencies

3. **Configure environment variables (optional for static use):**

If you are serving the static frontend only, you can skip `.env` entirely. For running the Node server or scraper, copy `.env.example` to `.env` and adjust:

```bash
cp .env.example .env
# Optional: edit values
```

Default configuration (server mode):

- Port: 3000
- Cache Duration: 6 hours
- Mock Data: Enabled (for testing)

### 3. Run the Application

**Option A: Static frontend (recommended):**
Open `public/index.html` directly (or serve `public/` with any static file server).

**Option B: Node server:**

```bash
npm run dev
# or
npm start
```

You should see (server mode):

```
🚀 Money Fund Pro Server running on http://localhost:3000
📊 API available at http://localhost:3000/api
💾 Database: /path/to/data/fund_data.db
🔄 Cache TTL: 21600 seconds (6 hours)
```

### 4. Access the Application

- Static: open `public/index.html` or the served `public/` URL
- Server: visit `http://localhost:3000`

Or for production:

```bash
npm start
```

You should see:

```
🚀 Money Fund Pro Server running on http://localhost:3000
📊 API available at http://localhost:3000/api
🔄 Cache TTL: 21600 seconds (6 hours)
```

### 4. Access the Application

Open your browser and navigate to:

```
http://localhost:3000
```

## Project Structure

```
money_fund_pro/
├── public/                 # Frontend files (served statically)
│   ├── index.html         # Main HTML page
│   ├── css/
│   │   └── styles.css     # Application styles (glassmorphism design)
│   ├── js/
│   │   ├── app.js         # Main app logic
│   │   ├── data-utils.js  # CSV parsing & fund categorization
│   │   ├── tax-calculator.js # Tax calculations
│   │   ├── chart-handler.js  # Chart.js wrapper
│   │   └── csv-loader.js  # CSV file loading utilities
│   ├── assets/            # Favicons and static assets
│   │   ├── favicon-green-dollar.png   # Default favicon
│   │   └── favicon-coin-gradient.png  # Alternate option
│   └── schwab_money_funds_*.csv       # Historical CSV snapshots
├── src/                    # Backend/Node.js modules
│   ├── data-utils.js      # Shared data utilities (Node.js copy)
│   ├── tax-engine.js      # Server-side tax calculations
│   └── scraper.js         # Web scraping logic
├── tests/                  # Jest test files
│   └── data-loading.test.js  # Data loading & parsing tests
├── docs/                   # GitHub Pages deployment
├── server.js               # Express server
├── package.json            # Dependencies
├── jest.config.js          # Jest test configuration
└── README.md               # Documentation
```

## Configuration

### Environment Variables (.env) — only for server/scraper

```env
# Server
PORT=3000
NODE_ENV=development

# Cache (in seconds)
CACHE_DURATION=21600  # 6 hours

# Scraping
USE_MOCK_DATA=true    # Use mock data for testing
```

### Mock Data vs Real Scraping

**Mock Data (Default):**

- Set `USE_MOCK_DATA=true`
- Uses predefined Schwab fund data
- Perfect for development and testing
- No external requests needed

**Real Scraping:**

- Set `USE_MOCK_DATA=false`
- Scrapes live data from Schwab website
- Requires updating scraper selectors if site structure changes
- Note: May require additional setup for production

## Features

### 1. Tax Profile Customization

- Set your annual income
- Choose filing status (Single, Married, Head of Household)
- Select your state of residence
- View calculated federal, state, and combined tax rates

### 2. Fund Comparison

- Compare ALL Schwab money market funds (not just retail)
- View tax-equivalent yields based on your profile
- See gross yield, expense ratios, and net yields
- **Type column**: Original CSV category
- **Fund Category column**: Tax treatment description
- Sortable columns for easy comparison
- Row numbers for easy reference

### 3. Top Recommendation

- Automatically highlights the best fund for your situation
- Detailed explanation of why it's optimal
- Shows estimated annual returns

### 4. Historical Tracking

- View yield trends over time
- **Aggregated by Fund Category** (4 categories):
  - Taxable - Subject to all taxes (blue)
  - Treasury - State tax-free (green)
  - Municipal - Federal tax-free (yellow)
  - State Municipal - Both tax-free (cyan)
- Select date ranges (7 days, 30 days, 90 days, All Time)
- Interactive charts with Chart.js

### 5. Data Export

- Export comparison results to CSV
- Save for tax planning or records

## API Endpoints

The application provides several REST API endpoints:

### GET /api/funds

Returns current fund data with yields and expense ratios.

**Response:**

```json
[
  {
    "fundName": "Schwab Value Advantage Money Fund",
    "symbol": "SWVXX",
    "category": "taxable",
    "grossYield": 4.84,
    "expenseRatio": 0.34,
    "netYield": 4.5,
    "lastUpdated": "2024-12-14T20:00:00Z"
  }
]
```

### POST /api/calculate

Calculate tax-equivalent yields based on user profile.

**Request:**

```json
{
  "income": 200000,
  "filingStatus": "single",
  "state": "MO",
  "funds": [...]
}
```

### GET /api/history/:fundName

Get historical yield data for a specific fund.

**Query Parameters:**

- `startDate`: ISO date string (optional)
- `endDate`: ISO date string (optional)

### POST /api/refresh

Trigger fresh data fetch (rate-limited to 10 requests per hour).

### GET /api/health

Health check endpoint.

## Development

### Available Scripts

```bash
# Start development server with auto-reload
npm run dev

# Start production server
npm start

# Run tests (if configured)
npm test

# Lint code
npm run lint

# Format code
npm run format

# Manually trigger data scrape
npm run scrape
```

## Troubleshooting

### Port Already in Use

If port 3000 is already in use:

1. Change the port in `.env`:

```env
PORT=3001
```

2. Or kill the process using port 3000:

```bash
# Find the process
lsof -i :3000

# Kill it
kill -9 <PID>
```

### Database Locked

If you see "database is locked" errors:

1. Close any open database connections
2. Delete lock files:

```bash
rm data/fund_data.db-shm
rm data/fund_data.db-wal
```

3. Restart the server

### Module Not Found Errors

If you encounter "Cannot find module" errors:

1. Delete node_modules and reinstall:

```bash
rm -rf node_modules package-lock.json
npm install
```

### Scraping Errors

If scraping fails:

1. Check that `USE_MOCK_DATA=true` in `.env` for testing
2. For real scraping, verify Schwab website is accessible
3. Update scraper selectors in `src/scraper.js` if site structure changed

## Production Deployment

### Environment Setup

1. Set production environment:

```env
NODE_ENV=production
USE_MOCK_DATA=false
```

2. Use process manager like PM2:

```bash
npm install -g pm2
pm2 start server.js --name money-fund-pro
pm2 save
pm2 startup
```

### Security Considerations

1. Use HTTPS in production
2. Set secure environment variables
3. Enable rate limiting (already configured)
4. Regular database backups
5. Keep dependencies updated

### Database Backups

```bash
# Backup database
cp data/fund_data.db data/fund_data.db.backup

# Automated backup script
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
cp data/fund_data.db "backups/fund_data_${DATE}.db"
```

## Contributing

1. Follow existing code style
2. Write tests for new features
3. Update documentation
4. Test thoroughly before committing

## Support

For issues, questions, or feedback:

- Check the [DESIGN.md](DESIGN.md) for architecture details
- Review [README.md](README.md) for usage information
- See [AGENTS.md](AGENTS.md) for project requirements

## License

MIT License - See LICENSE file for details

---

**Version**: 1.1.0
**Last Updated**: January 2026
