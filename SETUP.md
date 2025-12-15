# Money Market Fund Tax-Equivalent Yield Optimizer - Setup Guide

## Quick Start

### 1. Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** 16.x or higher ([Download](https://nodejs.org/))
- **npm** 8.x or higher (comes with Node.js)
- **SQLite3** (usually pre-installed on macOS/Linux)

Verify installations:
```bash
node --version
npm --version
sqlite3 --version
```

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
- better-sqlite3 (database)
- Puppeteer (web scraping)
- Chart.js (visualization)
- And other dependencies

3. **Configure environment variables:**

The `.env` file has already been created from `.env.example`. You can modify it if needed:

```bash
# Optional: Edit .env to customize settings
code .env  # or use your preferred editor
```

Default configuration:
- Port: 3000
- Database: ./data/fund_data.db
- Cache Duration: 6 hours
- Mock Data: Enabled (for testing)

### 3. Run the Application

**Start the development server:**
```bash
npm run dev
```

Or for production:
```bash
npm start
```

You should see:
```
🚀 Money Fund Pro Server running on http://localhost:3000
📊 API available at http://localhost:3000/api
💾 Database: /path/to/data/fund_data.db
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
├── public/              # Frontend files
│   ├── index.html      # Main HTML page
│   ├── css/
│   │   └── styles.css  # Application styles
│   └── js/
│       ├── app.js              # Main app logic
│       ├── tax-calculator.js   # Tax calculations
│       └── chart-handler.js    # Chart.js wrapper
├── src/                 # Backend modules
│   ├── database.js     # SQLite operations
│   ├── tax-engine.js   # Server-side tax calculations
│   └── scraper.js      # Web scraping logic
├── data/               # Database storage (auto-created)
│   └── fund_data.db    # SQLite database
├── server.js           # Express server
├── package.json        # Dependencies
├── .env               # Environment configuration
└── README.md          # Documentation
```

## Configuration

### Environment Variables (.env)

```env
# Server
PORT=3000
NODE_ENV=development

# Database
DATABASE_PATH=./data/fund_data.db

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
- Compare multiple money market funds
- View tax-equivalent yields based on your profile
- See gross yield, expense ratios, and net yields
- Sortable columns for easy comparison

### 3. Top Recommendation
- Automatically highlights the best fund for your situation
- Detailed explanation of why it's optimal
- Shows estimated annual returns

### 4. Historical Tracking
- View yield trends over time
- Compare multiple funds
- Select date ranges (7 days to 1 year)
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
    "netYield": 4.50,
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

# Initialize database
npm run db:init

# Seed database with sample data
npm run db:seed
```

### Database Management

**View database contents:**
```bash
sqlite3 data/fund_data.db
```

**Common SQLite commands:**
```sql
-- View all tables
.tables

-- View fund_yields structure
.schema fund_yields

-- Query recent yields
SELECT * FROM fund_yields ORDER BY timestamp DESC LIMIT 10;

-- View database stats
SELECT COUNT(*) FROM fund_yields;
```

**Clean up old data:**
The application automatically maintains historical data. To manually clean up:
```javascript
// In Node.js REPL or script
const database = require('./src/database');
database.init();
database.cleanupOldData(365); // Keep last 365 days
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

**Version**: 1.0.0  
**Last Updated**: December 2024
