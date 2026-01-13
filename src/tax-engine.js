/**
 * Tax Engine Module (Backend)
 * Server-side tax calculations - mirrors frontend logic
 */

// 2024/2025 Federal Tax Brackets
const TAX_BRACKETS_2024 = {
    single: [
        { min: 0, max: 11600, rate: 0.10 },
        { min: 11600, max: 47150, rate: 0.12 },
        { min: 47150, max: 100525, rate: 0.22 },
        { min: 100525, max: 191950, rate: 0.24 },
        { min: 191950, max: 243725, rate: 0.32 },
        { min: 243725, max: 609350, rate: 0.35 },
        { min: 609350, max: Infinity, rate: 0.37 }
    ],
    married: [
        { min: 0, max: 23200, rate: 0.10 },
        { min: 23200, max: 94300, rate: 0.12 },
        { min: 94300, max: 201050, rate: 0.22 },
        { min: 201050, max: 383900, rate: 0.24 },
        { min: 383900, max: 487450, rate: 0.32 },
        { min: 487450, max: 731200, rate: 0.35 },
        { min: 731200, max: Infinity, rate: 0.37 }
    ],
    head: [
        { min: 0, max: 16550, rate: 0.10 },
        { min: 16550, max: 63100, rate: 0.12 },
        { min: 63100, max: 100500, rate: 0.22 },
        { min: 100500, max: 191950, rate: 0.24 },
        { min: 191950, max: 243700, rate: 0.32 },
        { min: 243700, max: 609350, rate: 0.35 },
        { min: 609350, max: Infinity, rate: 0.37 }
    ]
};

// State Tax Rates
const STATE_TAX_RATES = {
    'AL': 0.050,
    'CA': 0.133,
    'CO': 0.044,
    'CT': 0.069,
    'FL': 0.000,
    'GA': 0.058,
    'IL': 0.049,
    'MA': 0.050,
    'MO': 0.047,
    'NY': 0.109,
    'NC': 0.045,
    'OH': 0.039,
    'PA': 0.031,
    'TX': 0.000,
    'VA': 0.058,
    'WA': 0.000
};

// Tax Treatment by Category
const TAX_TREATMENT = {
    taxable: {
        federalTaxable: true,
        stateTaxable: true
    },
    treasury: {
        federalTaxable: true,
        stateTaxable: false
    },
    municipal: {
        federalTaxable: false,
        stateTaxable: true
    },
    'state-municipal': {
        federalTaxable: false,
        stateTaxable: false
    }
};

/**
 * Calculate federal marginal tax rate
 */
function calculateFederalMarginalRate(income, filingStatus) {
    const brackets = TAX_BRACKETS_2024[filingStatus] || TAX_BRACKETS_2024.single;
    
    for (let i = brackets.length - 1; i >= 0; i--) {
        if (income > brackets[i].min) {
            return brackets[i].rate;
        }
    }
    
    return brackets[0].rate;
}

/**
 * Calculate state marginal tax rate
 */
function calculateStateMarginalRate(state) {
    return STATE_TAX_RATES[state] || 0;
}

/**
 * Get effective tax rate for a fund
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
            : stateRate; // municipal (federal-free) pay full state unless state-specific
        effectiveRate += statePortion;
    }
    
    return effectiveRate;
}

/**
 * Calculate tax-equivalent yield for a fund
 */
function calculateTaxEquivalentYield(fund, userProfile) {
    const { income, filingStatus, state } = userProfile;
    
    const federalRate = calculateFederalMarginalRate(income, filingStatus);
    const stateRate = calculateStateMarginalRate(state);
    
    const netYield = fund.grossYield - fund.expenseRatio;
    const effectiveTaxRate = getEffectiveTaxRate(fund.category, federalRate, stateRate);
    
    // For taxable funds: TEY = Net Yield (no tax advantage)
    // For tax-advantaged funds: TEY = Net Yield / (1 - Tax Rate)
    let taxEquivalentYield;
    if (fund.category === 'taxable') {
        // Taxable funds have no tax advantage, so TEY equals net yield
        taxEquivalentYield = netYield;
    } else {
        // Tax-advantaged funds: calculate what taxable yield would need to be
        taxEquivalentYield = effectiveTaxRate < 1 
            ? netYield / (1 - effectiveTaxRate)
            : netYield;
    }
    
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
        stateRate: stateRate
    };
}

/**
 * Calculate results for all funds
 */
function calculateAllFunds(funds, userProfile) {
    const results = funds.map(fund => 
        calculateTaxEquivalentYield(fund, userProfile)
    );
    
    results.sort((a, b) => b.taxEquivalentYield - a.taxEquivalentYield);
    
    return results;
}

/**
 * Get tax brackets
 */
function getTaxBrackets() {
    return TAX_BRACKETS_2024;
}

/**
 * Get state tax rates
 */
function getStateTaxRates() {
    return STATE_TAX_RATES;
}

module.exports = {
    calculateFederalMarginalRate,
    calculateStateMarginalRate,
    getEffectiveTaxRate,
    calculateTaxEquivalentYield,
    calculateAllFunds,
    getTaxBrackets,
    getStateTaxRates
};
