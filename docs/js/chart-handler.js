/**
 * Chart Handler Module
 * Manages Chart.js visualization for historical yield data
 */

const ChartHandler = (() => {
    let yieldChart = null;
    
    // Chart color scheme based on fund categories
    const CATEGORY_COLORS = {
        'taxable': {
            background: 'rgba(0, 102, 204, 0.2)',
            border: 'rgba(0, 102, 204, 1)',
            point: 'rgba(0, 102, 204, 0.8)'
        },
        'treasury': {
            background: 'rgba(40, 167, 69, 0.2)',
            border: 'rgba(40, 167, 69, 1)',
            point: 'rgba(40, 167, 69, 0.8)'
        },
        'municipal': {
            background: 'rgba(255, 193, 7, 0.2)',
            border: 'rgba(255, 193, 7, 1)',
            point: 'rgba(255, 193, 7, 0.8)'
        },
        'state-municipal': {
            background: 'rgba(23, 162, 184, 0.2)',
            border: 'rgba(23, 162, 184, 1)',
            point: 'rgba(23, 162, 184, 0.8)'
        }
    };

    /**
     * Initialize the chart
     * @param {string} canvasId - ID of canvas element
     */
    function initChart(canvasId) {
        const ctx = document.getElementById(canvasId);
        if (!ctx) {
            console.error('Chart canvas not found');
            return;
        }

        // Destroy existing chart if it exists
        if (yieldChart) {
            yieldChart.destroy();
        }

        yieldChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: []
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false,
                },
                plugins: {
                    legend: {
                        display: true,
                        position: 'top',
                        labels: {
                            usePointStyle: true,
                            padding: 15,
                            font: {
                                size: 12
                            }
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        padding: 12,
                        titleFont: {
                            size: 14,
                            weight: 'bold'
                        },
                        bodyFont: {
                            size: 13
                        },
                        callbacks: {
                            label: function(context) {
                                let label = context.dataset.label || '';
                                if (label) {
                                    label += ': ';
                                }
                                label += context.parsed.y.toFixed(2) + '%';
                                return label;
                            }
                        }
                    },
                    title: {
                        display: false
                    }
                },
                scales: {
                    x: {
                        display: true,
                        title: {
                            display: true,
                            text: 'Date',
                            font: {
                                size: 14,
                                weight: 'bold'
                            }
                        },
                        grid: {
                            display: false
                        }
                    },
                    y: {
                        display: true,
                        title: {
                            display: true,
                            text: 'Yield (%)',
                            font: {
                                size: 14,
                                weight: 'bold'
                            }
                        },
                        ticks: {
                            callback: function(value) {
                                return value.toFixed(2) + '%';
                            }
                        },
                        grid: {
                            color: 'rgba(0, 0, 0, 0.05)'
                        }
                    }
                }
            }
        });

        return yieldChart;
    }

    /**
     * Update chart with new data
     * @param {Array} historicalData - Array of historical data objects
     * @param {Array} selectedFunds - Array of selected fund names
     */
    function updateChart(historicalData, selectedFunds) {
        if (!yieldChart) {
            console.error('Chart not initialized');
            return;
        }

        // Extract unique dates and sort them
        const datesSet = new Set();
        historicalData.forEach(item => {
            datesSet.add(item.date);
        });
        const dates = Array.from(datesSet).sort();

        // Format dates for display
        const labels = dates.map(date => {
            const d = new Date(date);
            return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        });

        // Create datasets for each selected fund
        const datasets = selectedFunds.map(fundName => {
            // Find fund data
            const fundData = historicalData.filter(item => item.fundName === fundName);
            
            if (fundData.length === 0) return null;

            // Get category for color scheme
            const category = fundData[0].category || 'taxable';
            const colors = CATEGORY_COLORS[category] || CATEGORY_COLORS.taxable;

            // Map yields to dates
            const data = dates.map(date => {
                const entry = fundData.find(item => item.date === date);
                return entry ? entry.netYield : null;
            });

            return {
                label: fundName,
                data: data,
                borderColor: colors.border,
                backgroundColor: colors.background,
                borderWidth: 2,
                pointBackgroundColor: colors.point,
                pointBorderColor: colors.border,
                pointBorderWidth: 1,
                pointRadius: 3,
                pointHoverRadius: 5,
                tension: 0.1,
                fill: false
            };
        }).filter(dataset => dataset !== null);

        // Update chart
        yieldChart.data.labels = labels;
        yieldChart.data.datasets = datasets;
        yieldChart.update();
    }

    /**
     * Fetch historical data from API
     * @param {Array} fundNames - Array of fund names to fetch
     * @param {number} days - Number of days to fetch
     * @returns {Promise<Array>} Historical data
     */
    async function fetchHistoricalData(fundNames, days = 30) {
        try {
            const endDate = new Date();
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - days);

            const fundNamesParam = fundNames.map(name => 
                encodeURIComponent(name)
            ).join(',');

            const response = await fetch(
                `/api/history/compare?fundNames=${fundNamesParam}&startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`
            );

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Error fetching historical data:', error);
            return [];
        }
    }

    /**
     * Clear the chart
     */
    function clearChart() {
        if (yieldChart) {
            yieldChart.data.labels = [];
            yieldChart.data.datasets = [];
            yieldChart.update();
        }
    }

    /**
     * Destroy the chart
     */
    function destroyChart() {
        if (yieldChart) {
            yieldChart.destroy();
            yieldChart = null;
        }
    }

    /**
     * Export chart as image
     * @returns {string} Base64 encoded image
     */
    function exportChart() {
        if (yieldChart) {
            return yieldChart.toBase64Image();
        }
        return null;
    }

    /**
     * Get chart instance
     * @returns {Chart} Chart.js instance
     */
    function getChart() {
        return yieldChart;
    }

    // Public API
    return {
        initChart,
        updateChart,
        fetchHistoricalData,
        clearChart,
        destroyChart,
        exportChart,
        getChart
    };
})();

// Make available globally
window.ChartHandler = ChartHandler;
