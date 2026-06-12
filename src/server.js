/* eslint-disable */
/**
 * Headless Server Execution Script
 * Run this directly on any server: `node src/server.js`
 */
const WebSocket = require('ws'); // Standard Node ws package
const mathUtils = require('./utils/math.js');
const TradingEngine = require('./utils/TradingEngine.js');

// Load API keys and risk options from environment
const ALPACA_KEY = process.env.ALPACA_PAPER_KEY || '';
const ALPACA_SECRET = process.env.ALPACA_PAPER_SECRET || '';
const DEFAULT_TRADE_QTY = process.env.ALPACA_TRADE_QTY || '';
const DEFAULT_TRADE_SIZE_USD = parseFloat(process.env.ALPACA_TRADE_SIZE_USD || '1000');
const SLIPPAGE_TOLERANCE = parseFloat(process.env.ALPACA_SLIPPAGE_TOLERANCE || '0.0005'); // default 0.05%

console.log("Initializing Headless Lead-Lag Correlation Engine...");
console.log(`Execution Mode: ${ALPACA_KEY ? 'ALPACA PAPER TRADING ACTIVE' : 'LOCAL SIMULATION MODE (NO KEYS)'}`);
console.log(`Risk Settings: Qty Override [${DEFAULT_TRADE_QTY}], Default Size USD [${DEFAULT_TRADE_SIZE_USD}], Slippage Tolerance [${SLIPPAGE_TOLERANCE * 100}%]`);

const engine = new TradingEngine(mathUtils, {
    correlationThreshold: 0.85,
    minOFI: 5.0,
    signalCooldownMs: 5000
});

// Callback for executions
const handleSignal = async (direction, price, confidence, lag) => {
    // Calculate execution limit price with slippage offset
    const limitPrice = direction === 'LONG' 
        ? price * (1 + SLIPPAGE_TOLERANCE) 
        : price * (1 - SLIPPAGE_TOLERANCE);

    // Calculate dynamic size
    const qty = DEFAULT_TRADE_QTY || (DEFAULT_TRADE_SIZE_USD / price).toFixed(2);

    console.log(`\n🚨 SIGNAL GENERATED: ${direction} SOL (Price: $${price.toFixed(3)}, Limit: $${limitPrice.toFixed(3)}, Qty: ${qty}, CCF Peak: ${(confidence * 100).toFixed(1)}%, Lag: ${lag}s)`);
    
    if (!ALPACA_KEY || !ALPACA_SECRET) {
        console.log(`  [SIMULATION] Simulated trade success: ${direction} ${qty} SOL at execution limit $${limitPrice.toFixed(3)}.`);
        return;
    }

    try {
        const side = direction === 'LONG' ? 'buy' : 'sell';
        const response = await fetch('https://paper-api.alpaca.markets/v2/orders', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'APCA-API-KEY-ID': ALPACA_KEY,
                'APCA-API-SECRET-KEY': ALPACA_SECRET
            },
            body: JSON.stringify({
                symbol: 'SOL/USD',
                qty: qty.toString(),
                side: side,
                type: 'limit',
                time_in_force: 'ioc',
                limit_price: limitPrice.toFixed(3)
            })
        });

        if (response.ok) {
            const data = await response.json();
            console.log(`  [ALPACA] Order placed successfully. Order ID: ${data.id}`);
        } else {
            const err = await response.json();
            console.error(`  [ALPACA ERROR] Order failed:`, err.message || JSON.stringify(err));
        }
    } catch (e) {
        console.error(`  [API ERROR] Fetch failed:`, e.message);
    }
};

const leadSymbol = 'btcusdt';
const lagSymbol = 'solusdt';
let ws;
let isClosed = false;
let receivedMessage = false;
let currentHost = 'stream.binance.com:9443';
let reconnectDelay = 1000;

const connect = () => {
    if (isClosed) return;

    const hostLeadSymbol = currentHost.includes('binance.us') ? leadSymbol.replace('usdt', 'usd') : leadSymbol;
    const hostLagSymbol = currentHost.includes('binance.us') ? lagSymbol.replace('usdt', 'usd') : lagSymbol;
    const wsUrl = `wss://${currentHost}/stream?streams=${hostLeadSymbol}@trade/${hostLeadSymbol}@bookTicker/${hostLagSymbol}@trade/${hostLagSymbol}@bookTicker`;

    console.log(`Connecting to Binance WebSocket: ${wsUrl}`);
    ws = new WebSocket(wsUrl);

    // 5-second watchdog for initial connection hang
    const connectionTimeout = setTimeout(() => {
        if (ws && ws.readyState === WebSocket.CONNECTING) {
            console.warn(`Connection to ${currentHost} timed out. Forcing fallback...`);
            ws.terminate();
        }
    }, 5000);

    ws.on('open', () => {
        clearTimeout(connectionTimeout);
        receivedMessage = false;
        reconnectDelay = 1000;
        console.log(`WebSocket connected successfully to: ${currentHost}`);
    });

    ws.on('message', (rawData) => {
        try {
            receivedMessage = true;
            const message = JSON.parse(rawData.toString());
            if (!message.data) return;
            
            const { stream, data } = message;
            const isLead = stream.startsWith(hostLeadSymbol);
            const asset = isLead ? 'lead' : 'lag';

            if (data.e === 'trade') {
                engine.feedTrade(
                    asset,
                    parseFloat(data.p),
                    parseFloat(data.q),
                    data.m
                );
            } else if (!data.e) {
                engine.feedOrderBook(
                    asset,
                    parseFloat(data.b),
                    parseFloat(data.B),
                    parseFloat(data.a),
                    parseFloat(data.A)
                );
            }
        } catch (err) {
            console.error("Error parsing WebSocket message:", err);
        }
    });

    ws.on('close', () => {
        clearTimeout(connectionTimeout);
        console.log(`Binance WS Closed (${currentHost})`);
        
        if (!receivedMessage && currentHost === 'stream.binance.com:9443') {
            console.warn("No data received. Falling back to Binance US...");
            currentHost = 'stream.binance.us:9443';
            setTimeout(connect, 1000);
        } else {
            // Apply exponential backoff reconnection
            console.log(`Reconnecting to ${currentHost} in ${(reconnectDelay / 1000).toFixed(1)}s...`);
            setTimeout(connect, reconnectDelay);
            reconnectDelay = Math.min(reconnectDelay * 2, 30000); // Caps backoff at 30 seconds
        }
    });

    ws.on('error', (err) => {
        clearTimeout(connectionTimeout);
        console.error(`Binance WS Error (${currentHost}):`, err.message || err);
    });
};

// Start calculation updates every 1s
setInterval(() => {
    const update = engine.checkSignalAndTrigger(handleSignal);
    if (update.correlationPeak > 0) {
        process.stdout.write(`\rCCF Peak: ${(update.correlationPeak * 100).toFixed(1)}% | Optimal Lag: ${update.optimalLagIndex} ticks | Lead OFI: ${update.recentOFI.toFixed(1)}`);
    }
}, 1000);

connect();
