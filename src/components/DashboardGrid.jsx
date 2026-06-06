function DashboardGrid({ children }) {
    return (
        <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(12, 1fr)',
            gap: '16px',
            padding: '24px',
            height: '100%',
            boxSizing: 'border-box',
            background: 'var(--background-primary)',
            color: 'var(--text-normal)',
            overflowY: 'auto'
        }}>
            {/* Header */}
            <div style={{ gridColumn: 'span 12', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--background-modifier-border)', paddingBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <dc.Icon icon="activity" style={{ color: 'var(--interactive-accent)', width: '24px', height: '24px' }} />
                    <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 600 }}>Lead-Lag Trading Engine</h1>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>STATUS:</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--background-secondary-alt)', padding: '4px 12px', borderRadius: '12px', border: '1px solid var(--background-modifier-border)' }}>
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--color-green)', boxShadow: '0 0 8px var(--color-green)' }} />
                        <span style={{ fontSize: '12px', fontWeight: 500 }}>Live (Binance WS)</span>
                    </div>
                </div>
            </div>

            {children}
        </div>
    );
}

return { DashboardGrid };
