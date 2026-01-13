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
            filingStatus: 'single',
            state: 'MO'
        },
        selectedFunds: [],
        sortColumn: 'taxEquivalentYield',
        sortDirection: 'desc',
        csvFilename: null
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
        refreshBtn: null,
        exportBtn: null,
        fundSelector: null,
        dateRangeSelect: null,
        lastUpdated: null,
        taxSummary: null
    };

    /**
     * Initialize the application
     */
    async function init() {
        cacheElements();
        setupEventListeners();
        
        // Initialize chart
        ChartHandler.initChart('yield-chart');
        
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
        elements.profileForm = document.getElementById('profile-form');
        elements.loading = document.getElementById('loading');
        elements.errorState = document.getElementById('error-state');
        elements.recommendationCard = document.getElementById('recommendation-card');
        elements.tableWrapper = document.getElementById('table-wrapper');
        elements.resultsTable = document.getElementById('results-table');
        elements.resultsTbody = document.getElementById('results-tbody');
        elements.refreshBtn = document.getElementById('refresh-btn');
        elements.exportBtn = document.getElementById('export-btn');
        elements.fundSelector = document.getElementById('fund-selector');
        elements.dateRangeSelect = document.getElementById('date-range');
        elements.lastUpdated = document.getElementById('last-updated');
        elements.taxSummary = document.getElementById('tax-summary');
    }

    function setupEventListeners() {
        if (elements.profileForm) {
            elements.profileForm.addEventListener('submit', handleProfileSubmit);
            ['income', 'filing-status', 'state'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.addEventListener('change', updateTaxSummary);
            });
        }

        if (elements.refreshBtn) elements.refreshBtn.addEventListener('click', handleRefresh);
        if (elements.exportBtn) elements.exportBtn.addEventListener('click', handleExport);
        
        if (elements.resultsTable) {
            elements.resultsTable.querySelectorAll('th.sortable').forEach(header => {
                header.addEventListener('click', handleSort);
            });
        }

        if (elements.dateRangeSelect) {
            elements.dateRangeSelect.addEventListener('change', updateChart);
        }
    }

    async function loadFundsData() {
        showLoading(true);
        hideError();
        
        try {
            // Use the most recent CSV file for the main table
            const filename = 'schwab_money_funds_12-31-2025.csv';
            state.csvFilename = filename;
            
            const response = await fetch(filename + '?cb=' + Date.now());
            if (!response.ok) throw new Error('Could not find CSV file');
            
            const text = await response.text();
            const data = window.parseCSV(text);
            
            state.funds = data.filter(row => {
                const min = (row['MinimumInitialInvestment'] || '').toLowerCase();
                const eligible = (row['EligibleInvestors'] || '').toLowerCase();
                return (min.includes('no minimum') || min === '$0') && eligible.includes('retail');
            }).map(row => ({
                fundName: row['FundName'],
                symbol: row['Ticker'],
                category: categorizeFund(row),
                grossYield: parseFloat((row['7DayYieldWithWaivers'] || '0').replace('%', '')),
                expenseRatio: parseFloat((row['NetExpenseRatio'] || '0').replace('%', '')),
                netYield: null,
                taxEquivalentYield: null,
                annualReturn: null
            }));
            
            updateLastUpdated();
            showLoading(false);
        } catch (error) {
            console.error('Error loading CSV:', error);
            showError(`Error: ${error.message}`);
            showLoading(false);
        }
    }

    /**
     * Categorize fund based on CSV Category column or fund name
     * Maps CSV display categories to internal category keys that match tax-calculator.js
     */
    function categorizeFund(row) {
        // The CSV has a Category column with display names like "Taxable Money Funds"
        // We need to map these to internal keys: taxable, treasury, municipal, state-municipal
        const csvCategory = (row['Category'] || '').toLowerCase();
        
        // Map CSV display categories to internal keys
        if (csvCategory.includes('treasury')) return 'treasury';
        if (csvCategory.includes('tax-exempt')) return 'municipal';
        if (csvCategory.includes('state-specific') || csvCategory.includes('state municipal')) return 'state-municipal';
        if (csvCategory.includes('taxable')) return 'taxable';
        
        // Fallback to fund name analysis if Category column is missing/unclear
        const name = (row['FundName'] || '').toLowerCase();
        if (name.includes('treasury')) return 'treasury';
        if (name.includes('tax-exempt') || name.includes('municipal')) {
            if (name.includes('california') || name.includes('new york')) {
                return 'state-municipal';
            }
            return 'municipal';
        }
        
        return 'taxable';
    }

    function calculateAndDisplay() {
        if (!state.funds.length) return;
        state.calculatedResults = TaxCalculator.calculateAllFunds(state.funds, state.userProfile);
        displayRecommendation();
        displayResultsTable();
    }

    function displayRecommendation() {
        const top = state.calculatedResults[0];
        if (!top) return;
        document.getElementById('rec-fund-name').textContent = top.fundName;
        document.getElementById('rec-tey').textContent = TaxCalculator.formatPercent(top.taxEquivalentYield);
        document.getElementById('rec-net-yield').textContent = TaxCalculator.formatPercent(top.netYield);
        document.getElementById('rec-annual-return').textContent = TaxCalculator.formatCurrency(top.annualReturn);
        document.getElementById('rec-explanation').textContent = TaxCalculator.getRecommendationExplanation(top, state.userProfile);
        elements.recommendationCard.classList.remove('hidden');
    }

    function displayResultsTable() {
        // Map keys to display names for the UI
        const categoryLabels = {
            'taxable': 'Taxable Money Funds',
            'treasury': 'Treasury Money Funds',
            'municipal': 'Tax-Exempt Money Funds',
            'state-municipal': 'State-Specific'
        };

        elements.resultsTbody.innerHTML = '';
        state.calculatedResults.forEach((res, i) => {
            const row = document.createElement('tr');
            if (i === 0) row.classList.add('top-result');
            
            // Make row clickable
            row.style.cursor = 'pointer';
            row.addEventListener('click', () => showMathExplanation(res));
            
            const friendlyCategory = categoryLabels[res.category] || res.category;

            row.innerHTML = `
                <td>${res.fundName}</td>
                <td>${res.symbol}</td>
                <td><span class="category-badge">${friendlyCategory}</span></td>
                <td>${TaxCalculator.formatPercent(res.grossYield)}</td>
                <td>${TaxCalculator.formatPercent(res.expenseRatio)}</td>
                <td>${TaxCalculator.formatPercent(res.netYield)}</td>
                <td><strong>${TaxCalculator.formatPercent(res.taxEquivalentYield)}</strong></td>
                <td>${TaxCalculator.formatCurrency(res.annualReturn)}</td>
            `;
            elements.resultsTbody.appendChild(row);
        });
        elements.tableWrapper.classList.remove('hidden');
    }

    async function handleProfileSubmit(e) {
        e.preventDefault();
        const formData = new FormData(e.target);
        state.userProfile = {
            income: parseFloat(formData.get('income')),
            filingStatus: formData.get('filingStatus'),
            state: formData.get('state')
        };
        calculateAndDisplay();
        updateTaxSummary();
    }

    function updateTaxSummary() {
        const income = parseFloat(document.getElementById('income').value) || 0;
        const filingStatus = document.getElementById('filing-status').value;
        const stateCode = document.getElementById('state').value;

        const fed = TaxCalculator.calculateFederalMarginalRate(income, filingStatus);
        const st = TaxCalculator.calculateStateMarginalRate(stateCode);
        const comb = fed + st * (1 - fed);

        document.getElementById('federal-rate').textContent = TaxCalculator.formatPercent(fed * 100);
        document.getElementById('state-rate').textContent = TaxCalculator.formatPercent(st * 100);
        document.getElementById('combined-rate').textContent = TaxCalculator.formatPercent(comb * 100);
    }

    async function updateChart() {
        try {
            const days = elements.dateRangeSelect ? parseInt(elements.dateRangeSelect.value) : 30;
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
        state.sortDirection = (state.sortColumn === col && state.sortDirection === 'desc') ? 'asc' : 'desc';
        state.sortColumn = col;
        state.calculatedResults.sort((a, b) => {
            const valA = a[col], valB = b[col];
            return state.sortDirection === 'asc' ? (valA > valB ? 1 : -1) : (valA < valB ? 1 : -1);
        });
        displayResultsTable();
    }

    async function handleRefresh() {
        elements.refreshBtn.disabled = true;
        await loadFundsData();
        calculateAndDisplay();
        await updateChart();
        elements.refreshBtn.disabled = false;
    }

    function handleExport() {
        const csvContent = "data:text/csv;charset=utf-8," + 
            ["Fund,Ticker,Yield,TEY"].join(",") + "\n" +
            state.calculatedResults.map(r => `${r.fundName},${r.symbol},${r.netYield},${r.taxEquivalentYield}`).join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "money_funds.csv");
        document.body.appendChild(link);
        link.click();
    }

    function showLoading(show) {
        elements.loading.classList.toggle('hidden', !show);
        elements.tableWrapper.classList.toggle('hidden', show);
    }

    function showError(msg) {
        document.getElementById('error-message').textContent = msg;
        elements.errorState.classList.remove('hidden');
    }

    function hideError() {
        elements.errorState.classList.add('hidden');
    }

    function updateLastUpdated() {
        elements.lastUpdated.textContent = new Date().toLocaleString();
    }

    function showMathExplanation(fund) {
        const { category, grossYield, expenseRatio, netYield, taxEquivalentYield, effectiveTaxRate, federalRate, stateRate } = fund;
        
        // Map internal category to display name
        const categoryLabels = {
            'taxable': 'Taxable Money Funds',
            'treasury': 'Treasury Money Funds',
            'municipal': 'Tax-Exempt Money Funds',
            'state-municipal': 'State-Specific'
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

        if (category === 'taxable') {
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
        let modal = document.getElementById('math-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'math-modal';
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
            
            const modalContent = document.createElement('div');
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
            
            const closeBtn = document.createElement('button');
            closeBtn.textContent = '✕';
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
            closeBtn.onmouseover = () => closeBtn.style.background = '#f0f0f0';
            closeBtn.onmouseout = () => closeBtn.style.background = 'none';
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
        
        document.getElementById('modal-body').innerHTML = explanation;
    }

    document.addEventListener('DOMContentLoaded', () => {
        init().catch(err => console.error("Initialization failed:", err));
    });

    return { 
        refreshData: handleRefresh,
        categorizeFund: categorizeFund
    };
})();