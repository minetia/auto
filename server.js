const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');
const http = require('http');
const WebSocket = require('ws');

const app = express();
const server = http.createServer(app);
const PORT = 3000;

// 미들웨어
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use(express.static(path.join(__dirname)));

// API 기본 URL
const UPBIT_API = 'https://api.upbit.com/v1';
const COINGECKO_API = 'https://api.coingecko.com/api/v3';

// ============ 캐시 시스템 ============
const cache = new Map();
const CACHE_TIME = 3000; // 3초

function getCachedData(key) {
    const cached = cache.get(key);
    if (cached && Date.now() - cached.timestamp < CACHE_TIME) {
        return cached.data;
    }
    cache.delete(key);
    return null;
}

function setCachedData(key, data) {
    cache.set(key, { data, timestamp: Date.now() });
}

// ============ Upbit API 프록시 ============

// 1. 현재가 조회 (캐시 적용)
app.get('/api/ticker', async (req, res) => {
    try {
        const { markets } = req.query;
        const cacheKey = `ticker-${markets}`;

        const cached = getCachedData(cacheKey);
        if (cached) {
            return res.json({ data: cached, cached: true, timestamp: Date.now() });
        }

        const response = await axios.get(
            `${UPBIT_API}/ticker?markets=${markets}`,
            {
                headers: {
                    'Accept': 'application/json',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                },
                timeout: 5000
            }
        );

        setCachedData(cacheKey, response.data);
        res.json({ data: response.data, cached: false, timestamp: Date.now() });
    } catch (error) {
        console.error('❌ Ticker API 오류:', error.message);
        res.status(500).json({ 
            error: 'Ticker 데이터 조회 실패',
            message: error.message 
        });
    }
});

// 2. 캔들 데이터 조회
app.get('/api/candles', async (req, res) => {
    try {
        const { market, unit, count } = req.query;
        const cacheKey = `candles-${market}-${unit}-${count}`;

        const cached = getCachedData(cacheKey);
        if (cached) {
            return res.json({ data: cached, cached: true });
        }

        const response = await axios.get(
            `${UPBIT_API}/candles/${unit}?market=${market}&count=${count}`,
            {
                headers: {
                    'Accept': 'application/json',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                },
                timeout: 5000
            }
        );

        setCachedData(cacheKey, response.data);
        res.json({ data: response.data, cached: false });
    } catch (error) {
        console.error('❌ Candles API 오류:', error.message);
        res.status(500).json({ 
            error: '캔들 데이터 조회 실패',
            message: error.message 
        });
    }
});

// 3. 호가 정보 조회
app.get('/api/orderbook', async (req, res) => {
    try {
        const { markets } = req.query;

        const response = await axios.get(
            `${UPBIT_API}/orderbook?markets=${markets}`,
            {
                headers: {
                    'Accept': 'application/json',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                },
                timeout: 5000
            }
        );

        res.json(response.data);
    } catch (error) {
        console.error('❌ Orderbook API 오류:', error.message);
        res.status(500).json({ 
            error: '호가 정보 조회 실패',
            message: error.message 
        });
    }
});

// 4. 거래 내역 조회
app.get('/api/trades', async (req, res) => {
    try {
        const { market, count } = req.query;

        const response = await axios.get(
            `${UPBIT_API}/trades/ticks?market=${market}&count=${count}`,
            {
                headers: {
                    'Accept': 'application/json',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                },
                timeout: 5000
            }
        );

        res.json(response.data);
    } catch (error) {
        console.error('❌ Trades API 오류:', error.message);
        res.status(500).json({ 
            error: '거래 내역 조회 실패',
            message: error.message 
        });
    }
});

// ============ CoinGecko API 프록시 ============

// 5. 가격 히스토리
app.get('/api/price-history', async (req, res) => {
    try {
        const { coinId, days } = req.query;
        const cacheKey = `history-${coinId}-${days}`;

        const cached = getCachedData(cacheKey);
        if (cached) {
            return res.json({ data: cached, cached: true });
        }

        const response = await axios.get(
            `${COINGECKO_API}/coins/${coinId}/market_chart?vs_currency=krw&days=${days}&interval=hourly`,
            { timeout: 5000 }
        );

        setCachedData(cacheKey, response.data);
        res.json({ data: response.data, cached: false });
    } catch (error) {
        console.error('❌ Price History API 오류:', error.message);
        res.status(500).json({ 
            error: '가격 히스토리 조회 실패',
            message: error.message 
        });
    }
});

// 6. 마켓 데이터
app.get('/api/market-data', async (req, res) => {
    try {
        const { ids } = req.query;
        const cacheKey = `market-${ids}`;

        const cached = getCachedData(cacheKey);
        if (cached) {
            return res.json({ data: cached, cached: true });
        }

        const response = await axios.get(
            `${COINGECKO_API}/simple/price?ids=${ids}&vs_currencies=krw&include_market_cap=true&include_24hr_vol=true&include_24hr_change=true`,
            { timeout: 5000 }
        );

        setCachedData(cacheKey, response.data);
        res.json({ data: response.data, cached: false });
    } catch (error) {
        console.error('❌ Market Data API 오류:', error.message);
        res.status(500).json({ 
            error: '마켓 데이터 조회 실패',
            message: error.message 
        });
    }
});

// ============ WebSocket 실시간 업데이트 ============

const wss = new WebSocket.Server({ server });

const clients = new Map(); // 클라이언트별 구독 정보
let upbitUpdateInterval = null;

wss.on('connection', (ws) => {
    console.log('✅ WebSocket 클라이언트 연결됨');

    const clientId = Math.random().toString(36).substr(2, 9);
    clients.set(clientId, { ws, subscriptions: new Set() });

    // 클라이언트로부터 메시지 수신
    ws.on('message', async (message) => {
        try {
            const data = JSON.parse(message);

            if (data.type === 'subscribe') {
                const { markets } = data;
                const clientData = clients.get(clientId);

                if (clientData) {
                    markets.forEach(market => {
                        clientData.subscriptions.add(market);
                    });

                    ws.send(JSON.stringify({
                        type: 'subscribed',
                        markets: Array.from(clientData.subscriptions)
                    }));

                    console.log(`📌 구독: ${Array.from(clientData.subscriptions).join(', ')}`);

                    // 첫 번째 구독 시 업데이트 시작
                    if (clients.size === 1) {
                        startUpbitUpdates();
                    }
                }
            }
        } catch (error) {
            console.error('❌ WebSocket 메시지 처리 오류:', error.message);
        }
    });

    ws.on('close', () => {
        clients.delete(clientId);
        console.log('❌ WebSocket 클라이언트 연결 해제');

        if (clients.size === 0) {
            stopUpbitUpdates();
        }
    });

    ws.on('error', (error) => {
        console.error('❌ WebSocket 오류:', error.message);
    });
});

// 업비트 실시간 업데이트
async function startUpbitUpdates() {
    if (upbitUpdateInterval) return;

    console.log('🚀 업비트 실시간 업데이트 시작');

    upbitUpdateInterval = setInterval(async () => {
        try {
            // 모든 구독 마켓 수집
            const allMarkets = new Set();
            clients.forEach(client => {
                client.subscriptions.forEach(market => {
                    allMarkets.add(market);
                });
            });

            if (allMarkets.size === 0) return;

            // 마켓 데이터 조회
            const markets = Array.from(allMarkets).join(',');
            const response = await axios.get(
                `${UPBIT_API}/ticker?markets=${markets}`,
                {
                    headers: {
                        'Accept': 'application/json',
                        'User-Agent': 'Mozilla/5.0'
                    },
                    timeout: 5000
                }
            );

            // 모든 클라이언트에 전송
            clients.forEach(client => {
                if (client.ws.readyState === WebSocket.OPEN) {
                    client.ws.send(JSON.stringify({
                        type: 'ticker',
                        data: response.data,
                        timestamp: Date.now()
                    }));
                }
            });
        } catch (error) {
            console.error('❌ 업비트 업데이트 오류:', error.message);
        }
    }, 2000); // 2초마다 업데이트
}

function stopUpbitUpdates() {
    if (upbitUpdateInterval) {
        clearInterval(upbitUpdateInterval);
        upbitUpdateInterval = null;
        console.log('🛑 업비트 실시간 업데이트 중지');
    }
}

// ============ 에러 처리 ============

app.use((err, req, res, next) => {
    console.error('❌ 서버 에러:', err);
    res.status(500).json({ 
        error: '서버 오류',
        message: err.message 
    });
});

// ============ 서버 시작 ============

server.listen(PORT, () => {
    console.log(`
╔════════════════════════════════════════════╗
║   🚀 업비트 자동 매매 서버 시작            ║
║   http://localhost:${PORT}                 ║
║   ✅ REST API 활성화                       ║
║   ✅ WebSocket 실시간 업데이트             ║
║   ✅ CORS 활성화                           ║
║   ✅ 캐싱 시스템 (3초)                     ║
╚════════════════════════════════════════════╝
    `);
});

module.exports = { app, server };
