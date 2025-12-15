/**
 * Seed Historical Data Script
 * Prepopulates the database with 30 days of historical yield data
 * Run once to create historical trend data for charts
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const database = require('../src/database');
const scraper = require('../src/scraper');

/**
 * Generate historical yields for a fund over the past 30 days
 * Simulates realistic yield fluctuations
 */
function generateHistoricalYields(fund, days = 30) {
    const historicalData = [];
    const now = new Date();
    
    // Starting yield (slightly lower than current to show upward trend)
    let baseYield = fund.grossYield - 0.15;
    
    for (let i = days - 1; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        date.setHours(12, 0, 0, 0); // Normalize to noon
        
        // Add realistic daily variation (±0.02%)
        const dailyVariation = (Math.random() - 0.5) * 0.04;
        
        // Add slight upward trend over time
        const trendComponent = (days - i) * 0.005;
        
        const dailyYield = Math.max(0.1, baseYield + dailyVariation + trendComponent);
        
        historicalData.push({
            fundName: fund.fundName,
            symbol: fund.symbol,
            category: fund.category,
            grossYield: dailyYield,
            expenseRatio: fund.expenseRatio,
            timestamp: date.toISOString(),
            sourceUrl: fund.sourceUrl
        });
    }
    
    return historicalData;
}

/**
 * Seed the database with historical data
 */
async function seedHistoricalData() {
    try {
        console.log('🌱 Starting historical data seeding...\n');
        
        // Initialize database
        await database.init();
        
        // Get current fund data
        console.log('📊 Fetching current fund data...');
        const currentFunds = await scraper.scrapeFunds();
        console.log(`Found ${currentFunds.length} funds\n`);
        
        let totalInserted = 0;
        let totalSkipped = 0;
        
        // For each fund, generate and insert 30 days of history
        for (const fund of currentFunds) {
            console.log(`Processing ${fund.fundName} (${fund.symbol})...`);
            
            const historicalYields = generateHistoricalYields(fund, 30);
            
            for (const dataPoint of historicalYields) {
                const inserted = await database.insertFundYieldIfNotExists(dataPoint);
                if (inserted) {
                    totalInserted++;
                } else {
                    totalSkipped++;
                }
            }
            
            console.log(`  ✓ Generated 30 days of data`);
        }
        
        console.log(`\n✅ Seeding complete!`);
        console.log(`   Inserted: ${totalInserted} records`);
        console.log(`   Skipped (duplicates): ${totalSkipped} records`);
        
        // Show database stats
        const stats = database.getStats();
        console.log(`\n📈 Database Statistics:`);
        console.log(`   Total records: ${stats.totalRecords}`);
        console.log(`   Unique funds: ${stats.uniqueFunds}`);
        console.log(`   Date range: ${new Date(stats.oldestRecord).toLocaleDateString()} to ${new Date(stats.newestRecord).toLocaleDateString()}`);
        
        await database.close();
        
    } catch (error) {
        console.error('❌ Error seeding historical data:', error);
        process.exit(1);
    }
}

// Run the script
if (require.main === module) {
    seedHistoricalData().then(() => {
        console.log('\n🎉 Historical data seeding completed successfully!');
        process.exit(0);
    }).catch(error => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
}

module.exports = { seedHistoricalData, generateHistoricalYields };
