const { useMemo, useState, useRef } = dc;
const activeFile = dc.resolvePath("TradingView");
const folderPath = activeFile 
    ? activeFile.substring(0, activeFile.lastIndexOf('/')) 
    : "_RESOURCES/DATACORE/_DONE/TradingView";
const { MacroChart } = await dc.require(folderPath + "/src/components/MacroChart.jsx");

function PriceChart({ history, activeHost, folderPath }) {
    const [viewMode, setViewMode] = useState('micro'); // 'micro' | 'macro'
    const [hoveredIndex, setHoveredIndex] = useState(null);
    const svgRef = useRef(null);

    const viewBoxWidth = 500;
    const viewBoxHeight = 150;

    const chartData = useMemo(() => {
        if (!history || history.length < 2) return null;

        const leadBase = history[0].lead;
        const lagBase = history[0].lag;

        const leadPct = history.map(h => ((h.lead - leadBase) / leadBase) * 100);
        const lagPct = history.map(h => ((h.lag - lagBase) / lagBase) * 100);

        const allPcts = [...leadPct, ...lagPct];
        let minPct = Math.min(...allPcts);
        let maxPct = Math.max(...allPcts);
        let range = maxPct - minPct;

        if (range === 0) {
            range = 1;
            minPct -= 0.5;
            maxPct += 0.5;
        }

        minPct -= range * 0.1;
        maxPct += range * 0.1;
        range = maxPct - minPct;

        const pointsLead = [];
        const pointsLag = [];

        history.forEach((_, index) => {
            const x = (index / (history.length - 1)) * viewBoxWidth;
            
            const yLead = viewBoxHeight - ((leadPct[index] - minPct) / range) * viewBoxHeight;
            pointsLead.push(`${x.toFixed(1)},${yLead.toFixed(1)}`);

            const yLag = viewBoxHeight - ((lagPct[index] - minPct) / range) * viewBoxHeight;
            pointsLag.push(`${x.toFixed(1)},${yLag.toFixed(1)}`);
        });

        return {
            leadPath: pointsLead.join(' '),
            lagPath: pointsLag.join(' '),
            minVal: minPct,
            maxVal: maxPct,
            leadPct,
            lagPct
        };
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

    // Calculate hover details
    const hoveredDetails = useMemo(() => {
        if (hoveredIndex === null || !history || !chartData) return null;
        return {
            leadPrice: history[hoveredIndex].lead,
            lagPrice: history[hoveredIndex].lag,
            leadPct: chartData.leadPct[hoveredIndex],
            lagPct: chartData.lagPct[hoveredIndex],
            x: (hoveredIndex / (history.length - 1)) * viewBoxWidth
        };
    }, [hoveredIndex, history, chartData]);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <h3 style={{ margin: 0, fontSize: '13px', color: 'var(--text-normal)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <dc.Icon icon="trending-up" style={{ width: '14px', height: '14px' }} />
                        Price Tracking (Normalized %)
                    </h3>
                    
                    <div style={{
                        display: 'flex',
                        background: 'var(--background-primary)',
                        padding: '2px',
                        borderRadius: '4px',
                        border: '1px solid var(--background-modifier-border)'
                    }}>
                        <button
                            onClick={() => { setViewMode('micro'); setHoveredIndex(null); }}
                            style={{
                                border: 'none',
                                background: viewMode === 'micro' ? 'var(--background-modifier-border-focus)' : 'transparent',
                                color: viewMode === 'micro' ? 'var(--text-normal)' : 'var(--text-muted)',
                                padding: '2px 8px',
                                fontSize: '10px',
                                borderRadius: '3px',
                                cursor: 'pointer',
                                fontWeight: viewMode === 'micro' ? 'bold' : 'normal'
                            }}
                        >
                            Real-Time (60s)
                        </button>
                        <button
                            onClick={() => { setViewMode('macro'); setHoveredIndex(null); }}
                            style={{
                                border: 'none',
                                background: viewMode === 'macro' ? 'var(--background-modifier-border-focus)' : 'transparent',
                                color: viewMode === 'macro' ? 'var(--text-normal)' : 'var(--text-muted)',
                                padding: '2px 8px',
                                fontSize: '10px',
                                borderRadius: '3px',
                                cursor: 'pointer',
                                fontWeight: viewMode === 'macro' ? 'bold' : 'normal'
                            }}
                        >
                            Macro Trend (3M)
                        </button>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '12px', fontSize: '11px' }}>
                    <span style={{ color: 'var(--text-normal)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span style={{ display: 'inline-block', width: '8px', height: '8px', background: 'var(--text-normal)', borderRadius: '50%' }} />
                        BTC
                    </span>
                    <span style={{ color: 'var(--interactive-accent)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span style={{ display: 'inline-block', width: '8px', height: '8px', background: 'var(--interactive-accent)', borderRadius: '50%' }} />
                        SOL (Lag)
                    </span>
                </div>
            </div>

            <div style={{
                flex: 1,
                background: 'var(--background-primary)',
                border: '1px solid var(--background-modifier-border)',
                borderRadius: '8px',
                padding: '6px',
                position: 'relative',
                minHeight: viewMode === 'macro' ? '220px' : '120px',
                transition: 'min-height 0.3s ease'
            }}>
                {/* Micro info bar */}
                {viewMode === 'micro' && hoveredDetails && (
                    <div style={{
                        position: 'absolute',
                        top: '4px',
                        left: '80px',
                        right: '80px',
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
                        <span style={{ display: 'flex', gap: '4px' }}>
                            <span style={{ color: 'var(--text-muted)' }}>BTC:</span>
                            <span style={{ color: hoveredDetails.leadPct >= 0 ? 'var(--color-green)' : 'var(--color-red)' }}>
                                {hoveredDetails.leadPct >= 0 ? '+' : ''}{hoveredDetails.leadPct.toFixed(3)}% (${hoveredDetails.leadPrice.toLocaleString()})
                            </span>
                        </span>
                        <span style={{ display: 'flex', gap: '4px' }}>
                            <span style={{ color: 'var(--interactive-accent)' }}>SOL:</span>
                            <span style={{ color: hoveredDetails.lagPct >= 0 ? 'var(--color-green)' : 'var(--color-red)' }}>
                                {hoveredDetails.lagPct >= 0 ? '+' : ''}{hoveredDetails.lagPct.toFixed(3)}% (${hoveredDetails.lagPrice.toFixed(2)})
                            </span>
                        </span>
                    </div>
                )}

                {viewMode === 'macro' ? (
                    <MacroChart leadSymbol="btcusdt" lagSymbol="solusdt" activeHost={activeHost} folderPath={folderPath} />
                ) : (
                    !chartData ? (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', fontSize: '12px' }}>
                            Awaiting price tick updates to build chart...
                        </div>
                    ) : (
                        <div style={{ position: 'relative', width: '100%', height: '100%' }}>
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
                                <line 
                                    x1="0" 
                                    y1={viewBoxHeight / 2} 
                                    x2={viewBoxWidth} 
                                    y2={viewBoxHeight / 2} 
                                    stroke="var(--background-modifier-border)" 
                                    strokeDasharray="4 4" 
                                />
                                <polyline
                                    fill="none"
                                    stroke="var(--text-muted)"
                                    strokeWidth="2.5"
                                    points={chartData.leadPath}
                                    style={{ transition: 'all 0.1s ease' }}
                                />
                                <polyline
                                    fill="none"
                                    stroke="var(--interactive-accent)"
                                    strokeWidth="2.5"
                                    points={chartData.lagPath}
                                    style={{ transition: 'all 0.1s ease' }}
                                />

                                {/* Hover Guideline */}
                                {hoveredDetails && (
                                    <line 
                                        x1={hoveredDetails.x} 
                                        y1="0" 
                                        x2={hoveredDetails.x} 
                                        y2={viewBoxHeight} 
                                        stroke="var(--text-faint)" 
                                        strokeWidth="1" 
                                        strokeDasharray="3 3" 
                                        pointerEvents="none"
                                    />
                                )}
                            </svg>
                            <div style={{ position: 'absolute', top: '4px', left: '6px', fontSize: '9px', color: 'var(--text-faint)', pointerEvents: 'none' }}>
                                +{chartData.maxVal.toFixed(2)}%
                            </div>
                            <div style={{ position: 'absolute', bottom: '4px', left: '6px', fontSize: '9px', color: 'var(--text-faint)', pointerEvents: 'none' }}>
                                {chartData.minVal.toFixed(2)}%
                            </div>
                        </div>
                    )
                )}
            </div>
        </div>
    );
}

return { PriceChart };
