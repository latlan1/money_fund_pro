/**
 * Data Utilities Module
 * Shared utilities for parsing CSV data and processing fund information
 * Works in both Node.js and browser environments
 */

/**
 * Parse a CSV line handling quoted fields and escaped quotes
 * @param {string} line - A single row from the CSV
 * @returns {Array<string>} Array of values
 */
function parseCSVLine(line) {
  const result = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      result.push(cleanValue(current));
      current = "";
    } else {
      current += char;
    }
  }

  result.push(cleanValue(current));
  return result;
}

/**
 * Clean whitespace and surrounding quotes from a parsed value
 * @param {string} val - Raw value
 * @returns {string} Cleaned value
 */
function cleanValue(val) {
  let value = val.trim();
  if (value.startsWith('"') && value.endsWith('"')) {
    value = value.slice(1, -1);
  }
  return value;
}

/**
 * Parse CSV text into array of objects
 * @param {string} text - Raw CSV text
 * @returns {Array<Object>} Array of objects mapping headers to values
 */
function parseCSV(text) {
  if (!text || text.trim() === "") return [];

  const lines = text.split(/\r?\n/);
  if (lines.length < 1) return [];

  const headers = parseCSVLine(lines[0]);
  const results = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line === "") continue;

    const values = parseCSVLine(line);
    const row = {};

    headers.forEach((header, index) => {
      const key = header.trim();
      row[key] = values[index] !== undefined ? values[index] : "";
    });

    results.push(row);
  }

  return results;
}

/**
 * Get a field value from a row, checking multiple possible column names
 * @param {Object} row - Data row
 * @param {Array<string>} keys - Possible column names to check
 * @returns {string} Field value or empty string
 */
function getField(row, keys) {
  for (const k of keys) {
    if (row[k] !== undefined) return row[k];
  }
  return "";
}

/**
 * Parse a percentage string to a number
 * @param {string} val - Percentage string (e.g., "4.52%")
 * @returns {number} Numeric value
 */
function parsePercent(val) {
  if (!val) return 0;
  const num = parseFloat(String(val).replace("%", "").trim());
  return isNaN(num) ? 0 : num;
}

/**
 * Categorize a fund based on CSV Category column or fund name
 * @param {Object} row - CSV row data
 * @returns {string} Category key: taxable, treasury, municipal, state-municipal, sweep, or etf
 */
function categorizeFund(row) {
  const csvCategory = (row["Category"] || "").toLowerCase();

  // Check for sweep and ETF categories first (exact matches)
  if (csvCategory.includes("sweep")) return "sweep";
  if (csvCategory.includes("etf") || csvCategory.includes("money market etf"))
    return "etf";

  if (csvCategory.includes("treasury")) return "treasury";
  if (csvCategory.includes("tax-exempt")) return "municipal";
  if (
    csvCategory.includes("state-specific") ||
    csvCategory.includes("state municipal")
  )
    return "state-municipal";
  if (csvCategory.includes("taxable")) return "taxable";

  // Fallback to fund name analysis
  const name = (row["Fund Name"] || row["FundName"] || "").toLowerCase();
  if (name.includes("etf")) return "etf";
  if (name.includes("sweep")) return "sweep";
  if (name.includes("treasury")) return "treasury";
  if (name.includes("tax-exempt") || name.includes("municipal")) {
    if (name.includes("california") || name.includes("new york")) {
      return "state-municipal";
    }
    return "municipal";
  }

  return "taxable";
}

/**
 * Determine fund category for tax treatment display based on fund name
 * Maps CSV categories + fund names to user-friendly tax treatment descriptions
 * @param {string} fundName - The fund name
 * @param {string} csvCategory - Original CSV category
 * @returns {string} Tax treatment description
 */
function getFundCategory(fundName, csvCategory) {
  const name = (fundName || "").toLowerCase();
  const category = (csvCategory || "").toLowerCase();

  // State-specific municipal funds (CA, NY) - both federal and state tax-free for residents
  if (name.includes("california") || name.includes("new york")) {
    return "State Municipal - Both tax-free (residents only)";
  }

  // Tax-Exempt/Municipal funds - federal tax-free
  if (category.includes("tax-exempt") || name.includes("municipal")) {
    return "Municipal - Federal tax-free";
  }

  // Treasury funds - U.S. Treasury or Treasury Obligations
  // These invest exclusively in US Treasuries and are state tax-free
  if (name.includes("u.s. treasury") || name.includes("treasury obligations")) {
    return "Treasury - State tax-free";
  }

  // Government funds (including sweep and ETF that are government-based)
  // These invest in repos, agency debt, etc. - fully taxable
  if (name.includes("government")) {
    return "Taxable - Subject to all taxes";
  }

  // Prime funds - fully taxable
  if (name.includes("prime")) {
    return "Taxable - Subject to all taxes";
  }

  // Default - taxable
  return "Taxable - Subject to all taxes";
}

/**
 * Transform a single CSV row into a fund object
 * @param {Object} row - CSV row data
 * @returns {Object} Fund object
 */
function transformRowToFund(row) {
  const fundName = getField(row, ["Fund Name", "FundName"]);
  const csvCategory = row["Category"] || "";
  return {
    fundName: fundName,
    symbol: getField(row, ["Ticker", "Symbol"]),
    category: categorizeFund(row),
    csvCategory: csvCategory,
    fundCategory: getFundCategory(fundName, csvCategory),
    grossYield: parsePercent(
      getField(row, ["7-Day Yield (with waivers)", "7DayYieldWithWaivers"]),
    ),
    expenseRatio: parsePercent(
      getField(row, ["Net Expense Ratio", "NetExpenseRatio", "Expense Ratio"]),
    ),
    minimumInvestment: getField(row, [
      "Minimum Initial Investment",
      "MinimumInitialInvestment",
    ]),
    eligibleInvestors: getField(row, [
      "Eligible Investors",
      "EligibleInvestors",
    ]),
    netYield: null,
    taxEquivalentYield: null,
    annualReturn: null,
  };
}

/**
 * Transform ALL CSV rows into fund objects for table display
 * @param {Array<Object>} rows - Parsed CSV rows
 * @returns {Array<Object>} Transformed fund objects (all tickers)
 */
function getAllFunds(rows) {
  return rows.map(transformRowToFund);
}

/**
 * Filter and transform CSV rows into fund objects for table display
 * @param {Array<Object>} rows - Parsed CSV rows
 * @returns {Array<Object>} Filtered and transformed fund objects
 */
function filterRetailFunds(rows) {
  return rows
    .filter((row) => {
      const min = getField(row, [
        "Minimum Initial Investment",
        "MinimumInitialInvestment",
      ]).toLowerCase();
      const eligible = getField(row, [
        "Eligible Investors",
        "EligibleInvestors",
      ]).toLowerCase();
      return (
        (min.includes("no minimum") || min === "$0") &&
        eligible.includes("retail")
      );
    })
    .map(transformRowToFund);
}

/**
 * Parse date string from MM-DD-YYYY format
 * @param {string} dateStr - Date string in MM-DD-YYYY format
 * @returns {Date} Parsed date object (in local timezone)
 */
function parseDateMMDDYYYY(dateStr) {
  const [m, day, y] = dateStr.split("-");
  // Use Date constructor with numeric args to avoid timezone issues
  return new Date(parseInt(y), parseInt(m) - 1, parseInt(day));
}

/**
 * Sort CSV file list by date (newest first)
 * @param {Array<Object>} csvList - Array of {name, date} objects
 * @returns {Array<Object>} Sorted array (newest first)
 */
function sortCsvFilesByDate(csvList) {
  return [...csvList].sort(
    (a, b) => parseDateMMDDYYYY(b.date) - parseDateMMDDYYYY(a.date),
  );
}

/**
 * Transform CSV rows into chart data points
 * @param {Array<Object>} rows - Parsed CSV rows
 * @param {string} dateStr - Date string for this snapshot
 * @returns {Array<Object>} Chart data points
 */
function transformRowsForChart(rows, dateStr) {
  return rows.map((row) => {
    const yieldStr =
      row["7-Day Yield (with waivers)"] || row["7DayYieldWithWaivers"] || "0";
    const fundName = row["Fund Name"] || row["FundName"] || "";
    const csvCategory = row["Category"] || "";
    return {
      category: getFundCategory(fundName, csvCategory),
      fundName: fundName,
      date: dateStr,
      netYield: parseFloat(yieldStr.replace("%", "")),
    };
  });
}

/**
 * Aggregate chart data by category and date
 * @param {Array<Object>} dataPoints - Array of chart data points
 * @returns {Object} Aggregated data with dates and category averages
 */
function aggregateChartData(dataPoints) {
  if (!dataPoints.length) return { dates: [], categoryAverages: {} };

  // Get unique dates sorted chronologically
  const dates = [...new Set(dataPoints.map((d) => d.date))].sort((a, b) => {
    return parseDateMMDDYYYY(a) - parseDateMMDDYYYY(b);
  });

  // Get unique categories
  const categories = [...new Set(dataPoints.map((d) => d.category))];

  // Calculate averages per category per date
  const categoryAverages = {};
  categories.forEach((category) => {
    categoryAverages[category] = dates.map((date) => {
      const entries = dataPoints.filter(
        (d) => d.category === category && d.date === date,
      );
      if (entries.length === 0) return null;
      const sum = entries.reduce((acc, curr) => acc + curr.netYield, 0);
      return sum / entries.length;
    });
  });

  return { dates, categoryAverages };
}

// Export for Node.js
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    parseCSV,
    parseCSVLine,
    cleanValue,
    getField,
    parsePercent,
    categorizeFund,
    getFundCategory,
    transformRowToFund,
    getAllFunds,
    filterRetailFunds,
    parseDateMMDDYYYY,
    sortCsvFilesByDate,
    transformRowsForChart,
    aggregateChartData,
  };
}

// Export for browser
if (typeof window !== "undefined") {
  window.DataUtils = {
    parseCSV,
    parseCSVLine,
    cleanValue,
    getField,
    parsePercent,
    categorizeFund,
    getFundCategory,
    transformRowToFund,
    getAllFunds,
    filterRetailFunds,
    parseDateMMDDYYYY,
    sortCsvFilesByDate,
    transformRowsForChart,
    aggregateChartData,
  };
}
