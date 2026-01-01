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
        console.log("ChartHandler.initChart called for:", canvasId);
        const ctx = document.getElementById(canvasId);
        if (!ctx) {
            console.error("Canvas element not found:", canvasId);
            return null;
        }
        if (typeof Chart === 'undefined') {
            console.error("Chart.js not loaded");
            return null;
        }

        if (yieldChart) {
            yieldChart.destroy();
            console.log("Previous chart destroyed");
        }

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
                            label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y.toFixed(2)}%`
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
        console.log("Chart initialized successfully");
        return yieldChart;
    }

    async function fetchHistoricalData(days = 30) {
        console.log("=== ChartHandler.fetchHistoricalData called ===");
        
        // Define all CSV files with their corresponding dates
        const csvFiles = [
            { filename: 'schwab_money_funds_12-22-2025.csv', date: '2025-12-22' },
            { filename: 'schwab_money_funds_12-26-2025.csv', date: '2025-12-26' },
            { filename: 'schwab_money_funds_12-31-2025.csv', date: '2025-12-31' }
        ];

        const allData = [];

        // Load each CSV file
        for (const fileInfo of csvFiles) {
            try {
                console.log(`Fetching: ${fileInfo.filename}`);
                const response = await fetch(fileInfo.filename + '?cb=' + Date.now());
                if (!response.ok) {
                    console.warn(`Could not load ${fileInfo.filename}, status: ${response.status}`);
                    continue;
                }
                
                const text = await response.text();
                const rows = window.parseCSV(text);
                console.log(`Parsed ${rows.length} rows from ${fileInfo.filename}`);
                
                // Map each row to our data structure with the correct date
                rows.forEach(row => {
                    // Use the Category column directly from CSV (it already has display names)
                    const category = row['Category'] || 'Taxable Money Funds';
                    
                    allData.push({
                        category: category,
                        fundName: row['FundName'],
                        date: fileInfo.date,
                        netYield: parseFloat((row['7DayYieldWithWaivers'] || '0').replace('%', ''))
                    });
                });
                
                console.log(`✓ Loaded ${rows.length} funds from ${fileInfo.filename} for date ${fileInfo.date}`);
            } catch (error) {
                console.error(`Error loading ${fileInfo.filename}:`, error);
            }
        }
        
        console.log(`Total data points loaded: ${allData.length}`);
        const uniqueDates = [...new Set(allData.map(d => d.date))];
        console.log(`Unique dates: ${uniqueDates.join(', ')}`);
        const uniqueCategories = [...new Set(allData.map(d => d.category))];
        console.log(`Unique categories: ${uniqueCategories.join(', ')}`);
        
        return allData;
    }

    function updateChart(historicalData) {
        console.log("=== ChartHandler.updateChart called ===");
        console.log(`Received ${historicalData.length} data points`);
        
        if (!yieldChart) {
            console.error("Chart not initialized");
            return;
        }
        
        if (!historicalData.length) {
            console.error("No historical data provided");
            return;
        }

        // 1. Identify all unique dates and categories
        const dates = [...new Set(historicalData.map(d => d.date))].sort();
        const categories = [...new Set(historicalData.map(d => d.category))];
        
        console.log(`Building chart with ${categories.length} categories across ${dates.length} dates`);
        console.log(`Dates: ${dates.join(', ')}`);
        console.log(`Categories: ${categories.join(', ')}`);

        // 2. Build datasets by calculating the average for each category on each date
        const datasets = categories.map(category => {
            const colors = CATEGORY_COLORS[category] || { border: '#666', background: 'rgba(0,0,0,0.1)' };
            
            const dataPoints = dates.map(date => {
                // Filter all funds in this category on this specific date
                const entries = historicalData.filter(d => d.category === category && d.date === date);
                if (entries.length === 0) return null;
                
                // Calculate Average
                const sum = entries.reduce((acc, curr) => acc + curr.netYield, 0);
                const avg = sum / entries.length;
                return avg;
            });

            console.log(`${category}: ${dataPoints.map(v => v !== null ? v.toFixed(2) : 'null').join(', ')}`);

            return {
                label: category,
                data: dataPoints,
                borderColor: colors.border,
                backgroundColor: colors.background,
                fill: true,
                tension: 0.3,
                pointRadius: 5,
                pointHoverRadius: 7,
                borderWidth: 2
            };
        });

        // 3. Update Chart
        yieldChart.data.labels = dates.map(d => {
            const dateObj = new Date(d);
            return dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        });
        yieldChart.data.datasets = datasets;
        yieldChart.update();
        
        console.log("✓ Chart updated successfully");
        console.log(`Chart now has ${yieldChart.data.datasets.length} datasets with ${yieldChart.data.labels.length} labels`);
    }

    return { initChart, updateChart, fetchHistoricalData };
})();

window.ChartHandler = ChartHandler;