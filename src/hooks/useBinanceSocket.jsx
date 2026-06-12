/* eslint-disable obsidianmd/rule-custom-message */
const { useState, useEffect, useRef, useCallback } = dc;

/**
 * Custom hook to manage Binance WebSocket connections for Lead/Lag assets.
 * Keeps an in-memory sliding window of tick data to maintain $0 operating budget.
 */
function useBinanceSocket(leadSymbol = 'btcusdt', lagSymbol = 'solusdt', maxWindowSize = 100, folderPath) {
    const [status, setStatus] = useState('Disconnected');
    const [activeHost, setActiveHost] = useState('stream.binance.com');
    
    // Electron/Node runtime checks to bypass browser CORS and sandboxing
    const https = window.require ? window.require('https') : null;
    const path = window.require ? window.require('path') : null;
    const fs = window.require ? window.require('fs') : null;

    const activeFolderPath = folderPath || "_RESOURCES/DATACORE/_DONE/TradingView";

    let WebSocketNode = null;
    if (window.require && path && fs) {
        try {
            const vaultPath = window.app.vault.adapter.getBasePath();
            const resolvedPath = dc.resolvePath(activeFolderPath + "/src/server.js");
            const workingDir = path.dirname(path.join(vaultPath, resolvedPath));
            const wsModulePath = path.join(workingDir, 'node_modules', 'ws');
            if (fs.existsSync(wsModulePath)) {
                WebSocketNode = window.require(wsModulePath);
            }
        } catch (e) {
            console.error("Failed to load Node ws module:", e);
        }
    }
    
    const fetchJson = (url) => {
        if (!https) {
            return window.fetch(url).then(res => {
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                return res.json();
            });
        }
        return new Promise((resolve, reject) => {
            https.get(url, (res) => {
                let body = '';
                res.on('data', chunk => body += chunk);
                res.on('end', () => {
                    try {
                        if (res.statusCode >= 200 && res.statusCode < 300) {
                            resolve(JSON.parse(body));
                        } else {
                            reject(new Error(`HTTP ${res.statusCode}: ${body}`));
                        }
                    } catch (e) {
                        reject(e);
                    }
                });
            }).on('error', reject);
        });
    };

    // In-memory ring buffers
    const dataRef = useRef({
        lead: { trades: [], orderBook: [] },
        lag: { trades: [], orderBook: [] }
    });
    
    const [snapshot, setSnapshot] = useState({
        leadPrice: 0, lagPrice: 0, 
        leadOFI: 0, lagSpread: 0
    });

    useEffect(() => {
        let ws;
        let isClosed = false;
        let receivedMessage = false;
        let currentHost = 'stream.binance.com:9443';
        
        const adapter = window.app?.vault?.adapter;
        const cachePath = dc.resolvePath ? dc.resolvePath(activeFolderPath + "/data/trades_cache.json") : null;

        const writeCache = async () => {
            if (adapter && cachePath && dataRef.current) {
                try {
                    // Auto-create parent directory if missing
                    const parentPath = cachePath.replace(/\\/g, '/');
                    const lastSlash = parentPath.lastIndexOf('/');
                    if (lastSlash !== -1) {
                        const dir = parentPath.substring(0, lastSlash);
                        const dirExists = await adapter.exists(dir);
                        if (!dirExists) {
                            await adapter.mkdir(dir);
                        }
                    }
                    const cacheObj = {
                        timestamp: Date.now(),
                        leadSymbol,
                        lagSymbol,
                        data: dataRef.current
                    };
                    await adapter.write(cachePath, JSON.stringify(cacheObj, null, 2));
                } catch (e) {
                    console.error("Failed to write trades cache file:", e);
                }
            }
        };

        const connect = async () => {
            if (isClosed) return;
            
            setActiveHost(currentHost);
            setStatus('Connecting');
            
            const hostLeadSymbol = currentHost.includes('binance.us') ? leadSymbol.replace('usdt', 'usd') : leadSymbol;
            const hostLagSymbol = currentHost.includes('binance.us') ? lagSymbol.replace('usdt', 'usd') : lagSymbol;

            // 1. Try to load from local Vault Cache first
            let cacheLoaded = false;
            if (adapter && cachePath) {
                try {
                    const cacheExists = await adapter.exists(cachePath);
                    if (cacheExists) {
                        const cacheContent = await adapter.read(cachePath);
                        const parsedCache = JSON.parse(cacheContent);
                        const ageMs = Date.now() - parsedCache.timestamp;
                        // Keep cache if it's within 2 hours and symbols match
                        if (ageMs < 2 * 60 * 60 * 1000 && 
                            parsedCache.leadSymbol === leadSymbol && 
                            parsedCache.lagSymbol === lagSymbol && 
                            parsedCache.data) {
                            
                            dataRef.current = parsedCache.data;
                            cacheLoaded = true;
                            console.log("Loaded historical trades from local JSON cache.");
                        }
                    }
                } catch (e) {
                    console.warn("Failed to read trades cache:", e);
                }
            }

            if (!cacheLoaded) {
                // Fetch historical trades for instant initialization (Non-blocking)
                const apiHost = currentHost.includes('binance.us') ? 'api.binance.us' : 'api.binance.com';
                const limit = maxWindowSize;
                
                Promise.all([
                    fetchJson(`https://${apiHost}/api/v3/trades?symbol=${hostLeadSymbol.toUpperCase()}&limit=${limit}`),
                    fetchJson(`https://${apiHost}/api/v3/trades?symbol=${hostLagSymbol.toUpperCase()}&limit=${limit}`)
                ]).then(([leadData, lagData]) => {
                    if (leadData && lagData && !receivedMessage) {
                        dataRef.current.lead.trades = leadData.map(t => ({
                            time: t.time,
                            price: parseFloat(t.price),
                            qty: parseFloat(t.qty),
                            isBuyerMaker: t.isBuyerMaker
                        }));
                        
                        dataRef.current.lag.trades = lagData.map(t => ({
                            time: t.time,
                            price: parseFloat(t.price),
                            qty: parseFloat(t.qty),
                            isBuyerMaker: t.isBuyerMaker
                        }));
                        
                        console.log(`Pre-populated ${limit} historical trade ticks.`);
                        writeCache();
                    }
                }).catch(err => {
                    console.error("Failed to load historical initialization data:", err);
                });
            }

            const wsUrl = `wss://${currentHost}/stream?streams=${hostLeadSymbol}@trade/${hostLeadSymbol}@bookTicker/${hostLagSymbol}@trade/${hostLagSymbol}@bookTicker`;
            console.log(`Connecting to Binance WebSocket: ${wsUrl}`);
            ws = WebSocketNode ? new WebSocketNode(wsUrl) : new WebSocket(wsUrl);

            // Watchdog: If connection hangs in CONNECTING (readyState = 0) for > 5 seconds, force close to trigger fallback
            const connectionTimeout = window.setTimeout(() => {
                if (ws && ws.readyState === 0) {
                    console.warn(`Connection to ${currentHost} timed out. Forcing fallback...`);
                    ws.close();
                }
            }, 5000);

            ws.onopen = () => {
                window.clearTimeout(connectionTimeout);
                setStatus('Connected');
            };

            ws.onmessage = (event) => {
                try {
                    receivedMessage = true;
                    // Support both browser Event.data and Node.js Buffer payloads
                    const rawData = event.data ? event.data.toString() : event.toString();
                    const message = JSON.parse(rawData);
                    if (!message.data) return;
                    
                    const { stream, data } = message;
                    const isLead = stream.startsWith(hostLeadSymbol);
                    const asset = isLead ? 'lead' : 'lag';
                    const now = Date.now();

                    if (data.e === 'trade') {
                        const price = parseFloat(data.p);
                        const qty = parseFloat(data.q);
                        const isBuyerMaker = data.m;
                        
                        dataRef.current[asset].trades.push({
                            time: now, price, qty, isBuyerMaker
                        });
                        
                        if (dataRef.current[asset].trades.length > maxWindowSize) {
                            dataRef.current[asset].trades.shift();
                        }
                        
                    } else if (!data.e) { 
                        const bidPrice = parseFloat(data.b);
                        const bidQty = parseFloat(data.B);
                        const askPrice = parseFloat(data.a);
                        const askQty = parseFloat(data.A);
                        
                        dataRef.current[asset].orderBook.push({
                            time: now, bidPrice, bidQty, askPrice, askQty
                        });
                        
                        if (dataRef.current[asset].orderBook.length > maxWindowSize) {
                            dataRef.current[asset].orderBook.shift();
                        }
                    }
                } catch (err) {
                    console.error("Binance WS Parse Error", err);
                }
            };

            ws.onclose = () => {
                window.clearTimeout(connectionTimeout);
                console.log(`Binance WS Closed (${currentHost})`);
                if (!receivedMessage && currentHost === 'stream.binance.com:9443') {
                    // Try fallback to Binance US
                    console.warn("No data received, falling back to Binance US...");
                    currentHost = 'stream.binance.us:9443';
                    window.setTimeout(connect, 1000);
                } else {
                    setStatus('Disconnected');
                    if (!isClosed) {
                        window.setTimeout(connect, 3000);
                    }
                }
            };
            
            ws.onerror = (err) => {
                window.clearTimeout(connectionTimeout);
                setStatus('Error');
                console.error(`Binance WS Error (${currentHost})`, err);
            };
        };

        connect();

        let tickCount = 0;
        // Snapshot interval for UI rendering
        const uiInterval = window.setInterval(() => {
            const leadTrades = dataRef.current.lead.trades;
            const lagTrades = dataRef.current.lag.trades;
            const leadBook = dataRef.current.lead.orderBook;
            const lagBook = dataRef.current.lag.orderBook;
            
            const currentLeadPrice = leadTrades.length > 0 ? leadTrades[leadTrades.length - 1].price : 0;
            const currentLagPrice = lagTrades.length > 0 ? lagTrades[lagTrades.length - 1].price : 0;
            
            // Calculate instantaneous OFI for lead
            let leadOFI = 0;
            if (leadBook.length > 1) {
                const prev = leadBook[leadBook.length - 2];
                const curr = leadBook[leadBook.length - 1];
                
                let bidOFI = 0;
                if (curr.bidPrice > prev.bidPrice) bidOFI = curr.bidQty;
                else if (curr.bidPrice === prev.bidPrice) bidOFI = curr.bidQty - prev.bidQty;
                else bidOFI = -prev.bidQty;
                
                let askOFI = 0;
                if (curr.askPrice < prev.askPrice) askOFI = curr.askQty;
                else if (curr.askPrice === prev.askPrice) askOFI = curr.askQty - prev.askQty;
                else askOFI = -prev.askQty;
                
                leadOFI = bidOFI - askOFI;
            }
            
            const lagSpread = lagBook.length > 0 ? (lagBook[lagBook.length - 1].askPrice - lagBook[lagBook.length - 1].bidPrice) : 0;
            
            // Compile history for the line chart
            const history = [];
            const len = Math.min(leadTrades.length, lagTrades.length);
            for (let i = 0; i < len; i++) {
                history.push({
                    lead: leadTrades[i].price,
                    lag: lagTrades[i].price
                });
            }

            setSnapshot({
                leadPrice: currentLeadPrice,
                lagPrice: currentLagPrice,
                leadOFI,
                lagSpread,
                history
            });

            tickCount++;
            if (tickCount % 20 === 0) {
                writeCache();
            }
        }, 500);

        return () => {
            isClosed = true;
            if (ws) ws.close();
            window.clearInterval(uiInterval);
            writeCache();
        };
    }, [leadSymbol, lagSymbol, maxWindowSize]);

    // Provide a method to get raw buffer for math calculations
    const getRawData = useCallback(() => dataRef.current, []);

    return { status, activeHost, snapshot, getRawData };
}

return { useBinanceSocket };
