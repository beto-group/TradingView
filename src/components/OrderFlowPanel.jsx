function OrderFlowPanel({ snapshot }) {
    const { leadPrice, lagPrice, leadOFI, lagSpread } = snapshot;

    // OFI determines pressure: positive = buy pressure, negative = sell pressure
    const isPositiveOFI = leadOFI > 0;
    const ofiMagnitude = Math.min(Math.abs(leadOFI), 100) / 100; // Normalize visually

    return (
        <div style={{ 
            display: 'grid', 
            gridTemplateColumns: '1fr 1fr', 
            gap: '16px',
            background: 'var(--background-secondary-alt)',
            padding: '16px',
            borderRadius: '8px',
            border: '1px solid var(--background-modifier-border)'
        }}>
            {/* Lead Asset Panel */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: 'var(--text-muted)', fontSize: '12px', fontWeight: 600, letterSpacing: '1px' }}>LEAD ASSET</span>
                    <span style={{ color: 'var(--text-normal)', fontSize: '14px', fontWeight: 'bold' }}>BTC/USDT</span>
                </div>
                <div style={{ fontSize: '24px', color: 'var(--text-normal)', fontFamily: 'monospace' }}>
                    ${leadPrice.toFixed(2)}
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '10px' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Order Flow Imbalance (OFI)</span>
                    <div style={{ 
                        height: '6px', 
                        width: '100%', 
                        background: 'var(--background-modifier-form-field)', 
                        borderRadius: '3px',
                        overflow: 'hidden',
                        display: 'flex'
                    }}>
                        {/* Negative side */}
                        <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end' }}>
                            {!isPositiveOFI && <div style={{ width: `${ofiMagnitude * 100}%`, background: 'var(--color-red)', height: '100%' }} />}
                        </div>
                        {/* Center line */}
                        <div style={{ width: '2px', background: 'var(--text-muted)' }} />
                        {/* Positive side */}
                        <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-start' }}>
                            {isPositiveOFI && <div style={{ width: `${ofiMagnitude * 100}%`, background: 'var(--color-green)', height: '100%' }} />}
                        </div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-faint)' }}>
                        <span>Sell Pressure</span>
                        <span style={{ color: isPositiveOFI ? 'var(--color-green)' : 'var(--color-red)' }}>{leadOFI.toFixed(2)}</span>
                        <span>Buy Pressure</span>
                    </div>
                </div>
            </div>

            {/* Lag Asset Panel */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', paddingLeft: '16px', borderLeft: '1px solid var(--background-modifier-border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: 'var(--text-muted)', fontSize: '12px', fontWeight: 600, letterSpacing: '1px' }}>LAG ASSET</span>
                    <span style={{ color: 'var(--text-normal)', fontSize: '14px', fontWeight: 'bold' }}>SOL/USDT</span>
                </div>
                <div style={{ fontSize: '24px', color: 'var(--text-normal)', fontFamily: 'monospace' }}>
                    ${lagPrice.toFixed(2)}
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '10px' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Spread Constraints</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '14px', fontFamily: 'monospace', color: 'var(--text-accent)' }}>${lagSpread.toFixed(3)}</span>
                        <span style={{ fontSize: '11px', color: lagSpread > 0.05 ? 'var(--color-red)' : 'var(--color-green)' }}>
                            {lagSpread > 0.05 ? 'High execution cost' : 'Favorable spread'}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}

return { OrderFlowPanel };
