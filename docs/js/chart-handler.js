/**
 * Chart Handler Module
 * Manages Chart.js visualization for category-level averages
 */
const ChartHandler = (() => {
    let yieldChart = null;
    
    // Updated colors to match categories exactly
    const CATEGORY_COLORS = {
        'Taxable Money Funds': { border: 'rgba(0, 102, 204, 1)', background: 'rgba(0, 102, 204, 0.1)' },
        'Treasury Money Funds': { border: 'rgba(40, 167, 69, 1)', background: 'rgba(40, 167, 69, 0.1)' },
        'Tax-Exempt Money Funds': { border: 'rgba(255, 159, 64, 1)', background: 'rgba(255, 159, 64, 0.1)' },
        'State-Specific': { border: 'rgba(153, 102, 255, 1)', background: 'rgba(153, 102, 255, 0.1)' }
    };

    function initChart(canvasId) {
        const ctx = document.getElementById(canvasId);
        if (!ctx || typeof Chart === 'undefined') return;

        if (yieldChart) yieldChart.destroy();

        yieldChart = new Chart(ctx, {
            type: 'line',
            data: { labels: [], datasets: [] },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { 
                    legend: { display: true, position: 'top' },
                    tooltip: {
                        callbacks: {
                            label: (ctx) => `${ctx.dataset.label} Avg: ${ctx.parsed.y.toFixed(2)}%`
                        }
                    }
                },
                scales: {
                    y: { 
                        beginAtZero: false,
                        ticks: { callback: (v) => v.toFixed(2) + '%' },
                        title: { display: true, text: 'Average 7-Day Yield' }
                    }
                }
            }
        });
        return yieldChart;
    }

    /**
     * Categorize a fund based on its name (matching app.js logic)
     */
    function categorizeFund(row) {
        const name = (row['FundName'] || '').toLowerCase();
        
        if (name.includes('treasury')) return 'Treasury Money Funds';
        
        if (name.includes('tax-exempt') || name.includes('municipal')) {
            if (name.includes('california') || name.includes('new york')) {
                return 'State-Specific';
            }
            return 'Tax-Exempt Money Funds';
        }
    
        return 'Taxable Money Funds';
    }

    /**
     * Calculate category averages from CSV data
     */
    function calculateCategoryAverages(data) {
        const categories = {
            'Taxable Money Funds': [],
            'Treasury Money Funds': [],
            'Tax-Exempt Money Funds': [],
            'State-Specific': []
        };
        
        // Filter and categorize funds (same logic as app.js)
        data.forEach(row => {
            const min = (row['MinimumInitialInvestment'] || '').toLowerCase();
            const eligible = (row['EligibleInvestors'] || '').toLowerCase();
            
            if ((min.includes('no minimum') || min === '$0') && eligible.includes('retail')) {
                const yield7Day = parseFloat((row['7DayYieldWithWaivers'] || '0').replace('%', ''));
                const category = categorizeFund(row);
                
                categories[category].push(yield7Day);
            }
        });
        
        // Calculate averages
        const averages = {};
        Object.keys(categories).forEach(cat => {
            const yields = categories[cat];
            averages[cat] = yields.length > 0 
                ? yields.reduce((sum, y) => sum + y, 0) / yields.length 
                : 0;
        });
        
        return averages;
    }

    /**
     * Fetch historical data from multiple dated CSV files
     */
    async function fetchHistoricalData(days = 30) {
        try {
            // Define your dated CSV files here (most recent first)
            const dataFiles = [
                { date: '2025-12-22', file: 'schwab_money_funds_12-22-2025.csv' },
                // Add more dated files as you collect them:
                // { date: '2025-12-15', file: 'schwab_money_funds_12-15-2025.csv' },
                // { date: '2025-12-08', file: 'schwab_money_funds_12-08-2025.csv' },
                // { date: '2025-12-01', file: 'schwab_money_funds_12-01-2025.csv' },
            ];
            
            // Filter files within the date range
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - days);
            
            const relevantFiles = dataFiles.filter(f => new Date(f.date) >= cutoffDate);
            
            // Load and process each file
            const historicalData = [];
            
            for (const fileInfo of relevantFiles) {
                const response = await fetch(fileInfo.file + '?cb=' + Date.now());
                if (!response.ok) {
                    console.warn(`Could not load ${fileInfo.file}`);
                    continue;
                }
                
                const text = await response.text();
                const data = window.parseCSV(text);
                
                // Calculate category averages for this date
                const categoryYields = calculateCategoryAverages(data);
                
                historicalData.push({
                    date: fileInfo.date,
                    ...categoryYields
                });
            }
            
            // Sort by date
            historicalData.sort((a, b) => new Date(a.date) - new Date(b.date));
            
            return historicalData;
        } catch (error) {
            console.error('Error loading historical data:', error);
            return [];
        }
    }

    /**
     * Update chart with historical data
     */
    function updateChart(historicalData) {
        if (!yieldChart || !historicalData.length) return;

        // Extract dates for labels
        const labels = historicalData.map(d => {
            const date = new Date(d.date);
            return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        });
        
        // Create datasets for each category
        const datasets = Object.keys(CATEGORY_COLORS).map(category => {
            const colors = CATEGORY_COLORS[category];
            
            return {
                label: category,
                data: historicalData.map(d => d[category] || 0),
                borderColor: colors.border,
                backgroundColor: colors.background,
                fill: true,
                tension: 0.3,
                pointRadius: 4
            };
        });

        // Update Chart
        yieldChart.data.labels = labels;
        yieldChart.data.datasets = datasets;
        yieldChart.update();
    }

    return { initChart, updateChart, fetchHistoricalData };
})();

window.ChartHandler = ChartHandler;