const { useState, useEffect, useMemo, useRef } = dc;
const { TradingEngine } = await dc.require(dc.resolvePath("TRADING VIEW/src/utils/TradingEngine.js"));

/**
 * React wrapper hook around the platform-agnostic TradingEngine class.
 */
function useLeadLagEngine(getRawData, mathUtils, executeTrade, options = {}) {
    const {
        correlationThreshold = 0.85,
        minOFI = 5.0,
        updateInterval = 1000
    } = options;

    const [engineState, setEngineState] = useState({
        correlationPeak: 0,
        optimalLagIndex: 0,
        signalActive: false,
        signalDirection: null,
        ccfData: []
    });
    
    const [tradeLogs, setTradeLogs] = useState([]);

    // Instantiate engine once
    const engineRef = useRef(null);
    if (!engineRef.current) {
        engineRef.current = new TradingEngine(mathUtils, {
            correlationThreshold,
            minOFI
        });
    }

    useEffect(() => {
        const interval = setInterval(() => {
            const rawData = getRawData();
            if (!rawData) return;
            
            // Reference the React hook's sliding buffers directly to avoid duplication
            engineRef.current.data = rawData;
            
            const update = engineRef.current.checkSignalAndTrigger((direction, price, confidence, lag) => {
                const side = direction === 'LONG' ? 'buy' : 'sell';
                
                executeTrade('SOL/USD', side, 10, price).then(result => {
                    setTradeLogs(prev => {
                        const logEntry = {
                            time: new Date().toLocaleTimeString(),
                            direction,
                            price,
                            confidence: (confidence * 100).toFixed(1) + '%',
                            lag,
                            status: result.status,
                            simulated: result.simulated
                        };
                        return [logEntry, ...prev].slice(0, 50);
                    });
                });
            });

            setEngineState({
                correlationPeak: update.correlationPeak,
                optimalLagIndex: update.optimalLagIndex,
                signalActive: update.signalActive,
                signalDirection: update.signalDirection,
                ccfData: update.ccfData
            });

        }, updateInterval);

        return () => clearInterval(interval);
    }, [getRawData, mathUtils, correlationThreshold, minOFI, updateInterval, executeTrade]);

    return { engineState, tradeLogs };
}

return { useLeadLagEngine };
