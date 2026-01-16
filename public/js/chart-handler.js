/**
 * Chart Handler Module
 * Manages Chart.js visualization for Fund Category-level averages
 */
const ChartHandler = (() => {
  let yieldChart = null;

  // Colors matching the Fund Categories (tax treatment)
  const CATEGORY_COLORS = {
    "Taxable - Subject to all taxes": {
      border: "#0066cc",
      background: "rgba(0, 102, 204, 0.1)",
    },
    "Treasury - State tax-free": {
      border: "#28a745",
      background: "rgba(40, 167, 69, 0.1)",
    },
    "Municipal - Federal tax-free": {
      border: "#ffc107",
      background: "rgba(255, 193, 7, 0.1)",
    },
    "State Municipal - Both tax-free (residents only)": {
      border: "#17a2b8",
      background: "rgba(23, 162, 184, 0.1)",
    },
  };

  function initChart(canvasId) {
    console.log("ChartHandler.initChart called for:", canvasId);
    const ctx = document.getElementById(canvasId);
    if (!ctx) {
      console.error("Canvas element not found:", canvasId);
      return null;
    }
    if (typeof Chart === "undefined") {
      console.error("Chart.js not loaded");
      return null;
    }

    if (yieldChart) {
      yieldChart.destroy();
      console.log("Previous chart destroyed");
    }

    yieldChart = new Chart(ctx, {
      type: "line",
      data: { labels: [], datasets: [] },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }, // Use HTML legend instead
          tooltip: {
            callbacks: {
              label: (ctx) =>
                `${ctx.dataset.label}: ${ctx.parsed.y.toFixed(2)}%`,
            },
          },
        },
        scales: {
          y: {
            beginAtZero: false,
            ticks: { callback: (v) => v.toFixed(2) + "%" },
            title: { display: true, text: "Average 7-Day Yield" },
          },
        },
      },
    });
    console.log("Chart initialized successfully");
    return yieldChart;
  }

  async function fetchHistoricalData(days = 0) {
    console.log(
      `=== ChartHandler.fetchHistoricalData called (days=${days}) ===`,
    );

    // Fetch manifest of available CSV snapshots
    let csvFiles = [];

    // Try server API first (for local dev)
    try {
      const res = await fetch("/api/csv-files?cb=" + Date.now());
      if (res.ok) {
        csvFiles = await res.json();
      }
    } catch (_) {}

    // Fallback to static manifest file (for GitHub Pages)
    if (!csvFiles.length) {
      try {
        const res = await fetch("csv-manifest.json?cb=" + Date.now());
        if (res.ok) {
          csvFiles = await res.json();
        }
      } catch (_) {}
    }

    if (!csvFiles.length) {
      console.warn("No CSV files available");
      return [];
    }

    // Filter CSV files by date range if days > 0
    let filteredFiles = csvFiles;
    if (days > 0) {
      const now = new Date();
      const cutoffDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
      console.log(
        `Filtering to last ${days} days (cutoff: ${cutoffDate.toISOString()})`,
      );

      filteredFiles = csvFiles.filter((fileInfo) => {
        const fileDate = DataUtils.parseDateMMDDYYYY(fileInfo.date);
        return fileDate >= cutoffDate;
      });

      console.log(
        `Filtered from ${csvFiles.length} to ${filteredFiles.length} files`,
      );
    }

    if (!filteredFiles.length) {
      console.warn("No CSV files within date range");
      return [];
    }

    const allData = [];

    // Load each CSV file
    for (const fileInfo of filteredFiles) {
      try {
        console.log(`Fetching: ${fileInfo.name}`);
        const response = await fetch(fileInfo.name + "?cb=" + Date.now());
        if (!response.ok) {
          console.warn(
            `Could not load ${fileInfo.name}, status: ${response.status}`,
          );
          continue;
        }

        const text = await response.text();
        const rows = DataUtils.parseCSV(text);
        console.log(`Parsed ${rows.length} rows from ${fileInfo.name}`);

        // Use shared utility to transform rows for chart
        const points = DataUtils.transformRowsForChart(rows, fileInfo.date);
        allData.push(...points);

        console.log(
          `✓ Loaded ${rows.length} funds from ${fileInfo.name} for date ${fileInfo.date}`,
        );
      } catch (error) {
        console.error(`Error loading ${fileInfo.name}:`, error);
      }
    }

    console.log(`Total data points loaded: ${allData.length}`);
    const uniqueDates = [...new Set(allData.map((d) => d.date))];
    console.log(`Unique dates: ${uniqueDates.join(", ")}`);
    const uniqueCategories = [...new Set(allData.map((d) => d.category))];
    console.log(`Unique categories: ${uniqueCategories.join(", ")}`);

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

    // Use shared utility for aggregating chart data
    const aggregated = DataUtils.aggregateChartData(historicalData);
    const { dates, categoryAverages } = aggregated;
    const categories = Object.keys(categoryAverages);

    console.log(
      `Building chart with ${categories.length} categories across ${dates.length} dates`,
    );
    console.log(`Dates: ${dates.join(", ")}`);
    console.log(`Categories: ${categories.join(", ")}`);

    // 2. Build datasets from aggregated data
    const datasets = categories.map((category) => {
      const colors = CATEGORY_COLORS[category] || {
        border: "#666",
        background: "rgba(0,0,0,0.1)",
      };

      const dataPoints = categoryAverages[category];

      console.log(
        `${category}: ${dataPoints.map((v) => (v !== null ? v.toFixed(2) : "null")).join(", ")}`,
      );

      return {
        label: category,
        data: dataPoints,
        borderColor: colors.border,
        backgroundColor: colors.background,
        fill: false,
        tension: 0.3,
        pointRadius: 5,
        pointHoverRadius: 7,
        borderWidth: 2,
      };
    });

    // 3. Update Chart
    yieldChart.data.labels = dates.map((d) => {
      const dateObj = DataUtils.parseDateMMDDYYYY(d);
      return dateObj.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
    });
    yieldChart.data.datasets = datasets;
    yieldChart.update();

    console.log("✓ Chart updated successfully");
    console.log(
      `Chart now has ${yieldChart.data.datasets.length} datasets with ${yieldChart.data.labels.length} labels`,
    );
  }

  return { initChart, updateChart, fetchHistoricalData };
})();

window.ChartHandler = ChartHandler;
