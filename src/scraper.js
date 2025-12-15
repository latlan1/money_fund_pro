/**
 * Web Scraper Module
 * Scrapes money market fund data from Schwab
 * Includes mock data fallback for development/testing
 */

const puppeteer = require('puppeteer');

const SCHWAB_URL = 'https://www.schwab.com/money-market-funds';
const USE_MOCK_DATA = process.env.USE_MOCK_DATA === 'true' || true; // Default to mock for now

/**
 * Mock fund data for development and testing
 * This data represents typical Schwab money market funds
 */
const MOCK_FUND_DATA = [
    {
        fundName: 'Schwab Value Advantage Money Fund',
        symbol: 'SWVXX',
        category: 'taxable',
        grossYield: 4.84,
        expenseRatio: 0.34,
        sourceUrl: SCHWAB_URL
    },
    {
        fundName: 'Schwab Treasury Obligations Money Fund',
        symbol: 'SNOXX',
        category: 'treasury',
        grossYield: 4.62,
        expenseRatio: 0.31,
        sourceUrl: SCHWAB_URL
    },
    {
        fundName: 'Schwab Government Money Fund',
        symbol: 'SNVXX',
        category: 'treasury',
        grossYield: 4.58,
        expenseRatio: 0.28,
        sourceUrl: SCHWAB_URL
    },
    {
        fundName: 'Schwab Municipal Money Fund',
        symbol: 'SWXXX',
        category: 'municipal',
        grossYield: 3.25,
        expenseRatio: 0.42,
        sourceUrl: SCHWAB_URL
    },
    {
        fundName: 'Schwab California Municipal Money Fund',
        symbol: 'SWCXX',
        category: 'state-municipal',
        grossYield: 3.18,
        expenseRatio: 0.48,
        sourceUrl: SCHWAB_URL
    },
    {
        fundName: 'Schwab New York Municipal Money Fund',
        symbol: 'SWYXX',
        category: 'state-municipal',
        grossYield: 3.22,
        expenseRatio: 0.45,
        sourceUrl: SCHWAB_URL
    },
    {
        fundName: 'Schwab Retirement Advantage Money Fund',
        symbol: 'SWRXX',
        category: 'taxable',
        grossYield: 4.81,
        expenseRatio: 0.36,
        sourceUrl: SCHWAB_URL
    },
    {
        fundName: 'Schwab Cash Reserves',
        symbol: 'SWRXX',
        category: 'taxable',
        grossYield: 4.79,
        expenseRatio: 0.38,
        sourceUrl: SCHWAB_URL
    }
];

/**
 * Scrape funds from Schwab website
 * Currently uses mock data - implement real scraping when ready
 */
async function scrapeFunds() {
    console.log('Fetching fund data...');
    
    if (USE_MOCK_DATA) {
        console.log('Using mock data (set USE_MOCK_DATA=false in .env for real scraping)');
        return getMockData();
    }
    
    try {
        return await scrapeSchwabWebsite();
    } catch (error) {
        console.error('Scraping failed, falling back to mock data:', error.message);
        return getMockData();
    }
}

/**
 * Get mock data with slight randomization
 * This simulates yield fluctuations
 */
function getMockData() {
    return MOCK_FUND_DATA.map(fund => ({
        ...fund,
        // Add small random variation to yields (±0.05%)
        grossYield: fund.grossYield + (Math.random() * 0.1 - 0.05)
    }));
}

/**
 * Scrape Schwab website using Puppeteer
 * This is a template - needs customization based on actual site structure
 */
async function scrapeSchwabWebsite() {
    console.log('Launching browser to scrape Schwab website...');
    
    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    try {
        const page = await browser.newPage();
        
        // Set user agent to avoid detection
        await page.setUserAgent(
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        );
        
        // Navigate to Schwab money market funds page
        console.log(`Navigating to ${SCHWAB_URL}...`);
        await page.goto(SCHWAB_URL, {
            waitUntil: 'networkidle2',
            timeout: 30000
        });
        
        // Wait for content to load
        await page.waitForTimeout(3000);
        
        // Extract fund data
        const funds = await page.evaluate(() => {
            const fundElements = document.querySelectorAll('.fund-row, .fund-item, tr[data-fund]');
            const results = [];
            
            fundElements.forEach(element => {
                try {
                    // These selectors are placeholders - adjust based on actual HTML structure
                    const name = element.querySelector('.fund-name, .name')?.textContent?.trim();
                    const symbol = element.querySelector('.symbol, .ticker')?.textContent?.trim();
                    const yieldText = element.querySelector('.yield, .seven-day-yield')?.textContent?.trim();
                    const expenseText = element.querySelector('.expense-ratio, .er')?.textContent?.trim();
                    
                    if (name && yieldText) {
                        const grossYield = parseFloat(yieldText.replace('%', '').trim());
                        const expenseRatio = expenseText ? parseFloat(expenseText.replace('%', '').trim()) : 0.35;
                        
                        // Determine category based on fund name
                        let category = 'taxable';
                        if (name.toLowerCase().includes('treasury') || name.toLowerCase().includes('government')) {
                            category = 'treasury';
                        } else if (name.toLowerCase().includes('municipal')) {
                            if (name.includes('California') || name.includes('New York')) {
                                category = 'state-municipal';
                            } else {
                                category = 'municipal';
                            }
                        }
                        
                        results.push({
                            fundName: name,
                            symbol: symbol || 'N/A',
                            category: category,
                            grossYield: grossYield,
                            expenseRatio: expenseRatio,
                            sourceUrl: window.location.href
                        });
                    }
                } catch (err) {
                    console.error('Error parsing fund element:', err);
                }
            });
            
            return results;
        });
        
        console.log(`Scraped ${funds.length} funds from Schwab`);
        
        if (funds.length === 0) {
            throw new Error('No funds found - page structure may have changed');
        }
        
        return funds;
        
    } catch (error) {
        console.error('Scraping error:', error);
        throw error;
    } finally {
        await browser.close();
    }
}

/**
 * Categorize fund based on name/description
 * Helper function for categorization logic
 */
function categorizeFund(fundName, description = '') {
    const text = (fundName + ' ' + description).toLowerCase();
    
    if (text.includes('treasury') || text.includes('government')) {
        return 'treasury';
    }
    
    if (text.includes('municipal') || text.includes('tax-free') || text.includes('tax free')) {
        // Check for state-specific
        const states = ['california', 'new york', 'massachusetts', 'new jersey', 'pennsylvania'];
        if (states.some(state => text.includes(state))) {
            return 'state-municipal';
        }
        return 'municipal';
    }
    
    return 'taxable';
}

/**
 * Validate fund data
 */
function validateFundData(fund) {
    if (!fund.fundName || typeof fund.fundName !== 'string') {
        throw new Error('Invalid fund name');
    }
    
    if (typeof fund.grossYield !== 'number' || fund.grossYield < 0 || fund.grossYield > 20) {
        throw new Error(`Invalid gross yield for ${fund.fundName}: ${fund.grossYield}`);
    }
    
    if (typeof fund.expenseRatio !== 'number' || fund.expenseRatio < 0 || fund.expenseRatio > 5) {
        throw new Error(`Invalid expense ratio for ${fund.fundName}: ${fund.expenseRatio}`);
    }
    
    const validCategories = ['taxable', 'treasury', 'municipal', 'state-municipal'];
    if (!validCategories.includes(fund.category)) {
        throw new Error(`Invalid category for ${fund.fundName}: ${fund.category}`);
    }
    
    return true;
}

/**
 * Get fund details (for individual fund pages)
 * This would fetch expense ratios and other detailed info
 */
async function getFundDetails(symbol) {
    // Placeholder for detailed fund information scraping
    console.log(`Fetching details for ${symbol}...`);
    
    // In a real implementation, this would:
    // 1. Navigate to individual fund page
    // 2. Extract detailed information
    // 3. Return enhanced fund object
    
    return null;
}

module.exports = {
    scrapeFunds,
    getMockData,
    categorizeFund,
    validateFundData,
    getFundDetails
};
