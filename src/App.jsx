/* eslint-disable obsidianmd/rule-custom-message */
const activeFile = dc.resolvePath("TRADING VIEW.md");
const folderPath = activeFile 
    ? activeFile.substring(0, activeFile.lastIndexOf('/')) 
    : "_RESOURCES/DATACORE/_DONE/TradingView";

const { DashboardGrid } = await dc.require(folderPath + "/src/components/DashboardGrid.jsx");
const { OrderFlowPanel } = await dc.require(folderPath + "/src/components/OrderFlowPanel.jsx");
const { CorrelationChart } = await dc.require(folderPath + "/src/components/CorrelationChart.jsx");
const { PriceChart } = await dc.require(folderPath + "/src/components/PriceChart.jsx");
const { AlpacaKeyManager } = await dc.require(folderPath + "/src/components/AlpacaKeyManager.jsx");
const { ServerDaemonManager } = await dc.require(folderPath + "/src/components/ServerDaemonManager.jsx");
const { useBinanceSocket } = await dc.require(folderPath + "/src/hooks/useBinanceSocket.jsx");
const { useLeadLagEngine } = await dc.require(folderPath + "/src/hooks/useLeadLagEngine.jsx");
const { useAlpacaKeychain } = await dc.require(folderPath + "/src/hooks/useAlpacaKeychain.jsx");
const { MCPBridge } = await dc.require(folderPath + "/src/components/MCPBridge.jsx");
const mathUtils = await dc.require(folderPath + "/src/utils/math.js");


function App(props) {
    const { folderPath: passedFolderPath } = props;
    const activeFolderPath = passedFolderPath || folderPath;
    const { status, activeHost, snapshot, getRawData } = useBinanceSocket('btcusdt', 'solusdt', 100, activeFolderPath);
    const { credentials, saveKeys, clearKeys, executeTrade } = useAlpacaKeychain();
    
    const { engineState, tradeLogs } = useLeadLagEngine(getRawData, mathUtils, executeTrade, {
        correlationThreshold: 0.85,
        minOFI: 5.0,
        updateInterval: 1000
    });

    return (
        <DashboardGrid>
            <MCPBridge 
                folderPath={activeFolderPath}
                snapshot={snapshot}
                connectionStatus={status}
                activeHost={activeHost}
                executeTrade={executeTrade}
                onReload={() => {
                    console.log("MCPBridge triggered reload.");
                    if (window.location) window.location.reload();
                }}
            />
            {/* Left Column: Data & Correlation (Span 8) */}
            <div style={{ gridColumn: 'span 8', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <OrderFlowPanel snapshot={snapshot} />
                
                <div style={{ 
                    background: 'var(--background-secondary-alt)', 
                    padding: '16px', 
                    borderRadius: '8px', 
                    border: '1px solid var(--background-modifier-border)',
                    minHeight: '220px'
                }}>
                    <PriceChart history={snapshot.history} activeHost={activeHost} folderPath={activeFolderPath} />
                </div>
                
                <div style={{ 
                    background: 'var(--background-secondary-alt)', 
                    padding: '16px', 
                    borderRadius: '8px', 
                    border: '1px solid var(--background-modifier-border)',
                    minHeight: '220px'
                }}>
                    <CorrelationChart 
                        ccfData={engineState.ccfData} 
                        peakLag={engineState.optimalLagIndex} 
                        threshold={0.85} 
                    />
                </div>
            </div>

            {/* Right Column: Execution Signals (Span 4) */}
            <div style={{ 
                gridColumn: 'span 4', 
                background: 'var(--background-secondary-alt)', 
                padding: '16px', 
                borderRadius: '8px', 
                border: '1px solid var(--background-modifier-border)',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px'
            }}>
                <AlpacaKeyManager credentials={credentials} onSave={saveKeys} onClear={clearKeys} />
                
                <ServerDaemonManager credentials={credentials} folderPath={activeFolderPath} />

                <h3 style={{ margin: 0, fontSize: '14px', color: 'var(--text-normal)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <dc.Icon icon="list" style={{ width: '16px', height: '16px' }} />
                    Execution Gate & Logs
                </h3>
                
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto' }}>
                    {tradeLogs.length === 0 ? (
                        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
                            Awaiting Signal Cascade...
                        </div>
                    ) : (
                        tradeLogs.map((log, i) => (
                            <div key={i} style={{ 
                                padding: '12px', 
                                background: 'var(--background-primary)', 
                                borderRadius: '6px',
                                borderLeft: `3px solid ${log.direction === 'LONG' ? 'var(--color-green)' : 'var(--color-red)'}`,
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '4px'
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontSize: '12px', fontWeight: 'bold', color: log.direction === 'LONG' ? 'var(--color-green)' : 'var(--color-red)' }}>
                                        {log.direction} SOL/USDT
                                    </span>
                                    <span style={{ fontSize: '10px', color: 'var(--text-faint)' }}>{log.time}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-normal)', fontFamily: 'monospace' }}>
                                    <span>Entry: ${log.price.toFixed(2)}</span>
                                    <span style={{ color: 'var(--text-accent)' }}>CCF: {log.confidence}</span>
                                </div>
                                <div style={{ fontSize: '10px', color: log.simulated ? 'var(--text-muted)' : (log.status === 'success' ? 'var(--color-green)' : 'var(--color-red)'), display: 'flex', justifyContent: 'flex-end', marginTop: '2px' }}>
                                    {log.simulated ? 'Simulated Execution' : `Alpaca Paper API: ${log.status.toUpperCase()}`}
                                </div>
                            </div>
                        ))
                    )}
                </div>
                
                {/* Alpaca Keychain Status Footer */}
                <div style={{ marginTop: 'auto', borderTop: '1px solid var(--background-modifier-border)', paddingTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Binance Data Feed</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontSize: '10px', color: 'var(--text-faint)' }}>({activeHost})</span>
                            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: status === 'Connected' ? 'var(--color-green)' : (status === 'Error' || status === 'Disconnected' ? 'var(--color-red)' : 'var(--color-yellow)') }} />
                            <span style={{ fontSize: '11px', fontWeight: 500, color: status === 'Connected' ? 'var(--color-green)' : (status === 'Error' || status === 'Disconnected' ? 'var(--color-red)' : 'var(--color-yellow)') }}>
                                {status.toUpperCase()}
                            </span>
                        </div>
                    </div>
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Alpaca Keychain Integration</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: credentials.key ? 'var(--color-green)' : 'var(--color-yellow)' }} />
                            <span style={{ fontSize: '11px', fontWeight: 500, color: credentials.key ? 'var(--color-green)' : 'var(--color-yellow)' }}>
                                {credentials.key ? 'SECURE (PAPER TRADING ACTIVE)' : 'SIMULATION MODE (NO KEYS)'}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </DashboardGrid>
    );
}

return { App };
