// src/utils/math.js

function calculateMean(arr) {
    if (!arr || arr.length === 0) return 0;
    const sum = arr.reduce((acc, val) => acc + val, 0);
    return sum / arr.length;
}

function calculateStandardDeviation(arr, mean) {
    if (!arr || arr.length === 0) return 0;
    const m = mean !== undefined ? mean : calculateMean(arr);
    const variance = arr.reduce((acc, val) => acc + Math.pow(val - m, 2), 0) / arr.length;
    return Math.sqrt(variance);
}

function calculateCCF(leadReturns, lagReturns, maxLag = 5) {
    // Calculates normalized cross-correlation function at various lags
    // leadReturns and lagReturns should be arrays of the same length
    // returns an array of objects: { lag, correlation }

    const n = Math.min(leadReturns.length, lagReturns.length);
    if (n < maxLag * 2) return [];

    const leadSeries = leadReturns.slice(0, n);
    const lagSeries = lagReturns.slice(0, n);

    const muLead = calculateMean(leadSeries);
    const muLag = calculateMean(lagSeries);

    const sigmaLead = calculateStandardDeviation(leadSeries, muLead);
    const sigmaLag = calculateStandardDeviation(lagSeries, muLag);

    if (sigmaLead === 0 || sigmaLag === 0) {
        // Zero variance, correlation is undefined, return 0s
        return Array.from({ length: maxLag + 1 }, (_, i) => ({ lag: i, correlation: 0 }));
    }

    const ccf = [];
    
    // We are interested in positive lags: Lead leads Lag.
    // So Lag(t + lag) is correlated with Lead(t)
    for (let lag = 0; lag <= maxLag; lag++) {
        let sumCov = 0;
        let count = 0;
        
        for (let t = 0; t < n - lag; t++) {
            sumCov += (leadSeries[t] - muLead) * (lagSeries[t + lag] - muLag);
            count++;
        }
        
        const correlation = sumCov / (count * sigmaLead * sigmaLag);
        ccf.push({ lag, correlation });
    }

    return ccf;
}

const mathModule = {
    calculateMean,
    calculateStandardDeviation,
    calculateCCF
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = mathModule;
}

return mathModule;
