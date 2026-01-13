/**
 * Unit Tests for Data Loading and Processing
 * Ensures table and chart data are always properly loaded
 */

const fs = require("fs");
const path = require("path");
const {
  parseCSV,
  parseCSVLine,
  cleanValue,
  getField,
  parsePercent,
  categorizeFund,
  transformRowToFund,
  getAllFunds,
  filterRetailFunds,
  parseDateMMDDYYYY,
  sortCsvFilesByDate,
  transformRowsForChart,
  aggregateChartData,
} = require("../src/data-utils");

// Sample CSV content for testing
const SAMPLE_CSV = `Category,Fund Name,Ticker,7-Day Yield (with waivers),7-Day Yield (without waivers),Minimum Initial Investment,Gross Expense Ratio,Net Expense Ratio,Total Net Assets,NAV,Eligible Investors,Notes
Taxable Money Funds,Schwab Prime Advantage Money Fund - Investor Shares,SWVXX,4.52%,4.51%,No Minimum,0.35%,0.34%,"$250,994,256,185",$1.00,Retail,
Treasury Money Funds,Schwab Treasury Obligations Money Fund - Investor Shares,SNOXX,4.23%,4.22%,No Minimum,0.35%,0.34%,"$50,000,000,000",$1.00,Retail,
Tax-Exempt Money Funds,Schwab Municipal Money Fund - Investor Shares,SWTXX,2.89%,2.88%,No Minimum,0.40%,0.39%,"$10,000,000,000",$1.00,Retail,
Taxable Money Funds,Schwab Prime Advantage Money Fund - Ultra Shares,SNAXX,4.67%,4.66%,"$1,000,000",0.20%,0.19%,"$143,750,149,034",$1.00,Retail,
Taxable Money Funds,Schwab Government Money Fund - Investor Shares,SNVXX,4.12%,4.11%,No Minimum,0.35%,0.34%,"$32,895,721,578",$1.00,Retail/Institutional,
Sweep Money Fund,Schwab Government Money Fund - Sweep Shares,SWGXX,3.32%,3.31%,No Minimum,0.45%,0.44%,"$23,166,163,581",$1.00,--,
Money Market ETF,Schwab Government Money Market ETF,SGVT,3.45%,,,,0.28%,"$488,809,105",$100.58,Retail/Institutional,ETF; NAV not stable`;

describe("CSV Parsing", () => {
  describe("parseCSVLine", () => {
    test("parses simple comma-separated values", () => {
      const result = parseCSVLine("a,b,c");
      expect(result).toEqual(["a", "b", "c"]);
    });

    test("handles quoted fields with commas", () => {
      const result = parseCSVLine('a,"b,c",d');
      expect(result).toEqual(["a", "b,c", "d"]);
    });

    test("handles quoted fields with dollar amounts", () => {
      const result = parseCSVLine('Fund Name,"$1,000,000",4.52%');
      expect(result).toEqual(["Fund Name", "$1,000,000", "4.52%"]);
    });

    test("handles escaped quotes within quoted fields", () => {
      const result = parseCSVLine('a,"He said ""hello""",c');
      expect(result).toEqual(["a", 'He said "hello"', "c"]);
    });

    test("handles empty fields", () => {
      const result = parseCSVLine("a,,c");
      expect(result).toEqual(["a", "", "c"]);
    });
  });

  describe("cleanValue", () => {
    test("trims whitespace", () => {
      expect(cleanValue("  hello  ")).toBe("hello");
    });

    test("removes surrounding quotes", () => {
      expect(cleanValue('"hello"')).toBe("hello");
    });

    test("preserves inner quotes", () => {
      expect(cleanValue('hello "world"')).toBe('hello "world"');
    });
  });

  describe("parseCSV", () => {
    test("parses CSV into array of objects", () => {
      const result = parseCSV(SAMPLE_CSV);
      expect(result).toBeInstanceOf(Array);
      expect(result.length).toBe(7);
    });

    test("maps headers to values correctly", () => {
      const result = parseCSV(SAMPLE_CSV);
      expect(result[0]["Fund Name"]).toBe(
        "Schwab Prime Advantage Money Fund - Investor Shares",
      );
      expect(result[0]["Ticker"]).toBe("SWVXX");
      expect(result[0]["7-Day Yield (with waivers)"]).toBe("4.52%");
    });

    test("handles empty input", () => {
      expect(parseCSV("")).toEqual([]);
      expect(parseCSV(null)).toEqual([]);
      expect(parseCSV("   ")).toEqual([]);
    });

    test("handles single header row with no data", () => {
      const result = parseCSV("Header1,Header2,Header3");
      expect(result).toEqual([]);
    });

    test("preserves all columns from CSV", () => {
      const result = parseCSV(SAMPLE_CSV);
      const expectedColumns = [
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
      expectedColumns.forEach((col) => {
        expect(result[0]).toHaveProperty(col);
      });
    });
  });
});

describe("Field Utilities", () => {
  describe("getField", () => {
    test("returns value for first matching key", () => {
      const row = { "Fund Name": "Test Fund", FundName: "Backup" };
      expect(getField(row, ["Fund Name", "FundName"])).toBe("Test Fund");
    });

    test("falls back to second key if first missing", () => {
      const row = { FundName: "Backup" };
      expect(getField(row, ["Fund Name", "FundName"])).toBe("Backup");
    });

    test("returns empty string if no keys match", () => {
      const row = { Other: "value" };
      expect(getField(row, ["Fund Name", "FundName"])).toBe("");
    });
  });

  describe("parsePercent", () => {
    test("parses percentage string", () => {
      expect(parsePercent("4.52%")).toBe(4.52);
    });

    test("parses number without percent sign", () => {
      expect(parsePercent("4.52")).toBe(4.52);
    });

    test("handles empty input", () => {
      expect(parsePercent("")).toBe(0);
      expect(parsePercent(null)).toBe(0);
      expect(parsePercent(undefined)).toBe(0);
    });

    test("handles whitespace", () => {
      expect(parsePercent("  4.52%  ")).toBe(4.52);
    });

    test("returns 0 for invalid input", () => {
      expect(parsePercent("abc")).toBe(0);
    });
  });
});

describe("Fund Categorization", () => {
  describe("categorizeFund", () => {
    test("categorizes taxable funds correctly", () => {
      const row = { Category: "Taxable Money Funds" };
      expect(categorizeFund(row)).toBe("taxable");
    });

    test("categorizes treasury funds correctly", () => {
      const row = { Category: "Treasury Money Funds" };
      expect(categorizeFund(row)).toBe("treasury");
    });

    test("categorizes municipal funds correctly", () => {
      const row = { Category: "Tax-Exempt Money Funds" };
      expect(categorizeFund(row)).toBe("municipal");
    });

    test("categorizes state-specific funds correctly", () => {
      const row = { Category: "State-Specific Municipal Funds" };
      expect(categorizeFund(row)).toBe("state-municipal");
    });

    test("categorizes sweep funds correctly", () => {
      const row = { Category: "Sweep Money Fund" };
      expect(categorizeFund(row)).toBe("sweep");
    });

    test("categorizes ETF funds correctly", () => {
      const row = { Category: "Money Market ETF" };
      expect(categorizeFund(row)).toBe("etf");
    });

    test("falls back to fund name when category missing", () => {
      const row = { "Fund Name": "Treasury Obligations Fund" };
      expect(categorizeFund(row)).toBe("treasury");
    });

    test("identifies ETF from fund name", () => {
      const row = {
        Category: "Unknown",
        "Fund Name": "Schwab Government Money Market ETF",
      };
      expect(categorizeFund(row)).toBe("etf");
    });

    test("defaults to taxable when unrecognized", () => {
      const row = { Category: "Unknown", "Fund Name": "Random Fund" };
      expect(categorizeFund(row)).toBe("taxable");
    });
  });
});

describe("Table Data Loading", () => {
  describe("transformRowToFund", () => {
    test("transforms a single row to fund object", () => {
      const row = {
        Category: "Taxable Money Funds",
        "Fund Name": "Test Fund",
        Ticker: "TEST",
        "7-Day Yield (with waivers)": "4.52%",
        "Net Expense Ratio": "0.34%",
        "Minimum Initial Investment": "No Minimum",
        "Eligible Investors": "Retail",
      };
      const result = transformRowToFund(row);

      expect(result.fundName).toBe("Test Fund");
      expect(result.symbol).toBe("TEST");
      expect(result.category).toBe("taxable");
      expect(result.grossYield).toBe(4.52);
      expect(result.expenseRatio).toBe(0.34);
      expect(result.minimumInvestment).toBe("No Minimum");
      expect(result.eligibleInvestors).toBe("Retail");
    });
  });

  describe("getAllFunds", () => {
    test("returns all funds without filtering", () => {
      const rows = parseCSV(SAMPLE_CSV);
      const result = getAllFunds(rows);

      // Should include all 7 funds (including Ultra, Sweep, and ETF)
      expect(result.length).toBe(7);
    });

    test("includes sweep and ETF funds", () => {
      const rows = parseCSV(SAMPLE_CSV);
      const result = getAllFunds(rows);

      const sweep = result.find((f) => f.symbol === "SWGXX");
      const etf = result.find((f) => f.symbol === "SGVT");

      expect(sweep).toBeDefined();
      expect(sweep.category).toBe("sweep");
      expect(etf).toBeDefined();
      expect(etf.category).toBe("etf");
    });

    test("includes funds with high minimum investment", () => {
      const rows = parseCSV(SAMPLE_CSV);
      const result = getAllFunds(rows);

      const ultraShares = result.find((f) => f.symbol === "SNAXX");
      expect(ultraShares).toBeDefined();
      expect(ultraShares.minimumInvestment).toBe("$1,000,000");
    });
  });

  describe("filterRetailFunds", () => {
    test("filters for retail funds with no minimum", () => {
      const rows = parseCSV(SAMPLE_CSV);
      const result = filterRetailFunds(rows);

      // Should include funds with "No Minimum" and "Retail" in eligible investors
      expect(result.length).toBeGreaterThan(0);

      // Should exclude Ultra Shares ($1,000,000 minimum)
      const hasUltra = result.some((f) => f.symbol === "SNAXX");
      expect(hasUltra).toBe(false);
    });

    test("includes correct fields in output", () => {
      const rows = parseCSV(SAMPLE_CSV);
      const result = filterRetailFunds(rows);

      expect(result[0]).toHaveProperty("fundName");
      expect(result[0]).toHaveProperty("symbol");
      expect(result[0]).toHaveProperty("category");
      expect(result[0]).toHaveProperty("grossYield");
      expect(result[0]).toHaveProperty("expenseRatio");
    });

    test("parses yield values correctly", () => {
      const rows = parseCSV(SAMPLE_CSV);
      const result = filterRetailFunds(rows);

      const swvxx = result.find((f) => f.symbol === "SWVXX");
      expect(swvxx).toBeDefined();
      expect(swvxx.grossYield).toBe(4.52);
      expect(swvxx.expenseRatio).toBe(0.34);
    });

    test("assigns correct category to each fund", () => {
      const rows = parseCSV(SAMPLE_CSV);
      const result = filterRetailFunds(rows);

      const taxable = result.find((f) => f.symbol === "SWVXX");
      const treasury = result.find((f) => f.symbol === "SNOXX");
      const municipal = result.find((f) => f.symbol === "SWTXX");

      expect(taxable.category).toBe("taxable");
      expect(treasury.category).toBe("treasury");
      expect(municipal.category).toBe("municipal");
    });

    test("returns empty array for empty input", () => {
      expect(filterRetailFunds([])).toEqual([]);
    });

    test("handles rows with missing fields gracefully", () => {
      const rows = [{ Category: "Taxable Money Funds" }];
      const result = filterRetailFunds(rows);
      // Should filter out due to missing eligible investors
      expect(result.length).toBe(0);
    });
  });
});

describe("Date Parsing and Sorting", () => {
  describe("parseDateMMDDYYYY", () => {
    test("parses MM-DD-YYYY format correctly", () => {
      const date = parseDateMMDDYYYY("01-13-2026");
      expect(date.getFullYear()).toBe(2026);
      expect(date.getMonth()).toBe(0); // January is 0
      expect(date.getDate()).toBe(13);
    });

    test("parses December date correctly", () => {
      const date = parseDateMMDDYYYY("12-31-2025");
      expect(date.getFullYear()).toBe(2025);
      expect(date.getMonth()).toBe(11); // December is 11
      expect(date.getDate()).toBe(31);
    });
  });

  describe("sortCsvFilesByDate", () => {
    test("sorts files newest first", () => {
      const files = [
        { name: "schwab_money_funds_12-22-2025.csv", date: "12-22-2025" },
        { name: "schwab_money_funds_01-13-2026.csv", date: "01-13-2026" },
        { name: "schwab_money_funds_12-31-2025.csv", date: "12-31-2025" },
      ];

      const sorted = sortCsvFilesByDate(files);

      expect(sorted[0].date).toBe("01-13-2026");
      expect(sorted[1].date).toBe("12-31-2025");
      expect(sorted[2].date).toBe("12-22-2025");
    });

    test("handles single file", () => {
      const files = [
        { name: "schwab_money_funds_12-22-2025.csv", date: "12-22-2025" },
      ];
      const sorted = sortCsvFilesByDate(files);
      expect(sorted.length).toBe(1);
    });

    test("does not mutate original array", () => {
      const files = [
        { name: "a.csv", date: "12-22-2025" },
        { name: "b.csv", date: "01-13-2026" },
      ];
      const original = [...files];
      sortCsvFilesByDate(files);
      expect(files[0].date).toBe(original[0].date);
    });
  });
});

describe("Chart Data Processing", () => {
  describe("transformRowsForChart", () => {
    test("transforms CSV rows to chart data points", () => {
      const rows = parseCSV(SAMPLE_CSV);
      const result = transformRowsForChart(rows, "01-13-2026");

      expect(result.length).toBe(7);
      expect(result[0]).toHaveProperty("category");
      expect(result[0]).toHaveProperty("fundName");
      expect(result[0]).toHaveProperty("date");
      expect(result[0]).toHaveProperty("netYield");
    });

    test("parses yield values as numbers", () => {
      const rows = parseCSV(SAMPLE_CSV);
      const result = transformRowsForChart(rows, "01-13-2026");

      expect(typeof result[0].netYield).toBe("number");
      expect(result[0].netYield).toBe(4.52);
    });

    test("assigns correct date to all points", () => {
      const rows = parseCSV(SAMPLE_CSV);
      const result = transformRowsForChart(rows, "12-31-2025");

      result.forEach((point) => {
        expect(point.date).toBe("12-31-2025");
      });
    });
  });

  describe("aggregateChartData", () => {
    test("groups data by category and date", () => {
      const dataPoints = [
        { category: "Taxable Money Funds", date: "12-22-2025", netYield: 4.5 },
        { category: "Taxable Money Funds", date: "12-22-2025", netYield: 4.3 },
        { category: "Treasury Money Funds", date: "12-22-2025", netYield: 4.2 },
        { category: "Taxable Money Funds", date: "12-31-2025", netYield: 4.6 },
      ];

      const result = aggregateChartData(dataPoints);

      expect(result.dates).toContain("12-22-2025");
      expect(result.dates).toContain("12-31-2025");
      expect(result.categoryAverages).toHaveProperty("Taxable Money Funds");
      expect(result.categoryAverages).toHaveProperty("Treasury Money Funds");
    });

    test("calculates averages correctly", () => {
      const dataPoints = [
        { category: "Taxable Money Funds", date: "12-22-2025", netYield: 4.0 },
        { category: "Taxable Money Funds", date: "12-22-2025", netYield: 5.0 },
      ];

      const result = aggregateChartData(dataPoints);
      const taxableAvg = result.categoryAverages["Taxable Money Funds"][0];

      expect(taxableAvg).toBe(4.5); // (4.0 + 5.0) / 2
    });

    test("sorts dates chronologically", () => {
      const dataPoints = [
        { category: "Taxable Money Funds", date: "01-13-2026", netYield: 4.5 },
        { category: "Taxable Money Funds", date: "12-22-2025", netYield: 4.3 },
        { category: "Taxable Money Funds", date: "12-31-2025", netYield: 4.4 },
      ];

      const result = aggregateChartData(dataPoints);

      expect(result.dates[0]).toBe("12-22-2025");
      expect(result.dates[1]).toBe("12-31-2025");
      expect(result.dates[2]).toBe("01-13-2026");
    });

    test("returns null for missing category/date combinations", () => {
      const dataPoints = [
        { category: "Taxable Money Funds", date: "12-22-2025", netYield: 4.5 },
        { category: "Treasury Money Funds", date: "12-31-2025", netYield: 4.2 },
      ];

      const result = aggregateChartData(dataPoints);

      // Treasury has no data for 12-22-2025
      const treasuryFirstDate =
        result.categoryAverages["Treasury Money Funds"][0];
      expect(treasuryFirstDate).toBeNull();
    });

    test("handles empty input", () => {
      const result = aggregateChartData([]);
      expect(result.dates).toEqual([]);
      expect(result.categoryAverages).toEqual({});
    });
  });
});

describe("Integration: Real CSV Files", () => {
  const publicDir = path.join(__dirname, "../public");

  test("at least one CSV file exists in public directory", () => {
    const files = fs
      .readdirSync(publicDir)
      .filter((f) => f.startsWith("schwab_money_funds_") && f.endsWith(".csv"));
    expect(files.length).toBeGreaterThan(0);
  });

  test("can parse all existing CSV files", () => {
    const files = fs
      .readdirSync(publicDir)
      .filter((f) => f.startsWith("schwab_money_funds_") && f.endsWith(".csv"));

    files.forEach((filename) => {
      const content = fs.readFileSync(path.join(publicDir, filename), "utf-8");
      const rows = parseCSV(content);

      expect(rows.length).toBeGreaterThan(0);
      // Check for required columns (with or without exact casing)
      const firstRow = rows[0];
      const hasCategory = "Category" in firstRow;
      const hasFundName = "Fund Name" in firstRow || "FundName" in firstRow;
      const hasTicker = "Ticker" in firstRow || "Symbol" in firstRow;

      expect(hasCategory).toBe(true);
      expect(hasFundName).toBe(true);
      expect(hasTicker).toBe(true);
    });
  });

  test("can filter retail funds from all CSV files", () => {
    const files = fs
      .readdirSync(publicDir)
      .filter((f) => f.startsWith("schwab_money_funds_") && f.endsWith(".csv"));

    files.forEach((filename) => {
      const content = fs.readFileSync(path.join(publicDir, filename), "utf-8");
      const rows = parseCSV(content);
      const funds = filterRetailFunds(rows);

      // Should have at least some retail funds
      expect(funds.length).toBeGreaterThan(0);

      // Each fund should have required fields
      funds.forEach((fund) => {
        expect(fund.fundName).toBeTruthy();
        expect(fund.symbol).toBeTruthy();
        expect(typeof fund.grossYield).toBe("number");
        expect(fund.grossYield).toBeGreaterThan(0);
      });
    });
  });

  test("can generate chart data from all CSV files", () => {
    const files = fs
      .readdirSync(publicDir)
      .filter((f) => f.startsWith("schwab_money_funds_") && f.endsWith(".csv"));

    const allDataPoints = [];

    files.forEach((filename) => {
      const dateStr = filename
        .replace("schwab_money_funds_", "")
        .replace(".csv", "");
      const content = fs.readFileSync(path.join(publicDir, filename), "utf-8");
      const rows = parseCSV(content);
      const points = transformRowsForChart(rows, dateStr);

      allDataPoints.push(...points);
    });

    expect(allDataPoints.length).toBeGreaterThan(0);

    const aggregated = aggregateChartData(allDataPoints);

    // Should have multiple dates
    expect(aggregated.dates.length).toBe(files.length);

    // Should have category data
    expect(Object.keys(aggregated.categoryAverages).length).toBeGreaterThan(0);

    // Each category should have data for each date
    Object.values(aggregated.categoryAverages).forEach((values) => {
      expect(values.length).toBe(files.length);
    });
  });
});

describe("Data Integrity Checks", () => {
  test("yield values are within reasonable range (0-10%)", () => {
    const rows = parseCSV(SAMPLE_CSV);
    const funds = filterRetailFunds(rows);

    funds.forEach((fund) => {
      expect(fund.grossYield).toBeGreaterThanOrEqual(0);
      expect(fund.grossYield).toBeLessThanOrEqual(10);
    });
  });

  test("expense ratios are within reasonable range (0-1%)", () => {
    const rows = parseCSV(SAMPLE_CSV);
    const funds = filterRetailFunds(rows);

    funds.forEach((fund) => {
      expect(fund.expenseRatio).toBeGreaterThanOrEqual(0);
      expect(fund.expenseRatio).toBeLessThanOrEqual(1);
    });
  });

  test("all funds have valid categories", () => {
    const rows = parseCSV(SAMPLE_CSV);
    const funds = filterRetailFunds(rows);
    const validCategories = [
      "taxable",
      "treasury",
      "municipal",
      "state-municipal",
      "sweep",
      "etf",
    ];

    funds.forEach((fund) => {
      expect(validCategories).toContain(fund.category);
    });
  });

  test("fund symbols are valid ticker format", () => {
    const rows = parseCSV(SAMPLE_CSV);
    const funds = filterRetailFunds(rows);

    funds.forEach((fund) => {
      // Ticker should be uppercase letters, 1-5 characters
      expect(fund.symbol).toMatch(/^[A-Z]{1,5}$/);
    });
  });
});
