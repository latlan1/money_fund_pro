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
    sortColumn: "taxEquivalentYield",
    sortDirection: "desc",
    csvFilename: null,
    currentTab: "table",
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
    dateRangeSelect: null,
    lastUpdated: null,
    taxSummary: null,
    resultsTabs: null,
    panelTable: null,
    panelHeatmap: null,
    panelBreakdown: null,
    tabBtns: null,
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
    elements.dateRangeSelect = document.getElementById("date-range");
    if (elements.dateRangeSelect && !elements.dateRangeSelect.value) {
      elements.dateRangeSelect.value = "0"; // Default to All Time
    }
    elements.lastUpdated = document.getElementById("last-updated");
    elements.footerDataDate = document.getElementById("footer-data-date");
    elements.taxSummary = document.getElementById("tax-summary");
    elements.resultsTabs = document.getElementById("results-tabs");
    elements.panelTable = document.getElementById("panel-table");
    elements.panelHeatmap = document.getElementById("panel-heatmap");
    elements.panelBreakdown = document.getElementById("panel-breakdown");
    elements.tabBtns = document.querySelectorAll(".tab-btn");
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

    elements.tabBtns.forEach((btn) => {
      btn.addEventListener("click", () => switchTab(btn.dataset.tab));
    });

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
      if (!csvList.length) throw new Error("No CSV files found");

      // Sort by date using shared utility (handles MM-DD-YYYY format)
      const sortedList = DataUtils.sortCsvFilesByDate(csvList);
      const latest = sortedList[0];
      const filename = latest.name;
      state.csvFilename = filename;

      const response = await fetch(filename + "?cb=" + Date.now());
      if (!response.ok) throw new Error(`Could not load ${filename}`);

      const text = await response.text();
      const data = DataUtils.parseCSV(text);

      // Use shared function to get ALL funds (not just filtered retail)
      state.funds = DataUtils.getAllFunds(data);

      updateLastUpdated(latest.date);
      showLoading(false);
    } catch (error) {
      console.error("Error loading CSV:", error);
      showError(`Error: ${error.message}`);
      showLoading(false);
    }
  }

  function calculateAndDisplay() {
    if (!state.funds.length) return;
    state.calculatedResults = TaxCalculator.calculateAllFunds(
      state.funds,
      state.userProfile,
    );
    displayRecommendation();
    displayResultsTable();
    renderHeatmap(state.calculatedResults);
    renderBreakdown(state.calculatedResults);
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

    // Map category keys to CSS class names for Type badges
    const typeCssClasses = {
      taxable: "type-taxable",
      treasury: "type-treasury",
      municipal: "type-municipal",
      "state-municipal": "type-state-municipal",
      sweep: "type-sweep",
      etf: "type-etf",
    };

    // Map Fund Category text to CSS class names
    const fundCategoryCssClasses = {
      "Taxable - Subject to all taxes": "fund-cat-taxable",
      "Treasury - State tax-free": "fund-cat-treasury",
      "Municipal - Federal tax-free": "fund-cat-municipal",
      "State Municipal - Both tax-free (residents only)":
        "fund-cat-state-municipal",
    };

    elements.resultsTbody.innerHTML = "";
    state.calculatedResults.forEach((res, i) => {
      const row = document.createElement("tr");
      if (i === 0) row.classList.add("top-result");

      // Make row clickable
      row.style.cursor = "pointer";
      row.addEventListener("click", () => showMathExplanation(res));

      const friendlyType = typeLabels[res.category] || res.category;
      const typeCssClass = typeCssClasses[res.category] || "type-taxable";
      const fundCategory = res.fundCategory || "Taxable - Subject to all taxes";
      const fundCatCssClass =
        fundCategoryCssClasses[fundCategory] || "fund-cat-taxable";

      row.innerHTML = `
                <td class="row-number">${i + 1}</td>
                <td>${res.fundName}</td>
                <td>${res.symbol}</td>
                <td><span class="category-badge ${typeCssClass}">${friendlyType}</span></td>
                <td><span class="fund-category-badge ${fundCatCssClass}">${fundCategory}</span></td>
                <td>${TaxCalculator.formatPercent(res.grossYield)}</td>
                <td>${TaxCalculator.formatPercent(res.expenseRatio)}</td>
                <td>${TaxCalculator.formatPercent(res.netYield)}</td>
                <td><strong>${TaxCalculator.formatPercent(res.taxEquivalentYield)}</strong></td>
                <td>${TaxCalculator.formatCurrency(res.annualReturn)}</td>
            `;
      elements.resultsTbody.appendChild(row);
    });
    elements.tableWrapper.classList.remove("hidden");
    if (elements.resultsTabs) elements.resultsTabs.classList.remove("hidden");

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
        ? parseInt(elements.dateRangeSelect.value || "0", 10) || 0
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
    if (elements.resultsTabs) elements.resultsTabs.classList.toggle("hidden", show);
  }

  function showError(msg) {
    document.getElementById("error-message").textContent = msg;
    elements.errorState.classList.remove("hidden");
    if (elements.resultsTabs) elements.resultsTabs.classList.add("hidden");
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

  // Fetch available CSV files from manifest
  async function fetchCsvList() {
    // Try server API first (for local dev), then static manifest (for GitHub Pages)
    try {
      const res = await fetch("/api/csv-files?cb=" + Date.now());
      if (res.ok) {
        return await res.json();
      }
    } catch (_) {}

    // Fallback to static manifest file (works on GitHub Pages)
    try {
      const res = await fetch("csv-manifest.json?cb=" + Date.now());
      if (res.ok) {
        return await res.json();
      }
    } catch (_) {}

    console.warn("Could not load CSV manifest");
    return [];
  }

  function showMathExplanation(fund) {
    const {
      category,
      grossYield,
      expenseRatio,
      netYield,
      taxEquivalentYield,
      taxRateAvoided,
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
    <p>Tax Rate Avoided by This Fund: <strong>${(taxRateAvoided * 100).toFixed(2)}%</strong></p>
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
    <p>Formula: TEY = Net Yield ÷ (1 - Tax Rate Avoided)</p>
    <p><strong>${taxEquivalentYield.toFixed(2)}% = ${netYield.toFixed(2)}% ÷ (1 - ${(taxRateAvoided * 100).toFixed(2)}%)</strong></p>
    <p><strong>${taxEquivalentYield.toFixed(2)}% = ${netYield.toFixed(2)}% ÷ ${((1 - taxRateAvoided) * 100).toFixed(2)}%</strong></p>`;
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

  function switchTab(tabName) {
    state.currentTab = tabName;
    elements.tabBtns.forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.tab === tabName);
    });
    elements.panelTable.classList.toggle("hidden", tabName !== "table");
    elements.panelHeatmap.classList.toggle("hidden", tabName !== "heatmap");
    elements.panelBreakdown.classList.toggle("hidden", tabName !== "breakdown");
  }

  function renderHeatmap(results) {
    if (!results || results.length === 0) return;

    const typeLabels = {
      taxable: "Taxable",
      treasury: "Treasury",
      municipal: "Municipal",
      "state-municipal": "State Municipal",
      sweep: "Sweep",
      etf: "ETF",
    };

    function bubbleStyle(rank, total) {
      const pct = rank / total;
      if (pct < 0.15)
        return { bg: "#a7f3d0", fg: "#064e3b", border: "2px solid #10b981" };
      if (pct < 0.4)
        return { bg: "#d1fae5", fg: "#065f46", border: "1px solid #6ee7b7" };
      if (pct < 0.7)
        return { bg: "#fef9c3", fg: "#713f12", border: "1px solid #fcd34d" };
      return { bg: "#fee2e2", fg: "#991b1b", border: "1px solid #fca5a5" };
    }

    const total = results.length;
    const grid = document.createElement("div");
    grid.className = "bubble-grid";

    results.forEach((fund, i) => {
      const style = bubbleStyle(i, total);
      const bubble = document.createElement("div");
      bubble.className = "bubble";
      bubble.style.cssText = `background:${style.bg};color:${style.fg};border:${style.border};`;
      const label = typeLabels[fund.category] || fund.category;
      bubble.innerHTML = `
        ${i === 0 ? '<span class="bubble-star">★</span>' : ""}
        <div class="bubble-ticker">${fund.symbol}</div>
        <div class="bubble-tey">${TaxCalculator.formatPercent(fund.taxEquivalentYield)}</div>
        <div class="bubble-category">${label}</div>
      `;
      bubble.addEventListener("click", () => showMathExplanation(fund));
      grid.appendChild(bubble);
    });

    const scaleBar = document.createElement("div");
    scaleBar.className = "tey-scale-bar";
    scaleBar.innerHTML = `
      <span>Low TEY</span>
      <div class="tey-scale-gradient"></div>
      <span>High TEY</span>
    `;

    elements.panelHeatmap.innerHTML = "";
    elements.panelHeatmap.appendChild(grid);
    elements.panelHeatmap.appendChild(scaleBar);
  }

  function renderBreakdown(results) {
    if (!results || results.length === 0) return;

    const maxTey = results[0].taxEquivalentYield;
    if (maxTey <= 0) return;

    const legend = document.createElement("div");
    legend.className = "breakdown-legend";
    legend.innerHTML = `
      <div class="breakdown-legend-item">
        <div class="breakdown-legend-swatch" style="background:#10b981;"></div>Tax saved
      </div>
      <div class="breakdown-legend-item">
        <div class="breakdown-legend-swatch" style="background:#3b82f6;opacity:0.85;"></div>Net yield
      </div>
      <div class="breakdown-legend-item">
        <div class="breakdown-legend-swatch" style="background:#f59e0b;"></div>Expense ratio
      </div>
    `;

    const rows = document.createElement("div");
    rows.className = "breakdown-rows";

    results.forEach((fund, i) => {
      const taxSavedYield = fund.taxEquivalentYield - fund.netYield;
      const expPct = (fund.expenseRatio / maxTey) * 100;
      const netPct = (fund.netYield / maxTey) * 100;
      const taxPct = (taxSavedYield / maxTey) * 100;

      const row = document.createElement("div");
      row.className = "breakdown-row";
      row.innerHTML = `
        <span class="breakdown-ticker">${fund.symbol}</span>
        <div class="stacked-bar">
          <div class="seg-tax" style="width:${Math.max(0, taxPct).toFixed(1)}%"></div>
          <div class="seg-net" style="width:${Math.max(0, netPct).toFixed(1)}%"></div>
          <div class="seg-exp" style="width:${Math.max(0, expPct).toFixed(1)}%"></div>
        </div>
        <span class="breakdown-tey${i === 0 ? " top" : ""}">${TaxCalculator.formatPercent(fund.taxEquivalentYield)}</span>
      `;
      row.addEventListener("click", () => showMathExplanation(fund));
      rows.appendChild(row);
    });

    elements.panelBreakdown.innerHTML = "";
    elements.panelBreakdown.appendChild(legend);
    elements.panelBreakdown.appendChild(rows);
  }

  document.addEventListener("DOMContentLoaded", () => {
    init().catch((err) => console.error("Initialization failed:", err));
  });

  return {
    refreshData: handleRefresh,
  };
})();
