/**
 * Express Server for Money Market Fund Optimizer
 * Provides API endpoints for fund data, calculations, and historical tracking
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const path = require('path');

const database = require('./src/database');
const scraper = require('./src/scraper');
const taxEngine = require('./src/tax-engine');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'"]
        }
    }
}));
app.use(cors());
app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// Rate limiting
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later.'
});

const refreshLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10, // Limit refresh to 10 times per hour
    message: 'Too many refresh requests, please try again later.'
});

app.use('/api/', apiLimiter);

// Cache for fund data (6 hour TTL)
let fundDataCache = {
    data: null,
    timestamp: null,
    ttl: parseInt(process.env.CACHE_DURATION) || 21600 // 6 hours in seconds
};

/**
 * Check if cache is valid
 */
function isCacheValid() {
    if (!fundDataCache.data || !fundDataCache.timestamp) {
        return false;
    }
    
    const now = Date.now();
    const age = (now - fundDataCache.timestamp) / 1000; // Convert to seconds
    
    return age < fundDataCache.ttl;
}

/**
 * Get fund data (from cache or fresh scrape)
 */
async function getFundData() {
    if (isCacheValid()) {
        console.log('Returning cached fund data');
        return fundDataCache.data;
    }
    
    console.log('Cache expired or empty, fetching fresh data...');
    
    try {
        const funds = await scraper.scrapeFunds();
        
        // Store in database
        for (const fund of funds) {
            await database.insertFundYield(fund);
        }
        
        // Update cache
        fundDataCache.data = funds;
        fundDataCache.timestamp = Date.now();
        
        return funds;
    } catch (error) {
        console.error('Error fetching fund data:', error);
        
        // Fallback to database if scraping fails
        const latestFunds = await database.getLatestYields();
        
        if (latestFunds.length > 0) {
            console.log('Returning latest data from database');
            return latestFunds;
        }
        
        throw error;
    }
}

// ===================================
// API Routes
// ===================================

/**
 * GET /api/funds
 * Returns current fund data with yields and expense ratios
 */
app.get('/api/funds', async (req, res) => {
    try {
        const funds = await getFundData();
        res.json(funds);
    } catch (error) {
        console.error('Error in /api/funds:', error);
        res.status(500).json({ 
            error: 'Failed to fetch fund data',
            message: error.message 
        });
    }
});

/**
 * POST /api/calculate
 * Calculate tax-equivalent yields for funds based on user profile
 */
app.post('/api/calculate', (req, res) => {
    try {
        const { userProfile, funds } = req.body;
        
        if (!userProfile || !funds) {
            return res.status(400).json({ 
                error: 'Missing required parameters: userProfile and funds' 
            });
        }
        
        const results = taxEngine.calculateAllFunds(funds, userProfile);
        
        res.json(results);
    } catch (error) {
        console.error('Error in /api/calculate:', error);
        res.status(500).json({ 
            error: 'Calculation failed',
            message: error.message 
        });
    }
});

/**
 * GET /api/history/:fundName
 * Get historical yield data for a specific fund
 */
app.get('/api/history/:fundName', async (req, res) => {
    try {
        const { fundName } = req.params;
        const { startDate, endDate } = req.query;
        
        const dateRange = {
            startDate: startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
            endDate: endDate ? new Date(endDate) : new Date()
        };
        
        const history = await database.getFundHistory(fundName, dateRange);
        
        res.json(history);
    } catch (error) {
        console.error('Error in /api/history/:fundName:', error);
        res.status(500).json({ 
            error: 'Failed to fetch historical data',
            message: error.message 
        });
    }
});

/**
 * GET /api/history/compare
 * Get historical data for multiple funds
 */
app.get('/api/history/compare', async (req, res) => {
    try {
        let { fundNames, startDate, endDate } = req.query;
        
        // Parse fund names (comma-separated)
        if (typeof fundNames === 'string') {
            fundNames = fundNames.split(',').map(name => decodeURIComponent(name.trim()));
        }
        
        if (!fundNames || fundNames.length === 0) {
            return res.status(400).json({ 
                error: 'Missing required parameter: fundNames' 
            });
        }
        
        const dateRange = {
            startDate: startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
            endDate: endDate ? new Date(endDate) : new Date()
        };
        
        const allHistory = [];
        
        for (const fundName of fundNames) {
            const history = await database.getFundHistory(fundName, dateRange);
            allHistory.push(...history);
        }
        
        res.json(allHistory);
    } catch (error) {
        console.error('Error in /api/history/compare:', error);
        res.status(500).json({ 
            error: 'Failed to fetch comparison data',
            message: error.message 
        });
    }
});

/**
 * POST /api/refresh
 * Trigger fresh scrape of fund data
 */
app.post('/api/refresh', refreshLimiter, async (req, res) => {
    try {
        console.log('Manual refresh triggered');
        
        // Force cache invalidation
        fundDataCache.data = null;
        fundDataCache.timestamp = null;
        
        const funds = await getFundData();
        
        res.json({ 
            success: true, 
            message: 'Data refreshed successfully',
            fundCount: funds.length,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error in /api/refresh:', error);
        res.status(500).json({ 
            error: 'Failed to refresh data',
            message: error.message 
        });
    }
});

/**
 * GET /api/tax-brackets
 * Return current tax bracket data
 */
app.get('/api/tax-brackets', (req, res) => {
    try {
        const brackets = taxEngine.getTaxBrackets();
        const stateTaxRates = taxEngine.getStateTaxRates();
        
        res.json({
            federal: brackets,
            state: stateTaxRates
        });
    } catch (error) {
        console.error('Error in /api/tax-brackets:', error);
        res.status(500).json({ 
            error: 'Failed to fetch tax brackets',
            message: error.message 
        });
    }
});

/**
 * GET /api/health
 * Health check endpoint
 */
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'ok',
        timestamp: new Date().toISOString(),
        cacheValid: isCacheValid(),
        uptime: process.uptime()
    });
});

// ===================================
// Error Handling
// ===================================

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Not found' });
});

// Global error handler
app.use((err, req, res, next) => {
    console.error('Global error handler:', err);
    res.status(500).json({ 
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
    });
});

// ===================================
// Server Initialization
// ===================================

async function startServer() {
    try {
        // Initialize database
        console.log('Initializing database...');
        await database.init();
        
        // Start server
        app.listen(PORT, () => {
            console.log(`\n🚀 Money Fund Pro Server running on http://localhost:${PORT}`);
            console.log(`📊 API available at http://localhost:${PORT}/api`);
            console.log(`💾 Database: ${database.getDatabasePath()}`);
            console.log(`🔄 Cache TTL: ${fundDataCache.ttl} seconds (${fundDataCache.ttl / 3600} hours)`);
            console.log(`\nPress Ctrl+C to stop the server\n`);
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

// Handle graceful shutdown
process.on('SIGTERM', async () => {
    console.log('\nReceived SIGTERM, shutting down gracefully...');
    await database.close();
    process.exit(0);
});

process.on('SIGINT', async () => {
    console.log('\nReceived SIGINT, shutting down gracefully...');
    await database.close();
    process.exit(0);
});

// Start the server
startServer();

module.exports = app;
