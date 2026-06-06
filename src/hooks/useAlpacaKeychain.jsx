const { useState, useEffect, useCallback } = dc;

function useAlpacaKeychain() {
    const [credentials, setCredentials] = useState({ key: null, secret: null, loaded: false });

    useEffect(() => {
        const loadKeys = async () => {
            try {
                const storage = window.app?.secretStorage || dc.app?.secretStorage;
                if (!storage) {
                    setCredentials({ key: null, secret: null, loaded: true });
                    return;
                }
                
                const key = await storage.getSecret("alpaca-paper-key");
                const secret = await storage.getSecret("alpaca-paper-secret");
                
                setCredentials({ key, secret, loaded: true });
            } catch (err) {
                console.error("Failed to load Alpaca credentials from keychain:", err);
                setCredentials({ key: null, secret: null, loaded: true });
            }
        };
        loadKeys();
    }, []);

    const saveKeys = async (key, secret) => {
        try {
            const storage = window.app?.secretStorage || dc.app?.secretStorage;
            if (storage) {
                await storage.setSecret("alpaca-paper-key", key);
                await storage.setSecret("alpaca-paper-secret", secret);
                setCredentials({ key, secret, loaded: true });
                return true;
            }
        } catch (err) {
            console.error("Failed to save keys", err);
        }
        return false;
    };

    const clearKeys = async () => {
        try {
            const storage = window.app?.secretStorage || dc.app?.secretStorage;
            if (storage) {
                // SecretStorage API might not have delete, so we can set to empty string
                await storage.setSecret("alpaca-paper-key", "");
                await storage.setSecret("alpaca-paper-secret", "");
                setCredentials({ key: null, secret: null, loaded: true });
            }
        } catch (err) {
            console.error(err);
        }
    };

    const executeTrade = useCallback(async (symbol, side, qty, price) => {
        if (!credentials.key || !credentials.secret) {
            console.warn("No Alpaca credentials found in keychain. Simulating trade locally.");
            return { simulated: true, status: 'simulated_success' };
        }

        try {
            // Artificial latency simulation (50-200ms) to prevent unrealistic paper fills
            const simulatedLatency = Math.floor(Math.random() * 150) + 50;
            await new Promise(r => setTimeout(r, simulatedLatency));

            const response = await fetch('https://paper-api.alpaca.markets/v2/orders', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'APCA-API-KEY-ID': credentials.key,
                    'APCA-API-SECRET-KEY': credentials.secret
                },
                body: JSON.stringify({
                    symbol: symbol, // e.g., 'SOL/USD'
                    qty: qty.toString(),
                    side: side.toLowerCase(), // 'buy' | 'sell'
                    type: 'limit',
                    time_in_force: 'ioc', // Immediate or Cancel for lag-chasing
                    limit_price: price.toFixed(3)
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                console.error("Alpaca Order Failed:", errorData);
                return { simulated: false, status: 'error', error: errorData.message };
            }

            const data = await response.json();
            return { simulated: false, status: 'success', orderId: data.id };

        } catch (err) {
            console.error("Alpaca Execution Error:", err);
            return { simulated: false, status: 'error', error: err.message };
        }
    }, [credentials]);

    return { credentials, saveKeys, clearKeys, executeTrade };
}

return { useAlpacaKeychain };
