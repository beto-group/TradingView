class TradingEngine {
    constructor(mathUtils, options = {}) {
        this.mathUtils = mathUtils;
        this.correlationThreshold = options.correlationThreshold || 0.85;
        this.minOFI = options.minOFI || 5.0;
        this.maxWindowSize = options.maxWindowSize || 100;
        
        // Sliding windows
        this.data = {
            lead: { trades: [], orderBook: [] },
            lag: { trades: [], orderBook: [] }
        };
        
        this.optimalLagIndex = 0;
        this.ccfData = [];
        this.lastSignalTime = 0;
        this.signalCooldownMs = options.signalCooldownMs || 5000; // 5s throttle between executions
    }

    feedTrade(asset, price, qty, isBuyerMaker) {
        const now = Date.now();
        const trades = this.data[asset].trades;
        trades.push({ time: now, price, qty, isBuyerMaker });
        if (trades.length > this.maxWindowSize) {
            trades.shift();
        }
    }

    feedOrderBook(asset, bidPrice, bidQty, askPrice, askQty) {
        const now = Date.now();
        const orderBook = this.data[asset].orderBook;
        orderBook.push({ time: now, bidPrice, bidQty, askPrice, askQty });
        if (orderBook.length > this.maxWindowSize) {
            orderBook.shift();
        }
    }

    compute() {
        const leadTrades = this.data.lead.trades;
        const lagTrades = this.data.lag.trades;
        const leadBook = this.data.lead.orderBook;
        
        if (leadTrades.length < 20 || lagTrades.length < 20) {
            return {
                correlationPeak: 0,
                optimalLagIndex: 0,
                signalActive: false,
                signalDirection: null,
                ccfData: []
            };
        }

        const n = Math.min(leadTrades.length, lagTrades.length);
        const leadReturns = [];
        const lagReturns = [];
        
        for (let i = 1; i < n; i++) {
            leadReturns.push(Math.log(leadTrades[i].price / leadTrades[i-1].price));
            lagReturns.push(Math.log(lagTrades[i].price / lagTrades[i-1].price));
        }
        
        const ccf = this.mathUtils.calculateCCF(leadReturns, lagReturns, 10);
        this.ccfData = ccf;
        
        if (ccf.length === 0) {
            return {
                correlationPeak: 0,
                optimalLagIndex: 0,
                signalActive: false,
                signalDirection: null,
                ccfData: []
            };
        }

        // Find peak correlation
        let maxCorr = -1;
        let optLag = 0;
        ccf.forEach(point => {
            if (point.correlation > maxCorr) {
                maxCorr = point.correlation;
                optLag = point.lag;
            }
        });
        
        this.optimalLagIndex = optLag;

        // Calculate Lead OFI trend over last 10 order book updates
        let recentOFI = 0;
        if (leadBook.length > 10) {
            for (let i = leadBook.length - 10; i < leadBook.length; i++) {
                const prev = leadBook[i - 1];
                const curr = leadBook[i];
                let bOFI = 0, aOFI = 0;
                if (curr.bidPrice > prev.bidPrice) bOFI = curr.bidQty;
                else if (curr.bidPrice === prev.bidPrice) bOFI = curr.bidQty - prev.bidQty;
                else bOFI = -prev.bidQty;
                
                if (curr.askPrice < prev.askPrice) aOFI = curr.askQty;
                else if (curr.askPrice === prev.askPrice) aOFI = curr.askQty - prev.askQty;
                else aOFI = -prev.askQty;
                recentOFI += (bOFI - aOFI);
            }
        }

        // Signal Generation
        let signalActive = false;
        let signalDirection = null;
        
        if (maxCorr >= this.correlationThreshold && optLag > 0) {
            if (recentOFI > this.minOFI) {
                signalActive = true;
                signalDirection = 'LONG';
            } else if (recentOFI < -this.minOFI) {
                signalActive = true;
                signalDirection = 'SHORT';
            }
        }

        return {
            correlationPeak: maxCorr,
            optimalLagIndex: optLag,
            signalActive,
            signalDirection,
            ccfData: ccf,
            recentOFI
        };
    }

    checkSignalAndTrigger(onSignalCallback) {
        const update = this.compute();
        if (update.signalActive) {
            const now = Date.now();
            if (now - this.lastSignalTime > this.signalCooldownMs) {
                this.lastSignalTime = now;
                const lagTrades = this.data.lag.trades;
                const lastLagPrice = lagTrades[lagTrades.length - 1].price;
                onSignalCallback(update.signalDirection, lastLagPrice, update.correlationPeak, update.optimalLagIndex);
            }
        }
        return update;
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = TradingEngine;
}

return { TradingEngine };
