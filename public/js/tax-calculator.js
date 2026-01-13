/**
 * Tax Calculator Module
 * Calculates federal and state taxes, and tax-equivalent yields
 */

const TaxCalculator = (() => {
  // 2024/2025 Federal Tax Brackets
  const TAX_BRACKETS_2024 = {
    single: [
      { min: 0, max: 11600, rate: 0.1 },
      { min: 11600, max: 47150, rate: 0.12 },
      { min: 47150, max: 100525, rate: 0.22 },
      { min: 100525, max: 191950, rate: 0.24 },
      { min: 191950, max: 243725, rate: 0.32 },
      { min: 243725, max: 609350, rate: 0.35 },
      { min: 609350, max: Infinity, rate: 0.37 },
    ],
    married: [
      { min: 0, max: 23200, rate: 0.1 },
      { min: 23200, max: 94300, rate: 0.12 },
      { min: 94300, max: 201050, rate: 0.22 },
      { min: 201050, max: 383900, rate: 0.24 },
      { min: 383900, max: 487450, rate: 0.32 },
      { min: 487450, max: 731200, rate: 0.35 },
      { min: 731200, max: Infinity, rate: 0.37 },
    ],
    head: [
      { min: 0, max: 16550, rate: 0.1 },
      { min: 16550, max: 63100, rate: 0.12 },
      { min: 63100, max: 100500, rate: 0.22 },
      { min: 100500, max: 191950, rate: 0.24 },
      { min: 191950, max: 243700, rate: 0.32 },
      { min: 243700, max: 609350, rate: 0.35 },
      { min: 609350, max: Infinity, rate: 0.37 },
    ],
  };

  // State Tax Rates (top marginal rates for simplicity)
  const STATE_TAX_RATES = {
    AL: 0.05, // Alabama
    CA: 0.133, // California
    CO: 0.044, // Colorado (flat)
    CT: 0.069, // Connecticut
    FL: 0.0, // Florida (no state income tax)
    GA: 0.058, // Georgia
    IL: 0.049, // Illinois (flat)
    MA: 0.05, // Massachusetts (flat)
    MO: 0.047, // Missouri (2025 top marginal rate)
    NY: 0.109, // New York
    NC: 0.045, // North Carolina (flat)
    OH: 0.039, // Ohio
    PA: 0.031, // Pennsylvania (flat)
    TX: 0.0, // Texas (no state income tax)
    VA: 0.058, // Virginia
    WA: 0.0, // Washington (no state income tax)
  };

  // Fund category tax treatment
  const TAX_TREATMENT = {
    taxable: {
      federalTaxable: true,
      stateTaxable: true,
      description: "Fully taxable at both federal and state levels",
    },
    treasury: {
      federalTaxable: true,
      stateTaxable: false,
      description: "Federal taxable, but state tax-free",
    },
    municipal: {
      federalTaxable: false,
      stateTaxable: true,
      description: "Federal tax-free, may be state taxable",
    },
    "state-municipal": {
      federalTaxable: false,
      stateTaxable: false,
      description: "Tax-free at both levels (for residents only)",
    },
    sweep: {
      federalTaxable: true,
      stateTaxable: true,
      description: "Fully taxable sweep fund for automatic cash management",
    },
    etf: {
      federalTaxable: true,
      stateTaxable: true,
      description: "Fully taxable ETF with exchange-traded flexibility",
    },
  };

  /**
   * Calculate federal marginal tax rate
   * @param {number} income - Annual taxable income
   * @param {string} filingStatus - 'single', 'married', or 'head'
   * @returns {number} Marginal tax rate (decimal)
   */
  function calculateFederalMarginalRate(income, filingStatus) {
    const brackets =
      TAX_BRACKETS_2024[filingStatus] || TAX_BRACKETS_2024.single;

    for (let i = brackets.length - 1; i >= 0; i--) {
      if (income > brackets[i].min) {
        return brackets[i].rate;
      }
    }

    return brackets[0].rate;
  }

  /**
   * Calculate state marginal tax rate
   * @param {string} state - State abbreviation
   * @returns {number} State tax rate (decimal)
   */
  function calculateStateMarginalRate(state) {
    return STATE_TAX_RATES[state] || 0;
  }

  /**
   * Get effective tax rate for a fund based on category
   * @param {string} category - Fund category
   * @param {number} federalRate - Federal marginal rate
   * @param {number} stateRate - State marginal rate
   * @returns {number} Effective tax rate (decimal)
   */
  function getEffectiveTaxRate(category, federalRate, stateRate) {
    const treatment = TAX_TREATMENT[category] || TAX_TREATMENT.taxable;

    let effectiveRate = 0;

    if (treatment.federalTaxable) {
      effectiveRate += federalRate;
    }

    if (treatment.stateTaxable) {
      // Taxable funds: deduct state tax by federal rate
      // Treasury funds: no state tax
      // Municipal funds: state tax applies in full (no federal deduct)
      // State-municipal: no state tax
      const statePortion = treatment.federalTaxable
        ? stateRate * (1 - federalRate) // taxable funds
        : stateRate; // municipal (federal-free) still pay full state unless state-specific
      effectiveRate += statePortion;
    }

    return effectiveRate;
  }

  /**
   * Calculate tax-equivalent yield for a fund
   * @param {Object} fund - Fund object with grossYield, expenseRatio, category
   * @param {Object} userProfile - User's tax profile
   * @returns {Object} Calculated yields and tax info
   */
  function calculateTaxEquivalentYield(fund, userProfile) {
    const { income, filingStatus, state } = userProfile;

    // Calculate marginal rates
    const federalRate = calculateFederalMarginalRate(income, filingStatus);
    const stateRate = calculateStateMarginalRate(state);

    // Calculate net yield (after expense ratio)
    const netYield = fund.grossYield - fund.expenseRatio;

    // Determine effective tax rate based on fund category
    const effectiveTaxRate = getEffectiveTaxRate(
      fund.category,
      federalRate,
      stateRate,
    );

    // Calculate tax-equivalent yield
    // For taxable funds (including sweep and etf): TEY = Net Yield (no tax advantage)
    // For tax-advantaged funds: TEY = Net Yield / (1 - Tax Rate)
    let taxEquivalentYield;
    const taxableCategories = ["taxable", "sweep", "etf"];
    if (taxableCategories.includes(fund.category)) {
      // Taxable funds have no tax advantage, so TEY equals net yield
      taxEquivalentYield = netYield;
    } else {
      // Tax-advantaged funds: calculate what taxable yield would need to be
      taxEquivalentYield =
        effectiveTaxRate < 1 ? netYield / (1 - effectiveTaxRate) : netYield;
    }

    // Calculate annual return on $10,000
    const annualReturn = 10000 * (taxEquivalentYield / 100);

    return {
      fundName: fund.fundName,
      symbol: fund.symbol,
      category: fund.category,
      grossYield: fund.grossYield,
      expenseRatio: fund.expenseRatio,
      netYield: netYield,
      effectiveTaxRate: effectiveTaxRate,
      taxEquivalentYield: taxEquivalentYield,
      annualReturn: annualReturn,
      federalRate: federalRate,
      stateRate: stateRate,
    };
  }

  /**
   * Calculate results for all funds
   * @param {Array} funds - Array of fund objects
   * @param {Object} userProfile - User's tax profile
   * @returns {Array} Sorted array of calculated results
   */
  function calculateAllFunds(funds, userProfile) {
    const results = funds.map((fund) =>
      calculateTaxEquivalentYield(fund, userProfile),
    );

    // Sort by tax-equivalent yield (descending)
    results.sort((a, b) => b.taxEquivalentYield - a.taxEquivalentYield);

    return results;
  }

  /**
   * Get recommendation explanation
   * @param {Object} topFund - Top recommended fund
   * @param {Object} userProfile - User's tax profile
   * @returns {string} Explanation text
   */
  function getRecommendationExplanation(topFund, userProfile) {
    const { category, effectiveTaxRate, netYield, taxEquivalentYield } =
      topFund;
    const treatment = TAX_TREATMENT[category];

    const taxSavings = (
      ((taxEquivalentYield - netYield) / taxEquivalentYield) *
      100
    ).toFixed(1);

    let explanation = `This ${category.replace("-", " ")} fund offers the best after-tax return for your situation. `;

    if (effectiveTaxRate > 0) {
      explanation += `${treatment.description}. At your ${(effectiveTaxRate * 100).toFixed(1)}% effective tax rate, `;
      explanation += `this fund's ${netYield.toFixed(2)}% yield is equivalent to a ${taxEquivalentYield.toFixed(2)}% yield from a fully taxable investment. `;

      if (taxSavings > 0) {
        explanation += `This represents approximately ${taxSavings}% in tax efficiency.`;
      }
    } else {
      explanation += `${treatment.description}, providing the full ${netYield.toFixed(2)}% yield without tax impact.`;
    }

    return explanation;
  }

  /**
   * Format percentage for display
   * @param {number} value - Decimal value
   * @param {number} decimals - Number of decimal places
   * @returns {string} Formatted percentage
   */
  function formatPercent(value, decimals = 2) {
    return `${value.toFixed(decimals)}%`;
  }

  /**
   * Format currency for display
   * @param {number} value - Dollar amount
   * @returns {string} Formatted currency
   */
  function formatCurrency(value) {
    return `$${value.toFixed(2)}`;
  }

  // Public API
  return {
    calculateFederalMarginalRate,
    calculateStateMarginalRate,
    getEffectiveTaxRate,
    calculateTaxEquivalentYield,
    calculateAllFunds,
    getRecommendationExplanation,
    formatPercent,
    formatCurrency,
    getTaxBrackets: () => TAX_BRACKETS_2024,
    getStateTaxRates: () => STATE_TAX_RATES,
    getTaxTreatment: () => TAX_TREATMENT,
  };
})();

// Make available globally
window.TaxCalculator = TaxCalculator;
