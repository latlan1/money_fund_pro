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

    async function fetchHistoricalData(days = 30) {
        const filename = 'schwab_money_funds_12-22-2025.csv';
        try {
            const response = await fetch(filename + '?cb=' + Date.now());
            if (!response.ok) return [];
            
            const text = await response.text();
            const allRows = window.parseCSV(text);
            
            // Return all data so we can calculate averages across the whole category
            return allRows.map(row => ({
                category: row['Category'] || 'Taxable Money Funds',
                fundName: row['FundName'],
                date: row['Date'] || new Date().toISOString().split('T')[0],
                netYield: parseFloat((row['7DayYieldWithWaivers'] || '0').replace('%', ''))
            }));
        } catch (error) {
            console.error('Error loading data for chart:', error);
            return [];
        }
    }

    function updateChart(historicalData) {
        if (!yieldChart || !historicalData.length) return;

        // 1. Identify all unique dates and categories
        const dates = [...new Set(historicalData.map(d => d.date))].sort();
        const categories = [...new Set(historicalData.map(d => d.category))];

        // 2. Build datasets by calculating the average for each category on each date
        const datasets = categories.map(category => {
            const colors = CATEGORY_COLORS[category] || { border: '#666', background: 'rgba(0,0,0,0.1)' };
            
            const dataPoints = dates.map(date => {
                // Filter all funds in this category on this specific date
                const entries = historicalData.filter(d => d.category === category && d.date === date);
                if (entries.length === 0) return null;
                
                // Calculate Average
                const sum = entries.reduce((acc, curr) => acc + curr.netYield, 0);
                return sum / entries.length;
            });

            return {
                label: category,
                data: dataPoints,
                borderColor: colors.border,
                backgroundColor: colors.background,
                fill: true,
                tension: 0.3,
                pointRadius: 4
            };
        });

        // 3. Update Chart
        yieldChart.data.labels = dates.map(d => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
        yieldChart.data.datasets = datasets;
        yieldChart.update();
    }

    return { initChart, updateChart, fetchHistoricalData };
})();

window.ChartHandler = ChartHandler;