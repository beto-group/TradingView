const { useState, useEffect, useRef } = dc;

function ServerDaemonManager({ credentials }) {
    const [daemonStatus, setDaemonStatus] = useState('Stopped'); // 'Stopped' | 'Installing' | 'Running' | 'Error'
    const [pid, setPid] = useState(null);
    const [logs, setLogs] = useState([]);
    
    // Electron/Node runtime checks
    const child_process = window.require ? window.require('child_process') : null;
    const path = window.require ? window.require('path') : null;
    const fs = window.require ? window.require('fs') : null;

    const isNodeAvailable = child_process && path && fs;

    // Get absolute paths
    const getPaths = () => {
        if (!isNodeAvailable) return null;
        const vaultPath = window.app.vault.adapter.getBasePath();
        const resolvedPath = dc.resolvePath("TRADING VIEW/src/server.js");
        const serverScriptPath = path.join(vaultPath, resolvedPath);
        const workingDir = path.dirname(serverScriptPath);
        const logFilePath = path.join(workingDir, 'daemon.log');
        return { serverScriptPath, workingDir, logFilePath };
    };

    // 1. Check if daemon is already running on mount
    useEffect(() => {
        if (!isNodeAvailable) return;
        const savedPid = window.betoTradingViewDaemonPid;
        if (savedPid) {
            let isRunning = false;
            try {
                // Signal 0 checks if the process exists without killing it
                process.kill(savedPid, 0);
                isRunning = true;
            } catch (e) {
                // Process is dead
            }

            if (isRunning) {
                setPid(savedPid);
                setDaemonStatus('Running');
                addLog(`Detected active background daemon (PID: ${savedPid}). Reconnecting...`);
            } else {
                window.betoTradingViewDaemonPid = null;
            }
        }
    }, []);

    // 2. Poll the log file if the daemon is running
    useEffect(() => {
        if (!isNodeAvailable || daemonStatus !== 'Running') return;
        
        const paths = getPaths();
        if (!paths) return;
        const { logFilePath } = paths;

        let lastSize = 0;
        try {
            if (fs.existsSync(logFilePath)) {
                const stats = fs.statSync(logFilePath);
                lastSize = Math.max(0, stats.size - 2000); // Read last 2KB on mount
            }
        } catch (e) {}

        const pollLogs = () => {
            try {
                if (fs.existsSync(logFilePath)) {
                    const stats = fs.statSync(logFilePath);
                    if (stats.size > lastSize) {
                        const fd = fs.openSync(logFilePath, 'r');
                        const buffer = Buffer.alloc(stats.size - lastSize);
                        fs.readSync(fd, buffer, 0, stats.size - lastSize, lastSize);
                        fs.closeSync(fd);
                        
                        addLog(buffer.toString());
                        lastSize = stats.size;
                    } else if (stats.size < lastSize) {
                        lastSize = 0; // File was truncated/cleared
                    }
                }
            } catch (e) {
                console.error("Log poll error:", e);
            }
        };

        pollLogs();
        const interval = setInterval(pollLogs, 1000);
        return () => clearInterval(interval);
    }, [daemonStatus]);

    const addLog = (message) => {
        setLogs(prev => {
            const lines = message.split('\n').filter(Boolean);
            return [...prev, ...lines].slice(-40); // Keep last 40 lines
        });
    };

    const startDaemon = async () => {
        if (!isNodeAvailable) return;

        const paths = getPaths();
        if (!paths) return;
        const { serverScriptPath, workingDir, logFilePath } = paths;

        try {
            // Setup paths environment
            const homeDir = process.env.HOME || '';
            const pathSeparator = process.platform === 'win32' ? ';' : ':';
            const extraPaths = ['/opt/homebrew/bin', '/usr/local/bin', '/usr/bin', '/bin'];

            if (homeDir) {
                try {
                    const nvmVersionsDir = path.join(homeDir, '.nvm', 'versions', 'node');
                    if (fs.existsSync(nvmVersionsDir)) {
                        const versions = fs.readdirSync(nvmVersionsDir);
                        versions.forEach(v => {
                            extraPaths.push(path.join(nvmVersionsDir, v, 'bin'));
                        });
                    }
                } catch (e) {}
            }

            const childEnv = {
                ...process.env,
                PATH: [...new Set([...extraPaths, ...(process.env.PATH || '').split(pathSeparator)])].join(pathSeparator),
                ALPACA_PAPER_KEY: credentials.key || '',
                ALPACA_PAPER_SECRET: credentials.secret || ''
            };

            setDaemonStatus('Installing');
            addLog("Verifying workspace dependencies...");

            child_process.exec('npm list ws', { cwd: workingDir, env: childEnv }, (err) => {
                if (err) {
                    addLog("ws package missing. Installing dependency...");
                    child_process.exec('npm install ws', { cwd: workingDir, env: childEnv }, (installErr) => {
                        if (installErr) {
                            addLog(`Installation failed: ${installErr.message}`);
                            setDaemonStatus('Error');
                            return;
                        }
                        addLog("ws installed.");
                        launchDetachedProcess(serverScriptPath, workingDir, childEnv, logFilePath);
                    });
                } else {
                    launchDetachedProcess(serverScriptPath, workingDir, childEnv, logFilePath);
                }
            });

        } catch (e) {
            addLog(`Daemon start error: ${e.message}`);
            setDaemonStatus('Error');
        }
    };

    const launchDetachedProcess = (scriptPath, workingDir, childEnv, logFilePath) => {
        try {
            addLog("Launching detached server daemon process...");

            // Clear previous log file
            try {
                if (fs.existsSync(logFilePath)) {
                    fs.writeFileSync(logFilePath, '');
                }
            } catch (e) {}

            const out = fs.openSync(logFilePath, 'a');
            
            // Spawn process completely detached from Obsidian
            const child = child_process.spawn('node', [scriptPath], {
                cwd: workingDir,
                env: childEnv,
                detached: true,
                stdio: ['ignore', out, out] // Redirect stdout/stderr directly to file
            });

            // Prevent Obsidian from waiting for this process to exit
            child.unref();

            window.betoTradingViewDaemonPid = child.pid;
            setPid(child.pid);
            setDaemonStatus('Running');
            addLog(`Server daemon launched in background. PID: ${child.pid}`);

        } catch (e) {
            addLog(`Failed to spawn detached process: ${e.message}`);
            setDaemonStatus('Error');
        }
    };

    const stopDaemon = () => {
        const activePid = pid || window.betoTradingViewDaemonPid;
        if (activePid) {
            addLog(`Stopping daemon process (PID: ${activePid})...`);
            try {
                process.kill(activePid, 'SIGTERM');
                addLog(`Daemon stopped by signal: SIGTERM`);
            } catch (e) {
                addLog(`Stop failed: ${e.message}`);
            }
            window.betoTradingViewDaemonPid = null;
            setPid(null);
            setDaemonStatus('Stopped');
        }
    };

    if (!isNodeAvailable) {
        return (
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center', padding: '8px' }}>
                Desktop shell integration unavailable (Daemon controls disabled)
            </div>
        );
    }

    return (
        <div style={{
            background: 'var(--background-primary)',
            padding: '12px',
            borderRadius: '6px',
            border: '1px solid var(--background-modifier-border)',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--text-normal)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <dc.Icon icon="terminal" style={{ width: '14px', height: '14px' }} />
                    Server Side Daemon
                </span>
                <span style={{ 
                    fontSize: '10px', 
                    padding: '2px 6px', 
                    borderRadius: '4px',
                    background: daemonStatus === 'Running' ? 'rgba(76, 175, 80, 0.1)' : 'rgba(128, 128, 128, 0.1)',
                    color: daemonStatus === 'Running' ? 'var(--color-green)' : 'var(--text-muted)',
                    border: `1px solid ${daemonStatus === 'Running' ? 'rgba(76, 175, 80, 0.2)' : 'rgba(128, 128, 128, 0.2)'}`
                }}>
                    {daemonStatus.toUpperCase()}
                </span>
            </div>

            <div style={{ display: 'flex', gap: '6px' }}>
                {daemonStatus !== 'Running' && daemonStatus !== 'Installing' ? (
                    <button 
                        onClick={startDaemon}
                        style={{
                            flex: 1,
                            background: 'var(--interactive-accent)',
                            color: 'var(--text-on-accent)',
                            border: 'none',
                            padding: '6px 10px',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '11px',
                            fontWeight: 'bold'
                        }}
                    >
                        Start Daemon Process
                    </button>
                ) : (
                    <button 
                        onClick={stopDaemon}
                        disabled={daemonStatus === 'Installing'}
                        style={{
                            flex: 1,
                            background: 'var(--background-modifier-error)',
                            color: 'white',
                            border: 'none',
                            padding: '6px 10px',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '11px',
                            fontWeight: 'bold',
                            opacity: daemonStatus === 'Installing' ? 0.6 : 1
                        }}
                    >
                        {daemonStatus === 'Installing' ? 'Installing...' : 'Stop Daemon Process'}
                    </button>
                )}
            </div>

            {logs.length > 0 && (
                <div style={{
                    background: 'var(--background-secondary-alt)',
                    border: '1px solid var(--background-modifier-border)',
                    borderRadius: '4px',
                    padding: '6px',
                    fontFamily: 'monospace',
                    fontSize: '10px',
                    color: 'var(--text-normal)',
                    maxHeight: '120px',
                    overflowY: 'auto',
                    display: 'flex',
                    flexDirection: 'column-reverse'
                }}>
                    <div>
                        {logs.map((log, index) => (
                            <div key={index} style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', borderBottom: '1px solid var(--background-modifier-border-focus)', padding: '2px 0' }}>
                                {log}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

return { ServerDaemonManager };
