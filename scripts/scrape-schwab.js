#!/usr/bin/env node
/**
 * Scrape Schwab Money Market Funds data and save to CSV
 *
 * Usage: node scripts/scrape-schwab.js
 *
 * This script fetches the current fund data from Schwab's website
 * and saves it to a CSV file in the public/ directory.
 */

const https = require("https");
const fs = require("fs");
const path = require("path");

const SCHWAB_URL = "https://www.schwab.com/money-market-funds";

// Expense ratios don't change frequently, so we maintain them here
const EXPENSE_RATIOS = {
  SWVXX: { gross: "0.35%", net: "0.34%" },
  SNAXX: { gross: "0.20%", net: "0.19%" },
  SNVXX: { gross: "0.35%", net: "0.34%" },
  SGUXX: { gross: "0.20%", net: "0.19%" },
  SNOXX: { gross: "0.35%", net: "0.34%" },
  SCOXX: { gross: "0.20%", net: "0.19%" },
  SNSXX: { gross: "0.35%", net: "0.34%" },
  SUTXX: { gross: "0.20%", net: "0.19%" },
  SWTXX: { gross: "0.35%", net: "0.34%" },
  SWOXX: { gross: "0.20%", net: "0.19%" },
  SWWXX: { gross: "0.36%", net: "0.34%" },
  SCTXX: { gross: "0.21%", net: "0.19%" },
  SWKXX: { gross: "0.35%", net: "0.34%" },
  SCAXX: { gross: "0.20%", net: "0.19%" },
  SWYXX: { gross: "0.36%", net: "0.34%" },
  SNYXX: { gross: "0.21%", net: "0.19%" },
  SWGXX: { gross: "0.45%", net: "0.44%" },
  SGVT: { gross: "--", net: "0.28%" },
};

// Fund metadata for categories and names
const FUND_METADATA = {
  SWVXX: {
    category: "Taxable Money Funds",
    name: "Schwab Prime Advantage Money Fund - Investor Shares",
    eligible: "Retail",
  },
  SNAXX: {
    category: "Taxable Money Funds",
    name: "Schwab Prime Advantage Money Fund - Ultra Shares",
    eligible: "Retail",
  },
  SNVXX: {
    category: "Taxable Money Funds",
    name: "Schwab Government Money Fund - Investor Shares",
    eligible: "Retail/Institutional",
  },
  SGUXX: {
    category: "Taxable Money Funds",
    name: "Schwab Government Money Fund - Ultra Shares",
    eligible: "Retail/Institutional",
  },
  SNOXX: {
    category: "Taxable Money Funds",
    name: "Schwab Treasury Obligations Money Fund - Investor Shares",
    eligible: "Retail/Institutional",
  },
  SCOXX: {
    category: "Taxable Money Funds",
    name: "Schwab Treasury Obligations Money Fund - Ultra Shares",
    eligible: "Retail/Institutional",
  },
  SNSXX: {
    category: "Taxable Money Funds",
    name: "Schwab U.S. Treasury Money Fund - Investor Shares",
    eligible: "Retail/Institutional",
  },
  SUTXX: {
    category: "Taxable Money Funds",
    name: "Schwab U.S. Treasury Money Fund - Ultra Shares",
    eligible: "Retail/Institutional",
  },
  SWTXX: {
    category: "Tax-Exempt Money Funds",
    name: "Schwab Municipal Money Fund - Investor Shares",
    eligible: "Retail",
  },
  SWOXX: {
    category: "Tax-Exempt Money Funds",
    name: "Schwab Municipal Money Fund - Ultra Shares",
    eligible: "Retail",
  },
  SWWXX: {
    category: "Tax-Exempt Money Funds",
    name: "Schwab AMT Tax-Free Money Fund - Investor Shares",
    eligible: "Retail",
  },
  SCTXX: {
    category: "Tax-Exempt Money Funds",
    name: "Schwab AMT Tax-Free Money Fund - Ultra Shares",
    eligible: "Retail",
  },
  SWKXX: {
    category: "Tax-Exempt Money Funds",
    name: "Schwab California Municipal Money Fund - Investor Shares",
    eligible: "Retail",
  },
  SCAXX: {
    category: "Tax-Exempt Money Funds",
    name: "Schwab California Municipal Money Fund - Ultra Shares",
    eligible: "Retail",
  },
  SWYXX: {
    category: "Tax-Exempt Money Funds",
    name: "Schwab New York Municipal Money Fund - Investor Shares",
    eligible: "Retail",
  },
  SNYXX: {
    category: "Tax-Exempt Money Funds",
    name: "Schwab New York Municipal Money Fund - Ultra Shares",
    eligible: "Retail",
  },
  SWGXX: {
    category: "Sweep Money Fund",
    name: "Schwab Government Money Fund - Sweep Shares",
    eligible: "--",
  },
  SGVT: {
    category: "Money Market ETF",
    name: "Schwab Government Money Market ETF",
    eligible: "Retail/Institutional",
  },
};

// Minimum investments
const MINIMUMS = {
  SWVXX: "No Minimum",
  SNAXX: "$1,000,000",
  SNVXX: "No Minimum",
  SGUXX: "$1,000,000",
  SNOXX: "No Minimum",
  SCOXX: "$1,000,000",
  SNSXX: "No Minimum",
  SUTXX: "$1,000,000",
  SWTXX: "No Minimum",
  SWOXX: "$1,000,000",
  SWWXX: "No Minimum",
  SCTXX: "$1,000,000",
  SWKXX: "No Minimum",
  SCAXX: "$1,000,000",
  SWYXX: "No Minimum",
  SNYXX: "$1,000,000",
  SWGXX: "No Minimum",
  SGVT: "No Minimum",
};

/**
 * Fetch HTML content from URL
 */
function fetchPage(url) {
  return new Promise((resolve, reject) => {
    console.log(`Fetching ${url}...`);

    const options = {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        Accept: "text/html,application/xhtml+xml",
      },
    };

    https
      .get(url, options, (res) => {
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
          return;
        }

        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => resolve(data));
        res.on("error", reject);
      })
      .on("error", reject);
  });
}

/**
 * Extract fund yields from HTML
 *
 * The HTML has several different formats for fund entries:
 * 1. Standard: <td>Fund Name (<a href="...products/TICKER">TICKER</a>)</td><td>X.XX%</td>
 * 2. With div wrapper: <td><div>Fund Name (<a href="...">TICKER</a>)</div></td><td>X.XX%</td>
 * 3. ETF with sup: <td>Fund Name (<a href="...">SGVT</a>)<sup>8</sup></td><td>X.XX%</td>
 */
function extractYields(html) {
  const yields = {};

  // Approach: Find each known ticker and then look for the yield in the next <td>
  // This is more reliable than trying to match complex patterns
  for (const ticker of Object.keys(FUND_METADATA)) {
    if (ticker === "SWGXX") {
      // SWGXX (Sweep) is no longer on the public page
      // Schwab eliminated sweep money funds as a cash feature
      continue;
    }

    // Create patterns to find the ticker followed by yield
    const patterns = [
      // Pattern 1: ticker in link href (products/TICKER or schwabfunds.com/products/TICKER)
      new RegExp(
        `products\\/${ticker}[^>]*>[^<]*<\\/a>\\)?(?:<sup>[^<]*<\\/sup>)?\\s*<\\/(?:td|div)>\\s*(?:<\\/td>\\s*)?<td[^>]*>\\s*(\\d+\\.\\d+)%`,
        "i",
      ),
      // Pattern 2: ticker in title attribute
      new RegExp(
        `title="${ticker}"[^>]*>[^<]*<\\/a>\\)?(?:<sup>[^<]*<\\/sup>)?\\s*<\\/(?:td|div)>\\s*(?:<\\/td>\\s*)?<td[^>]*>\\s*(\\d+\\.\\d+)%`,
        "i",
      ),
      // Pattern 3: More flexible - ticker followed by </a>) and then a yield within ~200 chars
      new RegExp(
        `>${ticker}<\\/a>\\)?(?:<sup>[^<]*<\\/sup>)?[\\s\\S]{0,200}?<td[^>]*>\\s*(\\d+\\.\\d+)%`,
        "i",
      ),
    ];

    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match) {
        yields[ticker] = match[1] + "%";
        break;
      }
    }
  }

  return yields;
}

/**
 * Build CSV content from yields
 */
function buildCSV(yields) {
  const headers = [
    "Category",
    "Fund Name",
    "Ticker",
    "7-Day Yield (with waivers)",
    "7-Day Yield (without waivers)",
    "Minimum Initial Investment",
    "Gross Expense Ratio",
    "Net Expense Ratio",
    "Total Net Assets",
    "NAV",
    "Eligible Investors",
    "Notes",
  ];

  const rows = [headers.join(",")];

  // Order funds by category
  const orderedTickers = [
    // Taxable - Prime
    "SWVXX",
    "SNAXX",
    // Taxable - Government
    "SNVXX",
    "SGUXX",
    // Taxable - Treasury Obligations
    "SNOXX",
    "SCOXX",
    // Taxable - U.S. Treasury
    "SNSXX",
    "SUTXX",
    // Tax-Exempt - Municipal
    "SWTXX",
    "SWOXX",
    // Tax-Exempt - AMT
    "SWWXX",
    "SCTXX",
    // Tax-Exempt - California
    "SWKXX",
    "SCAXX",
    // Tax-Exempt - New York
    "SWYXX",
    "SNYXX",
    // Sweep
    "SWGXX",
    // ETF
    "SGVT",
  ];

  for (const ticker of orderedTickers) {
    const meta = FUND_METADATA[ticker];
    const expense = EXPENSE_RATIOS[ticker];
    const yieldWithWaivers = yields[ticker] || "--";

    // Estimate yield without waivers (typically 0.01-0.02% lower)
    let yieldWithoutWaivers = "--";
    if (yieldWithWaivers !== "--") {
      const val = parseFloat(yieldWithWaivers);
      yieldWithoutWaivers = (val - 0.01).toFixed(2) + "%";
    }

    const notes =
      ticker === "SGVT"
        ? "ETF; NAV not stable; trades on exchange"
        : ticker === "SWGXX"
          ? "No longer publicly listed; limited availability"
          : "";

    const row = [
      meta.category,
      meta.name,
      ticker,
      yieldWithWaivers,
      yieldWithoutWaivers,
      MINIMUMS[ticker].includes(",")
        ? `"${MINIMUMS[ticker]}"`
        : MINIMUMS[ticker],
      expense.gross,
      expense.net,
      "--", // Total Net Assets (not on public page)
      ticker === "SGVT" ? "--" : "$1.00",
      meta.eligible,
      notes,
    ];

    rows.push(row.join(","));
  }

  return rows.join("\n");
}

/**
 * Get today's date in MM-DD-YYYY format
 */
function getTodayDate() {
  const now = new Date();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const yyyy = now.getFullYear();
  return `${mm}-${dd}-${yyyy}`;
}

/**
 * Main function
 */
async function main() {
  console.log("=== Schwab Money Market Fund Scraper ===\n");

  try {
    // Fetch the page
    const html = await fetchPage(SCHWAB_URL);
    console.log(`Fetched ${html.length} bytes\n`);

    // Extract yields
    const yields = extractYields(html);
    const foundCount = Object.keys(yields).length;
    console.log(`Found yields for ${foundCount} funds:\n`);

    // Display yields
    for (const [ticker, yieldVal] of Object.entries(yields)) {
      const meta = FUND_METADATA[ticker];
      console.log(`  ${ticker}: ${yieldVal.padStart(6)} - ${meta.name}`);
    }

    // Report missing funds (excluding SWGXX which we know isn't on the page)
    const missingFunds = Object.keys(FUND_METADATA).filter(
      (t) => !yields[t] && t !== "SWGXX",
    );
    if (missingFunds.length > 0) {
      console.log(
        `\nNote: Could not find yields for: ${missingFunds.join(", ")}`,
      );
    }

    // Report SWGXX status
    console.log("\nNote: SWGXX (Sweep) is no longer on the public page");

    if (foundCount === 0) {
      console.error(
        "\nError: No yields found. The page structure may have changed.",
      );
      console.log("Saving HTML for debugging...");
      fs.writeFileSync("debug-schwab.html", html);
      console.log("Saved to debug-schwab.html");
      process.exit(1);
    }

    // Build CSV
    const csv = buildCSV(yields);

    // Save to file
    const dateStr = getTodayDate();
    const filename = `schwab_money_funds_${dateStr}.csv`;
    const publicDir = path.join(__dirname, "..", "public");
    const filepath = path.join(publicDir, filename);

    fs.writeFileSync(filepath, csv);
    console.log(`\nSaved to: ${filepath}`);
    console.log(`\nTotal funds: ${Object.keys(FUND_METADATA).length}`);
    console.log(`Yields found: ${foundCount}`);

    // Update the CSV manifest file
    updateManifest(publicDir);

    console.log("\nDone!");
  } catch (error) {
    console.error("\nError:", error.message);
    process.exit(1);
  }
}

/**
 * Update csv-manifest.json with all available CSV files
 */
function updateManifest(publicDir) {
  const csvFiles = fs
    .readdirSync(publicDir)
    .filter((f) => f.startsWith("schwab_money_funds_") && f.endsWith(".csv"))
    .map((name) => ({
      name,
      date: name.replace("schwab_money_funds_", "").replace(".csv", ""),
    }));

  // Sort by date (newest first) - parse MM-DD-YYYY format
  csvFiles.sort((a, b) => {
    const [aMonth, aDay, aYear] = a.date.split("-").map(Number);
    const [bMonth, bDay, bYear] = b.date.split("-").map(Number);
    const aDate = new Date(aYear, aMonth - 1, aDay);
    const bDate = new Date(bYear, bMonth - 1, bDay);
    return bDate - aDate;
  });

  const manifestPath = path.join(publicDir, "csv-manifest.json");
  fs.writeFileSync(manifestPath, JSON.stringify(csvFiles, null, 2) + "\n");
  console.log(`\nUpdated manifest: ${manifestPath}`);
  console.log(`Total CSV files in manifest: ${csvFiles.length}`);
}

main();
