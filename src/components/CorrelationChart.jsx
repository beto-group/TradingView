const { useMemo } = dc;

function CorrelationChart({ ccfData, peakLag, threshold }) {
    if (!ccfData || ccfData.length === 0) {
        return (
            <div style={{ padding: '20px', color: 'var(--text-muted)', textAlign: 'center' }}>
                <dc.Icon icon="activity" style={{ opacity: 0.5, marginBottom: '10px' }} />
                <br/>
                Waiting for sufficient trade volume...
            </div>
        );
    }

    const maxCorrelation = useMemo(() => Math.max(...ccfData.map(d => d.correlation)), [ccfData]);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <h3 style={{ margin: '0 0 10px 0', fontSize: '14px', color: 'var(--text-normal)' }}>
                Cross-Correlation Function (Lead: BTC ➔ Lag: SOL)
            </h3>
            <div style={{ 
                flex: 1, 
                display: 'flex', 
                alignItems: 'flex-end', 
                justifyContent: 'space-between', 
                padding: '10px', 
                background: 'var(--background-primary)', 
                border: '1px solid var(--background-modifier-border)',
                borderRadius: '8px',
                position: 'relative'
            }}>
                {/* Threshold Line */}
                <div style={{
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    bottom: `${(threshold / 1.0) * 100}%`,
                    borderBottom: '1px dashed var(--color-red)',
                    opacity: 0.5,
                    pointerEvents: 'none'
                }}>
                    <span style={{ position: 'absolute', top: '-18px', right: '5px', fontSize: '10px', color: 'var(--color-red)' }}>Threshold {threshold.toFixed(2)}</span>
                </div>

                {ccfData.map((point) => {
                    const isPeak = point.lag === peakLag && point.correlation === maxCorrelation && maxCorrelation > 0;
                    const heightPercent = Math.max(0, point.correlation * 100);
                    return (
                        <div key={point.lag} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '20px' }}>
                            <div style={{ fontSize: '10px', color: isPeak ? 'var(--interactive-accent)' : 'var(--text-muted)', marginBottom: '4px' }}>
                                {(point.correlation * 100).toFixed(0)}%
                            </div>
                            <div style={{
                                width: '10px',
                                height: `${heightPercent}%`,
                                minHeight: '2px',
                                background: isPeak ? 'var(--interactive-accent)' : 'var(--background-modifier-border)',
                                borderRadius: '2px 2px 0 0',
                                transition: 'height 0.3s ease'
                            }} />
                            <div style={{ fontSize: '10px', color: 'var(--text-faint)', marginTop: '4px' }}>
                                {point.lag}s
                            </div>
                        </div>
                    );
                })}
            </div>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '10px' }}>
                X-Axis: Time Lag τ (seconds) | Y-Axis: Pearson Correlation Coefficient (Normalized)
            </p>
        </div>
    );
}

return { CorrelationChart };
