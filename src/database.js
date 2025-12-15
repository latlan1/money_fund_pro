/**
 * Database Module
 * Handles SQLite operations for fund data storage and retrieval
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = process.env.DATABASE_PATH || path.join(__dirname, '../data/fund_data.db');
let db = null;

/**
 * Initialize database and create tables
 */
function init() {
    try {
        // Ensure data directory exists
        const dataDir = path.dirname(DB_PATH);
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }

        // Open database connection
        db = new Database(DB_PATH);
        db.pragma('journal_mode = WAL');
        
        console.log(`Database connected: ${DB_PATH}`);
        
        // Create tables
        createTables();
        
        // Create indexes
        createIndexes();
        
        return db;
    } catch (error) {
        console.error('Database initialization error:', error);
        throw error;
    }
}

/**
 * Create database tables
 */
function createTables() {
    // Fund yields table
    db.exec(`
        CREATE TABLE IF NOT EXISTS fund_yields (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            fund_name TEXT NOT NULL,
            fund_symbol TEXT,
            category TEXT NOT NULL,
            gross_yield REAL NOT NULL,
            expense_ratio REAL NOT NULL,
            net_yield REAL NOT NULL,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            source_url TEXT
        )
    `);

    // Fund metadata table
    db.exec(`
        CREATE TABLE IF NOT EXISTS fund_metadata (
            fund_symbol TEXT PRIMARY KEY,
            fund_name TEXT NOT NULL,
            category TEXT NOT NULL,
            minimum_investment REAL DEFAULT 0,
            last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    console.log('Database tables created/verified');
}

/**
 * Create database indexes
 */
function createIndexes() {
    db.exec(`
        CREATE INDEX IF NOT EXISTS idx_fund_name ON fund_yields(fund_name);
        CREATE INDEX IF NOT EXISTS idx_timestamp ON fund_yields(timestamp);
        CREATE INDEX IF NOT EXISTS idx_category ON fund_yields(category);
    `);
    
    console.log('Database indexes created/verified');
}

/**
 * Insert fund yield data
 * @param {Object} fundData - Fund data object
 */
function insertFundYield(fundData) {
    const stmt = db.prepare(`
        INSERT INTO fund_yields (
            fund_name, fund_symbol, category, gross_yield, 
            expense_ratio, net_yield, source_url, timestamp
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const netYield = fundData.grossYield - fundData.expenseRatio;
    const timestamp = fundData.timestamp || new Date().toISOString();

    const info = stmt.run(
        fundData.fundName,
        fundData.symbol || null,
        fundData.category,
        fundData.grossYield,
        fundData.expenseRatio,
        netYield,
        fundData.sourceUrl || null,
        timestamp
    );

    return info;
}

/**
 * Insert fund yield data only if it doesn't exist for that date
 * Prevents duplicate entries for the same fund on the same day
 * @param {Object} fundData - Fund data object
 * @returns {boolean} True if inserted, false if skipped (duplicate)
 */
function insertFundYieldIfNotExists(fundData) {
    const timestamp = fundData.timestamp || new Date().toISOString();
    const date = new Date(timestamp);
    const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
    
    // Check if entry already exists for this fund and date
    const checkStmt = db.prepare(`
        SELECT id FROM fund_yields
        WHERE fund_name = ?
        AND DATE(timestamp) = ?
    `);
    
    const existing = checkStmt.get(fundData.fundName, dateStr);
    
    if (existing) {
        return false; // Skip, already exists
    }
    
    // Insert the new record
    insertFundYield(fundData);
    return true; // Inserted
}

/**
 * Get fund history within date range
 * @param {string} fundName - Fund name
 * @param {Object} dateRange - Start and end dates
 * @returns {Array} Historical data
 */
function getFundHistory(fundName, dateRange) {
    const stmt = db.prepare(`
        SELECT 
            fund_name as fundName,
            category,
            gross_yield as grossYield,
            expense_ratio as expenseRatio,
            net_yield as netYield,
            DATE(timestamp) as date,
            timestamp
        FROM fund_yields
        WHERE fund_name = ?
        AND timestamp BETWEEN ? AND ?
        ORDER BY timestamp ASC
    `);

    const results = stmt.all(
        fundName,
        dateRange.startDate.toISOString(),
        dateRange.endDate.toISOString()
    );

    return results;
}

/**
 * Get all current funds (latest entry for each fund)
 * @returns {Array} Latest fund data
 */
function getAllCurrentFunds() {
    const stmt = db.prepare(`
        SELECT 
            fund_name as fundName,
            fund_symbol as symbol,
            category,
            gross_yield as grossYield,
            expense_ratio as expenseRatio,
            net_yield as netYield,
            MAX(timestamp) as lastUpdated
        FROM fund_yields
        GROUP BY fund_name
        ORDER BY fund_name
    `);

    const results = stmt.all();
    return results;
}

/**
 * Get latest yields for all funds
 * @returns {Array} Latest fund yields
 */
function getLatestYields() {
    const stmt = db.prepare(`
        SELECT 
            fy.fund_name as fundName,
            fy.fund_symbol as symbol,
            fy.category,
            fy.gross_yield as grossYield,
            fy.expense_ratio as expenseRatio,
            fy.net_yield as netYield,
            fy.timestamp as lastUpdated
        FROM fund_yields fy
        INNER JOIN (
            SELECT fund_name, MAX(timestamp) as max_timestamp
            FROM fund_yields
            GROUP BY fund_name
        ) latest ON fy.fund_name = latest.fund_name 
        AND fy.timestamp = latest.max_timestamp
        ORDER BY fy.fund_name
    `);

    const results = stmt.all();
    return results;
}

/**
 * Clean up old data (older than specified days)
 * @param {number} days - Number of days to keep
 */
function cleanupOldData(days = 365) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const stmt = db.prepare(`
        DELETE FROM fund_yields
        WHERE timestamp < ?
    `);

    const info = stmt.run(cutoffDate.toISOString());
    
    console.log(`Cleaned up ${info.changes} old records`);
    
    // Vacuum to reclaim space
    db.exec('VACUUM');
    
    return info.changes;
}

/**
 * Get database statistics
 * @returns {Object} Statistics
 */
function getStats() {
    const totalRecords = db.prepare('SELECT COUNT(*) as count FROM fund_yields').get();
    const uniqueFunds = db.prepare('SELECT COUNT(DISTINCT fund_name) as count FROM fund_yields').get();
    const oldestRecord = db.prepare('SELECT MIN(timestamp) as oldest FROM fund_yields').get();
    const newestRecord = db.prepare('SELECT MAX(timestamp) as newest FROM fund_yields').get();

    return {
        totalRecords: totalRecords.count,
        uniqueFunds: uniqueFunds.count,
        oldestRecord: oldestRecord.oldest,
        newestRecord: newestRecord.newest
    };
}

/**
 * Close database connection
 */
function close() {
    if (db) {
        db.close();
        console.log('Database connection closed');
    }
}

/**
 * Get database path
 */
function getDatabasePath() {
    return DB_PATH;
}

/**
 * Get database instance (for testing/debugging)
 */
function getDatabase() {
    return db;
}

module.exports = {
    init,
    insertFundYield,
    insertFundYieldIfNotExists,
    getFundHistory,
    getAllCurrentFunds,
    getLatestYields,
    cleanupOldData,
    getStats,
    close,
    getDatabasePath,
    getDatabase
};
