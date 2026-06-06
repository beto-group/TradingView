/**
 * MCPBridge.jsx
 * Exposes real-time component state to AI agents and listens for buy/sell/reload commands
 */
const { useEffect } = dc;

function MCPBridge({ folderPath, snapshot, connectionStatus, activeHost, executeTrade, onReload }) {
    
    // 1. Sync real-time state to mcp_state.json
    useEffect(() => {
        const updateState = async () => {
            try {
                const adapter = dc.app.vault.adapter;
                const stateFile = folderPath + '/data/mcp_state.json';
                const state = {
                    component: "Trading View Lead-Lag Engine",
                    connectionStatus: connectionStatus || "Disconnected",
                    activeHost: activeHost,
                    leadAsset: {
                        symbol: "BTC",
                        price: snapshot.leadPrice || 0,
                        OFI: snapshot.leadOFI || 0
                    },
                    lagAsset: {
                        symbol: "SOL",
                        price: snapshot.lagPrice || 0,
                        spread: snapshot.lagSpread || 0
                    },
                    lastUpdate: new Date().toISOString(),
                    vaultName: dc.app.vault.getName()
                };
                
                // Ensure parent directory exists
                const dir = folderPath + '/data';
                const dirExists = await adapter.exists(dir);
                if (!dirExists) {
                    await adapter.mkdir(dir);
                }
                
                await adapter.write(stateFile, JSON.stringify(state, null, 2));
            } catch (e) {
                console.error("MCPBridge: Failed to write state:", e);
            }
        };

        const interval = setInterval(updateState, 5000);
        updateState();
        return () => clearInterval(interval);
    }, [folderPath, snapshot, connectionStatus, activeHost]);

    // 2. Poll mcp_commands.json for AI-triggered commands
    useEffect(() => {
        const cmdFile = folderPath + '/data/mcp_commands.json';
        const timer = setInterval(async () => {
            try {
                const adapter = dc.app.vault.adapter;
                if (!(await adapter.exists(cmdFile))) return;
                
                const content = await adapter.read(cmdFile);
                const cmd = JSON.parse(content);
                
                if (cmd && cmd.executed === false) {
                    console.log(`[MCP COMMAND RECEIVED] Action: ${cmd.action}`);
                    
                    if (cmd.action === 'reload') {
                        cmd.executed = true;
                        cmd.executedAt = new Date().toISOString();
                        await adapter.write(cmdFile, JSON.stringify(cmd, null, 2));
                        if (typeof onReload === 'function') {
                            onReload();
                        }
                    } else if (cmd.action === 'buy' || cmd.action === 'sell') {
                        // Mark as executed early to prevent race conditions
                        cmd.executed = true;
                        cmd.executedAt = new Date().toISOString();
                        cmd.status = "executing";
                        await adapter.write(cmdFile, JSON.stringify(cmd, null, 2));
                        
                        try {
                            const qty = cmd.qty || 10;
                            // Execute the trade (returns a promise)
                            const result = await executeTrade(cmd.action.toUpperCase(), qty);
                            cmd.status = "success";
                            cmd.result = result || { message: "Simulated execution successfully triggered." };
                        } catch (err) {
                            cmd.status = "error";
                            cmd.error = err.message || JSON.stringify(err);
                            console.error(`[MCP EXECUTION ERROR]`, err);
                        }
                        
                        // Write final execution status back
                        await adapter.write(cmdFile, JSON.stringify(cmd, null, 2));
                    }
                }
            } catch (e) {
                console.error("MCPBridge: Failed to process command:", e);
            }
        }, 1500); // Poll command file every 1.5 seconds for snappy AI responsiveness
        
        return () => clearInterval(timer);
    }, [folderPath, executeTrade, onReload]);

    return null;
}

return { MCPBridge };
