/* eslint-disable obsidianmd/rule-custom-message */
const { useState, useEffect, useMemo, useRef } = dc;

const https = window.require ? window.require('https') : null;

const fetchJson = (url, options = {}) => {
    const { signal } = options;
    if (!https) {
        return window.fetch(url, { signal }).then(res => {
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return res.json();
        });
    }
    return new Promise((resolve, reject) => {
        if (signal && signal.aborted) {
            reject(new DOMException('Aborted', 'AbortError'));
            return;
        }
        const req = https.get(url, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                if (signal && signal.aborted) {
                    reject(new DOMException('Aborted', 'AbortError'));
                    return;
                }
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
        });
        
        req.on('error', (err) => {
            if (signal && signal.aborted) return;
            reject(err);
        });

        if (signal) {
            signal.addEventListener('abort', () => {
                req.destroy();
                reject(new DOMException('Aborted', 'AbortError'));
            });
        }
    });
};

function MacroChart({ leadSymbol, lagSymbol, activeHost, folderPath }) {
    const [history, setHistory] = useState(null);
    const [loading, setLoading] = useState(true);
    const [hoveredIndex, setHoveredIndex] = useState(null);
    const svgRef = useRef(null);

    const activeFolderPath = folderPath || "_RESOURCES/DATACORE/_DONE/TradingView";

    useEffect(() => {
        const controller = new AbortController();
        const signal = controller.signal;

        const fetchMacroData = async () => {
            try {
                // 1. Check local Vault Cache first
                const adapter = window.app?.vault?.adapter;
                const cachePath = dc.resolvePath ? dc.resolvePath(activeFolderPath + "/data/macro_history.json") : null;
                
                if (adapter && cachePath) {
                    const cacheExists = await adapter.exists(cachePath);
                    if (cacheExists) {
                        try {
                            const cacheContent = await adapter.read(cachePath);
                            const parsedCache = JSON.parse(cacheContent);
                            
                            // Cache validity threshold: 24 hours (86400000ms)
                            const ageMs = Date.now() - parsedCache.timestamp;
                            if (ageMs < 24 * 60 * 60 * 1000 && parsedCache.history && parsedCache.host === activeHost) {
                                console.log("Loaded macro trend from vault JSON cache.");
                                if (!signal.aborted) {
                                    setHistory(parsedCache.history);
                                    setLoading(false);
                                }
                                return; // Bypass API fetch
                            }
                        } catch (e) {
                            console.warn("Failed to parse macro cache file, falling back to API:", e);
                        }
                    }
                }

                // 2. Fetch from Binance API if cache is missing or expired
                const apiHost = activeHost.includes('binance.us') ? 'api.binance.us' : 'api.binance.com';
                const hostLeadSymbol = activeHost.includes('binance.us') ? leadSymbol.replace('usdt', 'usd') : leadSymbol;
                const hostLagSymbol = activeHost.includes('binance.us') ? lagSymbol.replace('usdt', 'usd') : lagSymbol;

                const [leadData, lagData] = await Promise.all([
                    fetchJson(`https://${apiHost}/api/v3/klines?symbol=${hostLeadSymbol.toUpperCase()}&interval=1d&limit=90`, { signal }),
                    fetchJson(`https://${apiHost}/api/v3/klines?symbol=${hostLagSymbol.toUpperCase()}&interval=1d&limit=90`, { signal })
                ]);

                const length = Math.min(leadData.length, lagData.length);
                const parsed = [];
                for (let i = 0; i < length; i++) {
                    parsed.push({
                        leadO: parseFloat(leadData[i][1]),
                        leadH: parseFloat(leadData[i][2]),
                        leadL: parseFloat(leadData[i][3]),
                        leadC: parseFloat(leadData[i][4]),
                        lagO: parseFloat(lagData[i][1]),
                        lagH: parseFloat(lagData[i][2]),
                        lagL: parseFloat(lagData[i][3]),
                        lagC: parseFloat(lagData[i][4]),
                        time: new Date(leadData[i][0]).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
                    });
                }

                if (!signal.aborted) {
                    setHistory(parsed);
                    
                    // Save to local cache
                    if (adapter && cachePath) {
                        try {
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
                                host: activeHost,
                                history: parsed
                            };
                            await adapter.write(cachePath, JSON.stringify(cacheObj, null, 2));
                            console.log("Saved macro klines to vault JSON cache.");
                        } catch (e) {
                            console.error("Failed to write macro cache file:", e);
                        }
                    }
                }
            } catch (err) {
                if (err.name !== 'AbortError') {
                    console.error("Failed to fetch macro history data:", err);
                }
            } finally {
                if (!signal.aborted) {
                    setLoading(false);
                }
            }
        };

        fetchMacroData();
        return () => controller.abort();
    }, [leadSymbol, lagSymbol, activeHost]);

    const viewBoxWidth = 500;
    const viewBoxHeight = 220;

    const panelsData = useMemo(() => {
        if (!history || history.length < 2) return null;

        const parsePanel = (keyO, keyH, keyL, keyC, top, bottom) => {
            const highs = history.map(h => h[keyH]);
            const lows = history.map(h => h[keyL]);
            const minPrice = Math.min(...lows);
            const maxPrice = Math.max(...highs);
            let range = maxPrice - minPrice;
            if (range === 0) range = 1;

            const height = bottom - top;

            const candles = history.map((h, index) => {
                const x = (index / (history.length - 1)) * viewBoxWidth;
                const yO = bottom - ((h[keyO] - minPrice) / range) * height;
                const yH = bottom - ((h[keyH] - minPrice) / range) * height;
                const yL = bottom - ((h[keyL] - minPrice) / range) * height;
                const yC = bottom - ((h[keyC] - minPrice) / range) * height;

                const isBullish = h[keyC] >= h[keyO];
                const color = isBullish ? 'var(--color-green)' : 'var(--color-red)';

                return { x, yO, yH, yL, yC, color };
            });

            return { candles, minPrice, maxPrice };
        };

        const btcPanel = parsePanel('leadO', 'leadH', 'leadL', 'leadC', 25, 95);
        const solPanel = parsePanel('lagO', 'lagH', 'lagL', 'lagC', 135, 205);

        return { btcPanel, solPanel };
    }, [history]);

    const handleMouseMove = (e) => {
        if (!history || !svgRef.current) return;
        const rect = svgRef.current.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const pctX = mouseX / rect.width;
        const index = Math.round(pctX * (history.length - 1));
        const clampedIndex = Math.max(0, Math.min(index, history.length - 1));
        setHoveredIndex(clampedIndex);
    };

    const handleMouseLeave = () => {
        setHoveredIndex(null);
    };

    if (loading) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', fontSize: '12px' }}>
                Fetching 3-month daily trend candles...
            </div>
        );
    }

    if (!panelsData) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', fontSize: '12px' }}>
                Failed to load macro trend candles.
            </div>
        );
    }

    const { btcPanel, solPanel } = panelsData;

    // Hovered details
    const hoveredCandle = hoveredIndex !== null && history ? history[hoveredIndex] : null;
    const hoverX = hoveredIndex !== null ? (hoveredIndex / (history.length - 1)) * viewBoxWidth : null;

    return (
        <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
            {/* TradingView style Info Bar */}
            {hoveredCandle && (
                <div style={{
                    position: 'absolute',
                    top: '-6px',
                    left: '110px',
                    right: '110px',
                    background: 'var(--background-secondary-alt)',
                    border: '1px solid var(--background-modifier-border)',
                    borderRadius: '4px',
                    padding: '2px 8px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '9px',
                    fontFamily: 'monospace',
                    color: 'var(--text-normal)',
                    zIndex: 10,
                    pointerEvents: 'none'
                }}>
                    <span>{hoveredCandle.time}</span>
                    <span style={{ display: 'flex', gap: '4px' }}>
                        <span style={{ color: 'var(--text-muted)' }}>BTC:</span>
                        <span style={{ color: hoveredCandle.leadC >= hoveredCandle.leadO ? 'var(--color-green)' : 'var(--color-red)' }}>
                            O:${hoveredCandle.leadO.toFixed(0)} H:${hoveredCandle.leadH.toFixed(0)} L:${hoveredCandle.leadL.toFixed(0)} C:${hoveredCandle.leadC.toFixed(0)}
                        </span>
                    </span>
                    <span style={{ display: 'flex', gap: '4px' }}>
                        <span style={{ color: 'var(--interactive-accent)' }}>SOL:</span>
                        <span style={{ color: hoveredCandle.lagC >= hoveredCandle.lagO ? 'var(--color-green)' : 'var(--color-red)' }}>
                            O:${hoveredCandle.lagO.toFixed(1)} H:${hoveredCandle.lagH.toFixed(1)} L:${hoveredCandle.lagL.toFixed(1)} C:${hoveredCandle.lagC.toFixed(1)}
                        </span>
                    </span>
                </div>
            )}

            {/* SVG Candlestick Panels */}
            <svg 
                ref={svgRef}
                viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`} 
                width="100%" 
                height="100%" 
                preserveAspectRatio="none"
                onMouseMove={handleMouseMove}
                onMouseLeave={handleMouseLeave}
                style={{ overflow: 'visible', cursor: 'crosshair' }}
            >
                {/* Panel Separator */}
                <line x1="0" y1="110" x2={viewBoxWidth} y2="110" stroke="var(--background-modifier-border)" strokeWidth="1" strokeDasharray="3 3" />

                {/* --- PANEL 1: BTC --- */}
                {btcPanel.candles.map((c, i) => (
                    <g key={`btc-${i}`}>
                        <line x1={c.x} y1={c.yH} x2={c.x} y2={c.yL} stroke={c.color} strokeWidth="1.2" />
                        <rect 
                            x={c.x - 2} 
                            y={Math.min(c.yO, c.yC)} 
                            width="4" 
                            height={Math.max(Math.abs(c.yO - c.yC), 1)} 
                            fill={c.color} 
                        />
                    </g>
                ))}

                {/* --- PANEL 2: SOL --- */}
                {solPanel.candles.map((c, i) => (
                    <g key={`sol-${i}`}>
                        <line x1={c.x} y1={c.yH} x2={c.x} y2={c.yL} stroke={c.color} strokeWidth="1.2" />
                        <rect 
                            x={c.x - 2} 
                            y={Math.min(c.yO, c.yC)} 
                            width="4" 
                            height={Math.max(Math.abs(c.yO - c.yC), 1)} 
                            fill={c.color} 
                        />
                    </g>
                ))}

                {/* Hover Guideline */}
                {hoverX !== null && (
                    <line 
                        x1={hoverX} 
                        y1="0" 
                        x2={hoverX} 
                        y2={viewBoxHeight} 
                        stroke="var(--text-faint)" 
                        strokeWidth="1" 
                        strokeDasharray="3 3" 
                        pointerEvents="none"
                    />
                )}
            </svg>

            {/* Y-Axis Label overlays */}
            <div style={{ position: 'absolute', top: '2px', left: '6px', fontSize: '9px', color: 'var(--text-faint)', pointerEvents: 'none' }}>
                BTC max: ${btcPanel.maxPrice.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </div>
            <div style={{ position: 'absolute', top: '82px', left: '6px', fontSize: '9px', color: 'var(--text-faint)', pointerEvents: 'none' }}>
                BTC min: ${btcPanel.minPrice.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </div>

            <div style={{ position: 'absolute', top: '112px', left: '6px', fontSize: '9px', color: 'var(--text-faint)', pointerEvents: 'none' }}>
                SOL max: ${solPanel.maxPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </div>
            <div style={{ position: 'absolute', bottom: '2px', left: '6px', fontSize: '9px', color: 'var(--text-faint)', pointerEvents: 'none' }}>
                SOL min: ${solPanel.minPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </div>
        </div>
    );
}

return { MacroChart };
