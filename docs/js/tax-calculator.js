/**
 * Tax Calculator Module
 * Calculates federal and state taxes, and tax-equivalent yields
 */
const TaxCalculator = (() => {
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
        ]
    };

    // State Tax Rates
    const STATE_TAX_RATES = {
        'MO': 0.048, 'CA': 0.133, 'NY': 0.088, 'FL': 0.000, 'TX': 0.000, 'WA': 0.000
    };

    // Corrected Keys to match app.js
    const TAX_TREATMENT = {
        'Taxable Money Funds': {
            federalTaxable: true,
            stateTaxable: true,
            description: 'Subject to both Federal and State income tax'
        },
        'Treasury Money Funds': {
            federalTaxable: true,
            stateTaxable: false,
            description: 'Subject to Federal tax, but exempt from State income tax'
        },
        'Tax-Exempt Money Funds': {
            federalTaxable: false,
            stateTaxable: true,
            description: 'Exempt from Federal tax, but subject to State income tax'
        },
        'State-Specific': {
            federalTaxable: false,
            stateTaxable: false,
            description: 'Exempt from both Federal and State income tax'
        }
    };

    function calculateFederalMarginalRate(income, filingStatus) {
        const brackets = TAX_BRACKETS_2024[filingStatus] || TAX_BRACKETS_2024.single;
        for (let i = brackets.length - 1; i >= 0; i--) {
            if (income >= brackets[i].min) return brackets[i].rate;
        }
        return brackets[0].rate;
    }

    function calculateStateMarginalRate(state) {
        return STATE_TAX_RATES[state] || 0;
    }

    function calculateTaxEquivalentYield(fund, profile) {
        const federalRate = calculateFederalMarginalRate(profile.income, profile.filingStatus);
        const stateRate = calculateStateMarginalRate(profile.state);
        
        // Safety fallback for category lookup
        const treatment = TAX_TREATMENT[fund.category] || TAX_TREATMENT['Taxable Money Funds'];
        
        let effectiveTaxRate = 0;
        if (treatment.federalTaxable) effectiveTaxRate += federalRate;
        if (treatment.stateTaxable) effectiveTaxRate += stateRate * (1 - federalRate);

        const netYield = fund.grossYield; // Simplified for calculation
        const tey = netYield / (1 - effectiveTaxRate);

        return {
            ...fund,
            netYield: netYield,
            taxEquivalentYield: tey,
            annualReturn: 10000 * (tey / 100)
        };
    }

    function calculateAllFunds(funds, profile) {
        return funds.map(f => calculateTaxEquivalentYield(f, profile))
                    .sort((a, b) => b.taxEquivalentYield - a.taxEquivalentYield);
    }

    /**
     * Get recommendation explanation
     * @param {Object} topFund - Top recommended fund result
     * @param {Object} userProfile - User's tax profile
     * @returns {string} Explanation text
     */
    function getRecommendationExplanation(topFund, userProfile) {
        // Use consistent names from the fund object and pull state from userProfile
        const { category, effectiveTaxRate, netYield, taxEquivalentYield } = topFund;
        const { state } = userProfile;
        
        // CRITICAL FIX: Fallback to 'taxable' if category is missing or mismatched
        const treatment = TAX_TREATMENT[category] || TAX_TREATMENT.taxable;
        
        const taxSavings = ((taxEquivalentYield - netYield) / taxEquivalentYield * 100).toFixed(1);
        const displayCategory = category.replace('-', ' ');
        
        let explanation = `This ${displayCategory} fund offers the best after-tax return for a resident of ${state}. `;
        
        if (effectiveTaxRate > 0) {
            // Use treatment.description safely
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
    // /**
    //  * Get recommendation explanation
    //  * @param {Object} topFund - Top recommended fund
    //  * @param {Object} userProfile - User's tax profile
    //  * @returns {string} Explanation text
    //  */
    // function getRecommendationExplanation(topFund, userProfile) {
    //     // Destructure properties from topFund for consistent naming
    //     const { category, effectiveTaxRate, netYield, taxEquivalentYield } = topFund;
    //     const { state } = userProfile; // Utilizing userProfile to fix the unused variable
        
    //     // Fallback to 'taxable' if category is missing or mismatched to prevent crashes
    //     const treatment = TAX_TREATMENT[category] || TAX_TREATMENT.taxable;
        
    //     // Create a user-friendly category name (e.g., "state-municipal" becomes "state municipal")
    //     const displayCategory = category.replace('-', ' ');
        
    //     let explanation = `This ${displayCategory} fund offers the best after-tax return for a resident of ${state}. `;
        
    //     // Use the description defined in the TAX_TREATMENT mapping
    //     explanation += `${treatment.description}. `;

    //     if (taxEquivalentYield > netYield) {
    //         // Calculate the percentage of yield that is "saved" from taxes
    //         const taxSavingsPct = ((taxEquivalentYield - netYield) / taxEquivalentYield * 100).toFixed(1);
            
    //         explanation += `At your ${(effectiveTaxRate * 100).toFixed(1)}% effective tax rate, `;
    //         explanation += `this fund's ${netYield.toFixed(2)}% yield is equivalent to a ${taxEquivalentYield.toFixed(2)}% yield from a fully taxable investment. `;
            
    //         if (taxSavingsPct > 0) {
    //             explanation += `This represents approximately ${taxSavingsPct}% in tax efficiency.`;
    //         }
    //     } else {
    //         explanation += `Providing a full ${netYield.toFixed(2)}% yield with no additional tax impact for your bracket.`;
    //     }
        
    //     return explanation;
    // }    

    return {
        calculateFederalMarginalRate,
        calculateStateMarginalRate,
        calculateAllFunds,
        getRecommendationExplanation,
        formatPercent: (v) => `${v.toFixed(2)}%`,
        formatCurrency: (v) => `$${v.toLocaleString(undefined, {minimumFractionDigits: 2})}`
    };
})();
window.TaxCalculator = TaxCalculator;