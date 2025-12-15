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
        sortDirection: 'desc'
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
        console.log('Initializing Money Fund Pro...');
        
        // Cache DOM elements
        cacheElements();
        
        // Setup event listeners
        setupEventListeners();
        
        // Initialize chart
        ChartHandler.initChart('yield-chart');
        
        // Load initial data
        await loadFundsData();
        
        // Calculate with default profile
        calculateAndDisplay();
        
        console.log('Application initialized successfully');
    }

    /**
     * Cache DOM element references
     */
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

    /**
     * Setup all event listeners
     */
    function setupEventListeners() {
        // Profile form submission
        if (elements.profileForm) {
            elements.profileForm.addEventListener('submit', handleProfileSubmit);
            
            // Real-time tax rate preview
            ['income', 'filing-status', 'state'].forEach(id => {
                const element = document.getElementById(id);
                if (element) {
                    element.addEventListener('input', updateTaxSummary);
                    element.addEventListener('change', updateTaxSummary);
                }
            });
        }

        // Refresh button
        if (elements.refreshBtn) {
            elements.refreshBtn.addEventListener('click', handleRefresh);
        }

        // Export button
        if (elements.exportBtn) {
            elements.exportBtn.addEventListener('click', handleExport);
        }

        // Table sorting
        if (elements.resultsTable) {
            const headers = elements.resultsTable.querySelectorAll('th.sortable');
            headers.forEach(header => {
                header.addEventListener('click', handleSort);
            });
        }

        // Date range selector
        if (elements.dateRangeSelect) {
            elements.dateRangeSelect.addEventListener('change', handleDateRangeChange);
        }
    }

    /**
     * Load funds data from API
     */
    async function loadFundsData() {
        try {
            showLoading(true);
            hideError();

            const response = await fetch('/api/funds');
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            state.funds = data;
            
            updateLastUpdated();
            showLoading(false);
            
            return data;
        } catch (error) {
            console.error('Error loading funds:', error);
            showError('Unable to load fund data. Please try refreshing the page.');
            showLoading(false);
            return [];
        }
    }

    /**
     * Calculate results and update display
     */
    function calculateAndDisplay() {
        if (state.funds.length === 0) {
            console.warn('No funds data available');
            return;
        }

        // Calculate tax-equivalent yields
        state.calculatedResults = TaxCalculator.calculateAllFunds(
            state.funds,
            state.userProfile
        );

        // Update UI
        displayRecommendation();
        displayResultsTable();
        updateFundSelector();
    }

    /**
     * Display top recommendation
     */
    function displayRecommendation() {
        if (state.calculatedResults.length === 0) return;

        const topFund = state.calculatedResults[0];
        
        // Update recommendation card
        document.getElementById('rec-fund-name').textContent = topFund.fundName;
        document.getElementById('rec-tey').textContent = 
            TaxCalculator.formatPercent(topFund.taxEquivalentYield);
        document.getElementById('rec-net-yield').textContent = 
            TaxCalculator.formatPercent(topFund.netYield);
        document.getElementById('rec-annual-return').textContent = 
            TaxCalculator.formatCurrency(topFund.annualReturn);
        document.getElementById('rec-explanation').textContent = 
            TaxCalculator.getRecommendationExplanation(topFund, state.userProfile);

        // Show card
        elements.recommendationCard.classList.remove('hidden');
    }

    /**
     * Display results in table
     */
    function displayResultsTable() {
        if (!elements.resultsTbody) return;

        // Clear existing rows
        elements.resultsTbody.innerHTML = '';

        // Create rows
        state.calculatedResults.forEach((result, index) => {
            const row = createTableRow(result, index === 0);
            elements.resultsTbody.appendChild(row);
        });

        // Show table
        elements.tableWrapper.classList.remove('hidden');
    }

    /**
     * Create a table row for a fund result
     */
    function createTableRow(result, isTop) {
        const row = document.createElement('tr');
        if (isTop) row.classList.add('top-result');
        
        // Add click event to show math explanation
        row.addEventListener('click', () => showMathExplanation(result));

        row.innerHTML = `
            <td data-label="Fund Name">${escapeHtml(result.fundName)}</td>
            <td data-label="Ticker">${escapeHtml(result.symbol || 'N/A')}</td>
            <td data-label="Category">
                <span class="category-badge category-${result.category}">
                    ${result.category.replace('-', ' ')}
                </span>
            </td>
            <td data-label="Gross Yield">${TaxCalculator.formatPercent(result.grossYield)}</td>
            <td data-label="Expense Ratio">${TaxCalculator.formatPercent(result.expenseRatio)}</td>
            <td data-label="Net Yield">${TaxCalculator.formatPercent(result.netYield)}</td>
            <td data-label="Tax-Equiv Yield">
                <strong>${TaxCalculator.formatPercent(result.taxEquivalentYield)}</strong>
            </td>
            <td data-label="Annual Return">${TaxCalculator.formatCurrency(result.annualReturn)}</td>
        `;

        return row;
    }

    /**
     * Update fund selector checkboxes
     */
    function updateFundSelector() {
        if (!elements.fundSelector) return;

        elements.fundSelector.innerHTML = '';

        state.calculatedResults.slice(0, 5).forEach(result => {
            const label = document.createElement('label');
            label.className = 'fund-checkbox';
            
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.value = result.fundName;
            checkbox.addEventListener('change', handleFundSelection);
            
            const span = document.createElement('span');
            span.textContent = result.fundName;
            
            label.appendChild(checkbox);
            label.appendChild(span);
            elements.fundSelector.appendChild(label);
        });
    }

    /**
     * Handle form submission
     */
    function handleProfileSubmit(e) {
        e.preventDefault();
        
        // Get form values
        const formData = new FormData(e.target);
        state.userProfile = {
            income: parseFloat(formData.get('income')),
            filingStatus: formData.get('filingStatus'),
            state: formData.get('state')
        };

        // Recalculate and display
        calculateAndDisplay();
        updateTaxSummary();
    }

    /**
     * Update tax summary display
     */
    function updateTaxSummary() {
        const income = parseFloat(document.getElementById('income').value) || 0;
        const filingStatus = document.getElementById('filing-status').value;
        const state = document.getElementById('state').value;

        const federalRate = TaxCalculator.calculateFederalMarginalRate(income, filingStatus);
        const stateRate = TaxCalculator.calculateStateMarginalRate(state);
        const combinedRate = federalRate + stateRate * (1 - federalRate);

        document.getElementById('federal-rate').textContent = 
            TaxCalculator.formatPercent(federalRate * 100);
        document.getElementById('state-rate').textContent = 
            TaxCalculator.formatPercent(stateRate * 100);
        document.getElementById('combined-rate').textContent = 
            TaxCalculator.formatPercent(combinedRate * 100);
    }

    /**
     * Handle refresh button click
     */
    async function handleRefresh() {
        elements.refreshBtn.disabled = true;
        elements.refreshBtn.textContent = '🔄 Refreshing...';

        try {
            const response = await fetch('/api/refresh', { method: 'POST' });
            
            if (!response.ok) {
                throw new Error('Refresh failed');
            }

            await loadFundsData();
            calculateAndDisplay();
            
        } catch (error) {
            console.error('Refresh error:', error);
            showError('Failed to refresh data. Please try again.');
        } finally {
            elements.refreshBtn.disabled = false;
            elements.refreshBtn.innerHTML = '<span class="btn-icon">🔄</span> Refresh Data';
        }
    }

    /**
     * Handle export button click
     */
    function handleExport() {
        const data = state.calculatedResults.map(result => ({
            'Fund Name': result.fundName,
            'Ticker': result.symbol || 'N/A',
            'Category': result.category,
            '7-Day Yield': result.grossYield.toFixed(2),
            'Expense Ratio': result.expenseRatio.toFixed(2),
            'Net Yield': result.netYield.toFixed(2),
            'Tax-Equiv Yield': result.taxEquivalentYield.toFixed(2),
            'Annual Return ($10k)': result.annualReturn.toFixed(2)
        }));

        // Convert to CSV
        const csv = convertToCSV(data);
        
        // Download file
        downloadFile(csv, 'money-fund-comparison.csv', 'text/csv');
    }

    /**
     * Handle table column sort
     */
    function handleSort(e) {
        const column = e.currentTarget.dataset.column;
        
        // Update sort direction
        if (state.sortColumn === column) {
            state.sortDirection = state.sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            state.sortColumn = column;
            state.sortDirection = 'desc';
        }

        // Sort results
        state.calculatedResults.sort((a, b) => {
            let aVal = a[column];
            let bVal = b[column];
            
            // Handle string comparison
            if (typeof aVal === 'string') {
                aVal = aVal.toLowerCase();
                bVal = bVal.toLowerCase();
            }
            
            if (state.sortDirection === 'asc') {
                return aVal > bVal ? 1 : -1;
            } else {
                return aVal < bVal ? 1 : -1;
            }
        });

        // Update table
        displayResultsTable();
        
        // Update sort indicators
        updateSortIndicators(column);
    }

    /**
     * Update sort indicator icons
     */
    function updateSortIndicators(activeColumn) {
        const headers = elements.resultsTable.querySelectorAll('th.sortable');
        
        headers.forEach(header => {
            const column = header.dataset.column;
            const icon = header.querySelector('.sort-icon');
            
            header.classList.remove('active', 'asc', 'desc');
            
            if (column === activeColumn) {
                header.classList.add('active', state.sortDirection);
                icon.textContent = state.sortDirection === 'asc' ? '▲' : '▼';
            } else {
                icon.textContent = '⬍';
            }
        });
    }

    /**
     * Handle fund selection for chart
     */
    function handleFundSelection(e) {
        const fundName = e.target.value;
        const label = e.target.closest('.fund-checkbox');
        
        if (e.target.checked) {
            state.selectedFunds.push(fundName);
            label.classList.add('checked');
        } else {
            state.selectedFunds = state.selectedFunds.filter(f => f !== fundName);
            label.classList.remove('checked');
        }

        updateChart();
    }

    /**
     * Handle date range change
     */
    function handleDateRangeChange(e) {
        updateChart();
    }

    /**
     * Update historical chart
     */
    async function updateChart() {
        if (state.selectedFunds.length === 0) {
            ChartHandler.clearChart();
            return;
        }

        const days = parseInt(elements.dateRangeSelect.value) || 30;
        
        const historicalData = await ChartHandler.fetchHistoricalData(
            state.selectedFunds,
            days
        );

        ChartHandler.updateChart(historicalData, state.selectedFunds);
    }

    /**
     * Show/hide loading state
     */
    function showLoading(show) {
        if (elements.loading) {
            elements.loading.classList.toggle('hidden', !show);
        }
        if (elements.tableWrapper) {
            elements.tableWrapper.classList.toggle('hidden', show);
        }
        if (elements.recommendationCard) {
            elements.recommendationCard.classList.toggle('hidden', show);
        }
    }

    /**
     * Show error message
     */
    function showError(message) {
        if (elements.errorState) {
            document.getElementById('error-message').textContent = message;
            elements.errorState.classList.remove('hidden');
        }
    }

    /**
     * Hide error message
     */
    function hideError() {
        if (elements.errorState) {
            elements.errorState.classList.add('hidden');
        }
    }

    /**
     * Update last updated timestamp
     */
    function updateLastUpdated() {
        if (elements.lastUpdated) {
            const now = new Date();
            elements.lastUpdated.textContent = now.toLocaleString();
        }
    }

    /**
     * Convert array of objects to CSV
     */
    function convertToCSV(data) {
        if (data.length === 0) return '';
        
        const headers = Object.keys(data[0]);
        const rows = data.map(obj => 
            headers.map(header => `"${obj[header]}"`).join(',')
        );
        
        return [headers.join(','), ...rows].join('\n');
    }

    /**
     * Download file
     */
    function downloadFile(content, filename, contentType) {
        const blob = new Blob([content], { type: contentType });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    /**
     * Get categorization reason based on fund name
     */
    function getCategorizationReason(fundName, category) {
        const lowerName = fundName.toLowerCase();
        
        if (category === 'treasury') {
            if (lowerName.includes('treasury')) {
                return 'Fund name contains "Treasury" - invests exclusively in US Treasury securities';
            } else if (lowerName.includes('government')) {
                return 'Fund name contains "Government" - invests in US government securities';
            }
            return 'Categorized as Treasury fund based on investment holdings';
        } else if (category === 'state-municipal') {
            if (lowerName.includes('california')) {
                return 'State-specific fund for California residents - invests in California municipal bonds';
            } else if (lowerName.includes('new york')) {
                return 'State-specific fund for New York residents - invests in New York municipal bonds';
            }
            return 'State-specific municipal fund based on fund name';
        } else if (category === 'municipal') {
            return 'Fund name contains "Municipal" - invests in tax-exempt municipal bonds';
        } else {
            return 'General money market fund - invests in taxable short-term debt securities';
        }
    }

    /**
     * Show math explanation modal
     */
    function showMathExplanation(result) {
        const taxTreatment = TaxCalculator.getTaxTreatment()[result.category] || {};
        const categorizationReason = getCategorizationReason(result.fundName, result.category);
        
        let explanation = `
            <div class="math-modal" id="math-modal">
                <div class="math-modal__content">
                    <button class="math-modal__close" id="modal-close-btn">×</button>
                    <h3 class="math-modal__title">Tax-Equivalent Yield Calculation</h3>
                    
                    <div class="math-modal__fund">
                        <strong>${escapeHtml(result.fundName)}</strong> (${escapeHtml(result.symbol || 'N/A')})<br>
                        Category: <span class="category-badge category-${result.category}">${result.category.replace('-', ' ')}</span>
                    </div>
                    
                    <div class="math-step" style="background: rgba(0, 102, 204, 0.05);">
                        <div class="math-step__title">📋 Categorization</div>
                        <p><strong>Reason:</strong> ${categorizationReason}</p>
                        <p style="font-size: 0.9rem; margin-top: 0.5rem;">
                            <strong>Source:</strong> Fund name analysis from 
                            <a href="https://www.schwab.com/money-market-funds" target="_blank" rel="noopener noreferrer" style="color: var(--primary-blue); text-decoration: underline;">Schwab Money Market Funds</a>
                        </p>
                    </div>
                    
                    <div class="math-step">
                        <div class="math-step__title">Step 1: Calculate Net Yield</div>
                        <p>Subtract the expense ratio from the gross yield:</p>
                        <div class="math-step__formula">
                            Net Yield = Gross Yield - Expense Ratio<br>
                            Net Yield = ${result.grossYield.toFixed(2)}% - ${result.expenseRatio.toFixed(2)}%
                        </div>
                        <div class="math-step__result">Net Yield = <span class="math-highlight">${result.netYield.toFixed(2)}%</span></div>
                    </div>
                    
                    <div class="math-step">
                        <div class="math-step__title">Step 2: Determine Tax Treatment</div>
                        <p><strong>${result.category.replace('-', ' ')} fund:</strong> ${taxTreatment.description || ''}</p>
                        <ul style="margin: 0.5rem 0; padding-left: 1.5rem;">
                            <li>Federal taxable: ${taxTreatment.federalTaxable ? 'Yes' : 'No'} ${taxTreatment.federalTaxable ? `(${(result.federalRate * 100).toFixed(1)}%)` : ''}</li>
                            <li>State taxable: ${taxTreatment.stateTaxable ? 'Yes' : 'No'} ${taxTreatment. stateTaxable ? `(${(result.stateRate * 100).toFixed(1)}%)` : ''}</li>
                        </ul>
                    </div>
                    
                    <div class="math-step">
                        <div class="math-step__title">Step 3: Calculate Effective Tax Rate</div>
                        <p>Combine federal and state taxes (state taxes are deductible from federal):</p>
                        <div class="math-step__formula">`;
        
        if (taxTreatment.federalTaxable && taxTreatment.stateTaxable) {
            explanation += `
                            Effective Rate = Federal Rate + (State Rate × (1 - Federal Rate))<br>
                            Effective Rate = ${(result.federalRate * 100).toFixed(1)}% + (${(result.stateRate * 100).toFixed(1)}% × (1 - ${result.federalRate.toFixed(3)}))`;
        } else if (taxTreatment.federalTaxable) {
            explanation += `
                            Effective Rate = Federal Rate (state tax-free)<br>
                            Effective Rate = ${(result.federalRate * 100).toFixed(1)}%`;
        } else if (taxTreatment.stateTaxable) {
            explanation += `
                            Effective Rate = State Rate × (1 - 0) = State Rate<br>
                            Effective Rate = ${(result.stateRate * 100).toFixed(1)}%`;
        } else {
            explanation += `
                            Effective Rate = 0% (tax-free at both levels)`;
        }
        
        explanation += `
                        </div>
                        <div class="math-step__result">Effective Tax Rate = <span class="math-highlight">${(result.effectiveTaxRate * 100).toFixed(2)}%</span></div>
                    </div>
                    
                    <div class="math-step">
                        <div class="math-step__title">Step 4: Calculate Tax-Equivalent Yield</div>
                        <p>What would a fully taxable fund need to yield to match this after-tax return?</p>
                        <div class="math-step__formula">
                            TEY = Net Yield ÷ (1 - Effective Tax Rate)<br>
                            TEY = ${result.netYield.toFixed(2)}% ÷ (1 - ${result.effectiveTaxRate.toFixed(3)})<br>
                            TEY = ${result.netYield.toFixed(2)}% ÷ ${(1 - result.effectiveTaxRate).toFixed(3)}
                        </div>
                        <div class="math-step__result">Tax-Equivalent Yield = <span class="math-highlight">${result.taxEquivalentYield.toFixed(2)}%</span></div>
                    </div>
                    
                    <div class="math-step" style="background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%); border-left-color: ${result.taxEquivalentYield > result.netYield ? 'var(--success-green)' : 'var(--primary-blue)'};">
                        <div class="math-step__title">📊 What This Means</div>`;
        
        if (result.effectiveTaxRate > 0) {
            explanation += `
                        <p>Because this fund has tax advantages, its ${result.netYield.toFixed(2)}% net yield is equivalent to earning 
                        <strong>${result.taxEquivalentYield.toFixed(2)}%</strong> from a fully taxable investment.</p>
                        <p><strong>Tax benefit:</strong> You're saving approximately ${((result.taxEquivalentYield - result.netYield) / result.taxEquivalentYield * 100).toFixed(1)}% through tax efficiency!</p>`;
        } else {
            explanation += `
                        <p>This fund is completely tax-free, so the full ${result.netYield.toFixed(2)}% yield is yours to keep. 
                        A fully taxable fund would need to yield ${result.taxEquivalentYield.toFixed(2)}% to match this after-tax return.</p>`;
        }
        
        if (result.grossYield > 0 && result.category === 'taxable') {
            const afterTaxYield = result.netYield * (1 - result.effectiveTaxRate);
            explanation += `
                        <p><strong>Note:</strong> As a taxable fund, your actual after-tax return would be ${afterTaxYield.toFixed(2)}%, 
                        which is why the Tax-Equivalent Yield equals the Net Yield for fully taxable investments.</p>`;
        }
        
        explanation += `
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', explanation);
        
        // Add close button event listener
        const closeBtn = document.getElementById('modal-close-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                const modal = document.getElementById('math-modal');
                if (modal) modal.remove();
            });
        }
        
        // Close on background click
        const modal = document.getElementById('math-modal');
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target.id === 'math-modal') {
                    modal.remove();
                }
            });
        }
        
        // Close on Escape key
        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                const modal = document.getElementById('math-modal');
                if (modal) {
                    modal.remove();
                    document.removeEventListener('keydown', handleEscape);
                }
            }
        };
        document.addEventListener('keydown', handleEscape);
    }

    /**
     * Escape HTML to prevent XSS
     */
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Initialize on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Public API
    return {
        init,
        getState: () => state,
        calculateAndDisplay,
        refreshData: handleRefresh
    };
})();

// Make available globally
window.App = App;
