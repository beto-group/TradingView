const { useState } = dc;

function AlpacaKeyManager({ credentials, onSave, onClear }) {
    const [keyInput, setKeyInput] = useState('');
    const [secretInput, setSecretInput] = useState('');
    const [isEditing, setIsEditing] = useState(false);

    const handleSave = async (e) => {
        e.preventDefault();
        if (!keyInput.trim() || !secretInput.trim()) return;
        const success = await onSave(keyInput.trim(), secretInput.trim());
        if (success) {
            setKeyInput('');
            setSecretInput('');
            setIsEditing(false);
        }
    };

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
                    <dc.Icon icon="key" style={{ width: '14px', height: '14px' }} />
                    Alpaca Paper API
                </span>
                <span style={{ 
                    fontSize: '10px', 
                    padding: '2px 6px', 
                    borderRadius: '4px',
                    background: credentials.key ? 'rgba(76, 175, 80, 0.1)' : 'rgba(255, 193, 7, 0.1)',
                    color: credentials.key ? 'var(--color-green)' : 'var(--color-yellow)',
                    border: `1px solid ${credentials.key ? 'rgba(76, 175, 80, 0.2)' : 'rgba(255, 193, 7, 0.2)'}`
                }}>
                    {credentials.key ? 'ACTIVE' : 'SIMULATED'}
                </span>
            </div>

            {credentials.key ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        Connected with Key: <span style={{ fontFamily: 'monospace', color: 'var(--text-normal)' }}>{credentials.key.slice(0, 6)}...{credentials.key.slice(-4)}</span>
                    </div>
                    <button 
                        onClick={onClear}
                        style={{
                            background: 'var(--background-modifier-error)',
                            color: 'white',
                            border: 'none',
                            padding: '6px 10px',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '11px',
                            fontWeight: 'bold',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '4px'
                        }}
                    >
                        <dc.Icon icon="trash" style={{ width: '12px', height: '12px' }} />
                        Disconnect API Keys
                    </button>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {!isEditing ? (
                        <button 
                            onClick={() => setIsEditing(true)}
                            style={{
                                background: 'var(--interactive-accent)',
                                color: 'var(--text-on-accent)',
                                border: 'none',
                                padding: '6px 10px',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '11px',
                                fontWeight: 'bold',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '4px'
                            }}
                        >
                            Configure Alpaca Keys
                        </button>
                    ) : (
                        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <input 
                                type="text"
                                placeholder="Alpaca Paper Key ID"
                                value={keyInput}
                                onChange={(e) => setKeyInput(e.target.value)}
                                style={{
                                    width: '100%',
                                    padding: '6px',
                                    fontSize: '11px',
                                    borderRadius: '4px',
                                    border: '1px solid var(--background-modifier-border)',
                                    background: 'var(--background-secondary-alt)',
                                    color: 'var(--text-normal)'
                                }}
                            />
                            <input 
                                type="password"
                                placeholder="Alpaca Paper Secret Key"
                                value={secretInput}
                                onChange={(e) => setSecretInput(e.target.value)}
                                style={{
                                    width: '100%',
                                    padding: '6px',
                                    fontSize: '11px',
                                    borderRadius: '4px',
                                    border: '1px solid var(--background-modifier-border)',
                                    background: 'var(--background-secondary-alt)',
                                    color: 'var(--text-normal)'
                                }}
                            />
                            <div style={{ display: 'flex', gap: '6px', marginTop: '2px' }}>
                                <button 
                                    type="submit"
                                    style={{
                                        flex: 1,
                                        background: 'var(--interactive-accent)',
                                        color: 'var(--text-on-accent)',
                                        border: 'none',
                                        padding: '4px 8px',
                                        borderRadius: '4px',
                                        cursor: 'pointer',
                                        fontSize: '11px',
                                        fontWeight: 'bold'
                                    }}
                                >
                                    Save
                                </button>
                                <button 
                                    type="button"
                                    onClick={() => setIsEditing(false)}
                                    style={{
                                        flex: 1,
                                        background: 'var(--background-secondary)',
                                        color: 'var(--text-normal)',
                                        border: '1px solid var(--background-modifier-border)',
                                        padding: '4px 8px',
                                        borderRadius: '4px',
                                        cursor: 'pointer',
                                        fontSize: '11px'
                                    }}
                                >
                                    Cancel
                                </button>
                            </div>
                        </form>
                    )}
                </div>
            )}
        </div>
    );
}

return { AlpacaKeyManager };
