/**
 * Chart Handler Module
 * Manages Chart.js visualization for category-level averages
 */
const ChartHandler = (() => {
    let yieldChart = null;
    
    // Colors matching the HTML legend (bottom of page)
    const CATEGORY_COLORS = {
        'Taxable Money Funds': { 
            border: '#0066cc', 
            background: 'rgba(0, 102, 204, 0.1)',
            description: 'Taxable - Subject to all taxes'
        },
        'Treasury Money Funds': { 
            border: '#28a745', 
            background: 'rgba(40, 167, 69, 0.1)',
            description: 'Treasury - State tax-free'
        },
        'Tax-Exempt Money Funds': { 
            border: '#ffc107', 
            background: 'rgba(255, 193, 7, 0.1)',
            description: 'Municipal - Federal tax-free'
        },
        'State-Specific': { 
            border: '#17a2b8', 
            background: 'rgba(23, 162, 184, 0.1)',
            description: 'State Municipal - Both tax-free (residents only)'
        }
    };

    function initChart(canvasId) {
        const ctx = document.getElementById(canvasId);
        if (!ctx || typeof Chart === 'undefined') {
            console.error('Chart.js not loaded or canvas not found');
            return null;
        }

        if (yieldChart) yieldChart.destroy();

        yieldChart = new Chart(ctx, {
            type: 'line',
            data: { labels: [], datasets: [] },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { 
                    legend: { 
                        display: true, 
                        position: 'top',
                        labels: {
                            usePointStyle: true,
                            pointStyle: 'circle',
                            padding: 15,
                            font: {
                                size: 12
                            },
                            generateLabels: (chart) => {
                                const datasets = chart.data.datasets;
                                return datasets.map((dataset, i) => ({
                                    text: dataset.label,
                                    fillStyle: dataset.borderColor,
                                    strokeStyle: dataset.borderColor,
                                    lineWidth: 2,
                                    hidden: !chart.isDatasetVisible(i),
                                    index: i,
                                    pointStyle: 'circle'
                                }));
                            }
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y.toFixed(2)}%`
                        }
                    }
                },
                scales: {
                    y: { 
                        beginAtZero: false,
                        ticks: { 
                            callback: (v) => v.toFixed(2) + '%'
                        },
                        title: { 
                            display: true, 
                            text: 'Average 7-Day Yield' 
                        }
                    },
                    x: {
                        title: {
                            display: false
                        }
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
                
                if (!isNaN(yield7Day) && yield7Day > 0) {
                    const category = categorizeFund(row);
                    categories[category].push(yield7Day);
                }
            }
        });
        
        // Calculate averages and log for debugging
        const averages = {};
        Object.keys(categories).forEach(cat => {
            const yields = categories[cat];
            averages[cat] = yields.length > 0 
                ? yields.reduce((sum, y) => sum + y, 0) / yields.length 
                : 0;
        });
        
        console.log('Category counts:', Object.keys(categories).map(k => `${k}: ${categories[k].length}`));
        console.log('Category averages:', averages);
        
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
                { date: '2025-12-26', file: 'schwab_money_funds_12-26-2025.csv' },
                { date: '2025-12-31', file: 'schwab_money_funds_12-31-2025.csv' },
                // { date: '2025-12-01', file: 'schwab_money_funds_12-01-2025.csv' },
            ];
            
            // Filter files within the date range
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - days);
            
            const relevantFiles = dataFiles.filter(f => new Date(f.date) >= cutoffDate);
            
            if (relevantFiles.length === 0) {
                console.warn('No relevant CSV files found for date range');
                return [];
            }
            
            // Load and process each file
            const historicalData = [];
            
            for (const fileInfo of relevantFiles) {
                try {
                    const response = await fetch(fileInfo.file + '?cb=' + Date.now());
                    if (!response.ok) {
                        console.warn(`Could not load ${fileInfo.file}: ${response.status}`);
                        continue;
                    }
                    
                    const text = await response.text();
                    const data = window.parseCSV(text);
                    
                    console.log(`Loaded ${data.length} rows from ${fileInfo.file}`);
                    
                    // Calculate category averages for this date
                    const categoryYields = calculateCategoryAverages(data);
                    
                    historicalData.push({
                        date: fileInfo.date,
                        ...categoryYields
                    });
                } catch (fileError) {
                    console.error(`Error processing ${fileInfo.file}:`, fileError);
                }
            }
            
            // Sort by date
            historicalData.sort((a, b) => new Date(a.date) - new Date(b.date));
            
            console.log('Historical data loaded:', historicalData);
            
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
        if (!yieldChart) {
            console.error('Chart not initialized');
            return;
        }
        
        if (!historicalData || historicalData.length === 0) {
            console.warn('No historical data to display');
            return;
        }

        // Extract dates for labels
        const labels = historicalData.map(d => {
            const date = new Date(d.date);
            return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        });
        
        // Create datasets for each category with correct colors
        const datasets = [];
        
        Object.keys(CATEGORY_COLORS).forEach(category => {
            const colors = CATEGORY_COLORS[category];
            const dataPoints = historicalData.map(d => d[category] || 0);
            
            // Only add dataset if it has non-zero values
            if (dataPoints.some(val => val > 0)) {
                datasets.push({
                    label: category,
                    data: dataPoints,
                    borderColor: colors.border,
                    backgroundColor: colors.background,
                    pointBackgroundColor: colors.border,
                    pointBorderColor: colors.border,
                    pointHoverBackgroundColor: colors.border,
                    pointHoverBorderColor: '#fff',
                    fill: true,
                    tension: 0.3,
                    pointRadius: 5,
                    pointHoverRadius: 7,
                    borderWidth: 2
                });
            }
        });

        console.log('Updating chart with datasets:', datasets.length);
        
        // Update Chart
        yieldChart.data.labels = labels;
        yieldChart.data.datasets = datasets;
        yieldChart.update();
    }

    return { initChart, updateChart, fetchHistoricalData };
})();

window.ChartHandler = ChartHandler;