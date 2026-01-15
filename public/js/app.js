/**
 * Main Application Module
 * Orchestrates the entire Money Market Fund Optimizer application
 */
const App = (() => {
  // Application state
  let state = {
    funds: [],
    calculatedResults: [],
    userProfile: {
      income: 200000,
      filingStatus: "single",
      state: "MO",
    },
    selectedFunds: [],
    sortColumn: "taxEquivalentYield",
    sortDirection: "desc",
    csvFilename: null,
  };

  // DOM elements
  const elements = {
    profileForm: null,
    loading: null,
    errorState: null,
    recommendationCard: null,
    tableWrapper: null,
    resultsTable: null,
    resultsTbody: null,
    tableScrollContainer: null,
    scrollIndicator: null,
    refreshBtn: null,
    exportBtn: null,
    fundSelector: null,
    dateRangeSelect: null,
    lastUpdated: null,
    taxSummary: null,
  };

  /**
   * Initialize the application
   */
  async function init() {
    cacheElements();
    setupEventListeners();

    // Initialize chart
    ChartHandler.initChart("yield-chart");

    // Update tax summary with default values
    updateTaxSummary();

    // Load initial data
    await loadFundsData();

    // Calculate with default profile
    calculateAndDisplay();

    // Load initial chart data
    await updateChart();
  }

  function cacheElements() {
    elements.profileForm = document.getElementById("profile-form");
    elements.loading = document.getElementById("loading");
    elements.errorState = document.getElementById("error-state");
    elements.recommendationCard = document.getElementById(
      "recommendation-card",
    );
    elements.tableWrapper = document.getElementById("table-wrapper");
    elements.resultsTable = document.getElementById("results-table");
    elements.resultsTbody = document.getElementById("results-tbody");
    elements.tableScrollContainer = document.getElementById(
      "table-scroll-container",
    );
    elements.scrollIndicator = document.getElementById("scroll-indicator");
    elements.refreshBtn = document.getElementById("refresh-btn");
    elements.exportBtn = document.getElementById("export-btn");
    elements.fundSelector = document.getElementById("fund-selector");
    elements.dateRangeSelect = document.getElementById("date-range");
    elements.lastUpdated = document.getElementById("last-updated");
    elements.footerDataDate = document.getElementById("footer-data-date");
    elements.taxSummary = document.getElementById("tax-summary");
  }

  function setupEventListeners() {
    if (elements.profileForm) {
      elements.profileForm.addEventListener("submit", handleProfileSubmit);
      ["income", "filing-status", "state"].forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.addEventListener("change", updateTaxSummary);
      });
    }

    if (elements.refreshBtn)
      elements.refreshBtn.addEventListener("click", handleRefresh);
    if (elements.exportBtn)
      elements.exportBtn.addEventListener("click", handleExport);

    if (elements.resultsTable) {
      elements.resultsTable
        .querySelectorAll("th.sortable")
        .forEach((header) => {
          header.addEventListener("click", handleSort);
        });
    }

    if (elements.dateRangeSelect) {
      elements.dateRangeSelect.addEventListener("change", updateChart);
    }

    // Handle scroll indicator visibility
    if (elements.tableScrollContainer && elements.scrollIndicator) {
      elements.tableScrollContainer.addEventListener(
        "scroll",
        updateScrollIndicator,
      );
    }
  }

  function updateScrollIndicator() {
    if (!elements.tableScrollContainer || !elements.scrollIndicator) return;

    const container = elements.tableScrollContainer;
    const isAtBottom =
      container.scrollHeight - container.scrollTop <=
      container.clientHeight + 10;
    const hasScroll = container.scrollHeight > container.clientHeight;

    if (!hasScroll || isAtBottom) {
      elements.scrollIndicator.style.display = "none";
    } else {
      elements.scrollIndicator.style.display = "flex";
    }
  }

  async function loadFundsData() {
    showLoading(true);
    hideError();

    try {
      // Dynamically pick the newest CSV in /public matching schwab_money_funds_*.csv
      const csvList = await fetchCsvList();
      console.log("CSV list fetched:", csvList);
      if (!csvList.length) throw new Error("No CSV files found");

      // Sort by date using shared utility (handles MM-DD-YYYY format)
      const sortedList = DataUtils.sortCsvFilesByDate(csvList);
      console.log("Sorted list:", sortedList);
      const latest = sortedList[0];
      const filename = latest.name;
      state.csvFilename = filename;
      console.log("Loading CSV:", filename);

      const response = await fetch(filename + "?cb=" + Date.now());
      if (!response.ok) throw new Error(`Could not load ${filename}`);

      const text = await response.text();
      console.log("CSV text length:", text.length);
      const data = DataUtils.parseCSV(text);
      console.log("Parsed rows:", data.length);

      // Use shared function to get ALL funds (not just filtered retail)
      state.funds = DataUtils.getAllFunds(data);
      console.log("All funds loaded:", state.funds.length);

      updateLastUpdated(latest.date);
      showLoading(false);
    } catch (error) {
      console.error("Error loading CSV:", error);
      showError(`Error: ${error.message}`);
      showLoading(false);
    }
  }

  function calculateAndDisplay() {
    console.log("calculateAndDisplay called, funds:", state.funds.length);
    if (!state.funds.length) {
      console.warn("No funds to calculate");
      return;
    }
    state.calculatedResults = TaxCalculator.calculateAllFunds(
      state.funds,
      state.userProfile,
    );
    console.log("Calculated results:", state.calculatedResults.length);
    displayRecommendation();
    displayResultsTable();
  }

  function displayRecommendation() {
    const top = state.calculatedResults[0];
    if (!top) return;
    document.getElementById("rec-fund-name").textContent = top.fundName;
    document.getElementById("rec-tey").textContent =
      TaxCalculator.formatPercent(top.taxEquivalentYield);
    document.getElementById("rec-net-yield").textContent =
      TaxCalculator.formatPercent(top.netYield);
    document.getElementById("rec-annual-return").textContent =
      TaxCalculator.formatCurrency(top.annualReturn);
    document.getElementById("rec-explanation").textContent =
      TaxCalculator.getRecommendationExplanation(top, state.userProfile);
    elements.recommendationCard.classList.remove("hidden");
  }

  function displayResultsTable() {
    // Map keys to display names for the UI (now used for "Type" column)
    const typeLabels = {
      taxable: "Taxable Money Funds",
      treasury: "Treasury Money Funds",
      municipal: "Tax-Exempt Money Funds",
      "state-municipal": "State-Specific",
      sweep: "Sweep Money Fund",
      etf: "Money Market ETF",
    };

    elements.resultsTbody.innerHTML = "";
    state.calculatedResults.forEach((res, i) => {
      const row = document.createElement("tr");
      if (i === 0) row.classList.add("top-result");

      // Make row clickable
      row.style.cursor = "pointer";
      row.addEventListener("click", () => showMathExplanation(res));

      const friendlyType = typeLabels[res.category] || res.category;

      row.innerHTML = `
                <td class="row-number">${i + 1}</td>
                <td>${res.fundName}</td>
                <td>${res.symbol}</td>
                <td><span class="category-badge">${friendlyType}</span></td>
                <td><span class="fund-category-badge">${res.fundCategory || "Taxable - Subject to all taxes"}</span></td>
                <td>${TaxCalculator.formatPercent(res.grossYield)}</td>
                <td>${TaxCalculator.formatPercent(res.expenseRatio)}</td>
                <td>${TaxCalculator.formatPercent(res.netYield)}</td>
                <td><strong>${TaxCalculator.formatPercent(res.taxEquivalentYield)}</strong></td>
                <td>${TaxCalculator.formatCurrency(res.annualReturn)}</td>
            `;
      elements.resultsTbody.appendChild(row);
    });
    elements.tableWrapper.classList.remove("hidden");

    // Update scroll indicator visibility after table is populated
    setTimeout(updateScrollIndicator, 0);
  }

  async function handleProfileSubmit(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    state.userProfile = {
      income: parseFloat(formData.get("income")),
      filingStatus: formData.get("filingStatus"),
      state: formData.get("state"),
    };
    calculateAndDisplay();
    updateTaxSummary();
  }

  function updateTaxSummary() {
    const income = parseFloat(document.getElementById("income").value) || 0;
    const filingStatus = document.getElementById("filing-status").value;
    const stateCode = document.getElementById("state").value;

    const fed = TaxCalculator.calculateFederalMarginalRate(
      income,
      filingStatus,
    );
    const st = TaxCalculator.calculateStateMarginalRate(stateCode);
    const comb = fed + st * (1 - fed);

    document.getElementById("federal-rate").textContent =
      TaxCalculator.formatPercent(fed * 100);
    document.getElementById("state-rate").textContent =
      TaxCalculator.formatPercent(st * 100);
    document.getElementById("combined-rate").textContent =
      TaxCalculator.formatPercent(comb * 100);
  }

  async function updateChart() {
    try {
      const days = elements.dateRangeSelect
        ? parseInt(elements.dateRangeSelect.value)
        : 0; // Default to All Time
      const data = await ChartHandler.fetchHistoricalData(days);
      if (data && data.length > 0) {
        ChartHandler.updateChart(data);
      }
    } catch (error) {
      console.error("Failed to update chart:", error);
    }
  }

  function handleSort(e) {
    const col = e.currentTarget.dataset.column;
    state.sortDirection =
      state.sortColumn === col && state.sortDirection === "desc"
        ? "asc"
        : "desc";
    state.sortColumn = col;
    state.calculatedResults.sort((a, b) => {
      const valA = a[col],
        valB = b[col];
      return state.sortDirection === "asc"
        ? valA > valB
          ? 1
          : -1
        : valA < valB
          ? 1
          : -1;
    });
    displayResultsTable();
  }

  function handleExport() {
    const csvContent =
      "data:text/csv;charset=utf-8," +
      ["Fund,Ticker,Yield,TEY"].join(",") +
      "\n" +
      state.calculatedResults
        .map(
          (r) =>
            `${r.fundName},${r.symbol},${r.netYield},${r.taxEquivalentYield}`,
        )
        .join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "money_funds.csv");
    document.body.appendChild(link);
    link.click();
  }

  function showLoading(show) {
    elements.loading.classList.toggle("hidden", !show);
    elements.tableWrapper.classList.toggle("hidden", show);
  }

  function showError(msg) {
    document.getElementById("error-message").textContent = msg;
    elements.errorState.classList.remove("hidden");
  }

  function hideError() {
    elements.errorState.classList.add("hidden");
  }

  function updateLastUpdated(dateString) {
    // dateString is in MM-DD-YYYY format from CSV filename
    let displayDate;
    if (dateString) {
      // Parse MM-DD-YYYY and format as readable date
      const parsed = DataUtils.parseDateMMDDYYYY(dateString);
      displayDate = parsed.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    } else {
      displayDate = new Date().toLocaleString();
    }

    // Update header "Last updated" element
    if (elements.lastUpdated) {
      elements.lastUpdated.textContent = displayDate;
    }

    // Update footer "Data Updated" element
    if (elements.footerDataDate) {
      elements.footerDataDate.textContent = displayDate;
    }
  }

  async function handleRefresh() {
    elements.refreshBtn.disabled = true;
    await loadFundsData();
    calculateAndDisplay();
    await updateChart();
    elements.refreshBtn.disabled = false;
  }

  // Fetch available CSV files from the server manifest endpoint
  async function fetchCsvList() {
    // Fallback: if manifest not reachable, try to infer newest CSV by hard-coded known files
    try {
      const res = await fetch("/api/csv-files?cb=" + Date.now());
      if (!res.ok) throw new Error("manifest not available");
      return await res.json();
    } catch (err) {
      console.warn("Manifest fetch failed, using fallback list", err);
      const fallback = [
        "schwab_money_funds_01-15-2026.csv",
        "schwab_money_funds_01-13-2026.csv",
        "schwab_money_funds_12-31-2025.csv",
        "schwab_money_funds_12-26-2025.csv",
        "schwab_money_funds_12-22-2025.csv",
      ];
      const existing = [];
      for (const name of fallback) {
        try {
          const res = await fetch(name + "?cb=" + Date.now(), {
            method: "HEAD",
          });
          if (res.ok) {
            existing.push({
              name,
              date: name.replace("schwab_money_funds_", "").replace(".csv", ""),
            });
          }
        } catch (_) {}
      }
      return existing;
    }
  }

  function showMathExplanation(fund) {
    const {
      category,
      grossYield,
      expenseRatio,
      netYield,
      taxEquivalentYield,
      effectiveTaxRate,
      federalRate,
      stateRate,
    } = fund;

    // Map internal category to display name
    const categoryLabels = {
      taxable: "Taxable Money Funds",
      treasury: "Treasury Money Funds",
      municipal: "Tax-Exempt Money Funds",
      "state-municipal": "State-Specific",
      sweep: "Sweep Money Fund",
      etf: "Money Market ETF",
    };
    const categoryName = categoryLabels[category] || category;

    // Build detailed explanation
    let explanation = `
<h3>${fund.fundName} (${fund.symbol})</h3>
<h4>Category: ${categoryName}</h4>

<div style="background: #f8f9fa; padding: 1rem; border-radius: 8px; margin: 1rem 0;">
    <h4>Step 1: Calculate Net Yield</h4>
    <p>Net Yield = Gross Yield - Expense Ratio</p>
    <p><strong>${netYield.toFixed(2)}% = ${grossYield.toFixed(2)}% - ${expenseRatio.toFixed(2)}%</strong></p>
</div>

<div style="background: #f8f9fa; padding: 1rem; border-radius: 8px; margin: 1rem 0;">
    <h4>Step 2: Your Tax Rates</h4>
    <p>Federal Marginal Rate: <strong>${(federalRate * 100).toFixed(2)}%</strong></p>
    <p>State Marginal Rate: <strong>${(stateRate * 100).toFixed(2)}%</strong></p>
    <p>Effective Combined Rate: <strong>${(effectiveTaxRate * 100).toFixed(2)}%</strong></p>
</div>

<div style="background: #f8f9fa; padding: 1rem; border-radius: 8px; margin: 1rem 0;">
    <h4>Step 3: Calculate Tax-Equivalent Yield</h4>`;

    if (category === "taxable") {
      explanation += `
    <p>This is a fully taxable fund, so:</p>
    <p><strong>Tax-Equivalent Yield = Net Yield = ${taxEquivalentYield.toFixed(2)}%</strong></p>
    <p>You would pay taxes on ${netYield.toFixed(2)}%, leaving you with less after-tax.</p>`;
    } else {
      explanation += `
    <p>This fund has tax advantages, so we calculate what a taxable fund would need to yield:</p>
    <p>Formula: TEY = Net Yield ÷ (1 - Tax Rate)</p>
    <p><strong>${taxEquivalentYield.toFixed(2)}% = ${netYield.toFixed(2)}% ÷ (1 - ${(effectiveTaxRate * 100).toFixed(2)}%)</strong></p>
    <p><strong>${taxEquivalentYield.toFixed(2)}% = ${netYield.toFixed(2)}% ÷ ${((1 - effectiveTaxRate) * 100).toFixed(2)}%</strong></p>`;
    }

    explanation += `
</div>

<div style="background: #e7f3ff; padding: 1rem; border-radius: 8px; margin: 1rem 0;">
    <h4>What This Means</h4>
    <p>A taxable investment would need to yield <strong>${taxEquivalentYield.toFixed(2)}%</strong> to match this fund's after-tax return of <strong>${netYield.toFixed(2)}%</strong>.</p>
    <p>On a $10,000 investment, you'd earn approximately <strong>${TaxCalculator.formatCurrency(fund.annualReturn)}</strong> per year after taxes.</p>
</div>
        `;

    // Create or update modal
    let modal = document.getElementById("math-modal");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "math-modal";
      modal.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0,0,0,0.5);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 1000;
                padding: 20px;
            `;

      const modalContent = document.createElement("div");
      modalContent.style.cssText = `
                background: white;
                padding: 2rem;
                border-radius: 12px;
                max-width: 700px;
                max-height: 90vh;
                overflow-y: auto;
                position: relative;
                box-shadow: 0 4px 20px rgba(0,0,0,0.2);
            `;

      const closeBtn = document.createElement("button");
      closeBtn.textContent = "✕";
      closeBtn.style.cssText = `
                position: absolute;
                top: 1rem;
                right: 1rem;
                background: none;
                border: none;
                font-size: 1.5rem;
                cursor: pointer;
                color: #666;
                width: 32px;
                height: 32px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
            `;
      closeBtn.onmouseover = () => (closeBtn.style.background = "#f0f0f0");
      closeBtn.onmouseout = () => (closeBtn.style.background = "none");
      closeBtn.onclick = () => modal.remove();

      modalContent.innerHTML = `<div id="modal-body"></div>`;
      modalContent.insertBefore(closeBtn, modalContent.firstChild);
      modal.appendChild(modalContent);
      document.body.appendChild(modal);

      // Close on outside click
      modal.onclick = (e) => {
        if (e.target === modal) modal.remove();
      };
    }

    document.getElementById("modal-body").innerHTML = explanation;
  }

  document.addEventListener("DOMContentLoaded", () => {
    init().catch((err) => console.error("Initialization failed:", err));
  });

  return {
    refreshData: handleRefresh,
    categorizeFund: DataUtils.categorizeFund,
  };
})();
