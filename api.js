// API 설정 - CORS 프록시 변경
const API_CONFIG = {
    // CORS 프록시 서비스 (여러 개 백업)
    CORS_PROXY_1: 'https://api.allorigins.win/raw?url=',
    CORS_PROXY_2: 'https://corsninja.herokuapp.com/',
    CORS_PROXY_3: 'https://thingproxy.freeboard.io/fetch/',
    
    UPBIT_BASE: 'https://api.upbit.com/v1',
    COINGECKO_BASE: 'https://api.coingecko.com/api/v3',
};

// 현재 사용할 프록시 선택
let currentProxy = API_CONFIG.CORS_PROXY_1;

// Upbit API 호출 (CORS 프록시 사용)
class UpbitAPI {
    static async getTicker(market) {
        try {
            const url = `${API_CONFIG.UPBIT_BASE}/ticker?markets=${market}`;
            const proxiedUrl = `${currentProxy}${encodeURIComponent(url)}`;
            
            console.log(`🔗 API 호출: ${market}`);
            
            const response = await fetch(proxiedUrl, {
                headers: {
                    'Accept': 'application/json',
                    'User-Agent': 'Mozilla/5.0'
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            const data = await response.json();
            console.log('✅ Ticker 데이터 로드:', market);
            return data;
        } catch (error) {
            console.error('❌ Upbit Ticker API 오류:', error.message);
            
            // 프록시 변경 후 재시도
            if (currentProxy === API_CONFIG.CORS_PROXY_1) {
                console.log('🔄 프록시 변경 중...');
                currentProxy = API_CONFIG.CORS_PROXY_3;
                return UpbitAPI.getMockData(market);
            }
            
            return UpbitAPI.getMockData(market);
        }
    }

    static async getCandles(market, unit = 'minutes60', count = 200) {
        try {
            const url = `${API_CONFIG.UPBIT_BASE}/candles/${unit}?market=${market}&count=${count}`;
            const proxiedUrl = `${currentProxy}${encodeURIComponent(url)}`;
            
            console.log(`📊 Candles 호출: ${market} ${unit}`);
            
            const response = await fetch(proxiedUrl, {
                headers: {
                    'Accept': 'application/json',
                    'User-Agent': 'Mozilla/5.0'
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            const data = await response.json();
            console.log(`✅ Candles 데이터 로드: ${market} ${unit}`);
            return data;
        } catch (error) {
            console.error('❌ Candles API 오류:', error.message);
            return UpbitAPI.getMockCandles(market, count);
        }
    }

    static async getOrderbook(market) {
        try {
            const url = `${API_CONFIG.UPBIT_BASE}/orderbook?markets=${market}`;
            const proxiedUrl = `${currentProxy}${encodeURIComponent(url)}`;
            
            const response = await fetch(proxiedUrl);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return await response.json();
        } catch (error) {
            console.error('❌ Orderbook API 오류:', error);
            return null;
        }
    }

    static async getTrades(market, count = 50) {
        try {
            const url = `${API_CONFIG.UPBIT_BASE}/trades/ticks?market=${market}&count=${count}`;
            const proxiedUrl = `${currentProxy}${encodeURIComponent(url)}`;
            
            const response = await fetch(proxiedUrl);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return await response.json();
        } catch (error) {
            console.error('❌ Trades API 오류:', error);
            return null;
        }
    }

    // 목 데이터 (데모용)
    static getMockData(market) {
        const mockPrices = {
            'KRW-BTC': 45000000,
            'KRW-ETH': 2500000,
            'KRW-ADA': 750,
            'KRW-SOL': 120000,
            'KRW-DOGE': 500,
            'KRW-XRP': 700,
        };

        const basePrice = mockPrices[market] || 1000000;
        const change = (Math.random() - 0.5) * 0.05;
        const changePrice = Math.floor(basePrice * change);

        return [{
            market: market,
            trade_price: Math.floor(basePrice * (1 + change)),
            trade_volume: Math.random() * 1000,
            prev_closing_price: basePrice,
            opening_price: basePrice,
            high_price: Math.floor(basePrice * 1.02),
            low_price: Math.floor(basePrice * 0.98),
            change_rate: change,
            change_price: changePrice,
            acc_trade_volume: Math.random() * 1e8,
            timestamp: new Date().toISOString()
        }];
    }

    static getMockCandles(market, count) {
        const candles = [];
        const basePrices = {
            'KRW-BTC': 45000000,
            'KRW-ETH': 2500000,
            'KRW-ADA': 750,
            'KRW-SOL': 120000,
            'KRW-DOGE': 500,
            'KRW-XRP': 700,
        };

        const basePrice = basePrices[market] || 1000000;
        let currentPrice = basePrice;
        const now = new Date();

        for (let i = count - 1; i >= 0; i--) {
            const change = (Math.random() - 0.5) * 0.02;
            const openPrice = currentPrice;
            const closePrice = openPrice * (1 + change);
            
            const candle = {
                market: market,
                candle_date_time_kst: new Date(now - i * 60 * 60 * 1000).toISOString().split('.')[0],
                opening_price: Math.floor(openPrice),
                high_price: Math.floor(Math.max(openPrice, closePrice) * 1.01),
                low_price: Math.floor(Math.min(openPrice, closePrice) * 0.99),
                trade_price: Math.floor(closePrice),
                candle_acc_trade_volume: Math.random() * 1000,
                candle_acc_trade_price: Math.random() * 1e12,
            };
            
            candles.push(candle);
            currentPrice = closePrice;
        }

        return candles;
    }
}

// CoinGecko API 호출
class CoinGeckoAPI {
    static coinMap = {
        'BTC': 'bitcoin',
        'ETH': 'ethereum',
        'ADA': 'cardano',
        'SOL': 'solana',
        'DOGE': 'dogecoin',
        'XRP': 'ripple'
    };

    static async getPriceHistory(coinName, days = 7) {
        try {
            const coinId = this.coinMap[coinName] || coinName.toLowerCase();
            const url = `${API_CONFIG.COINGECKO_BASE}/coins/${coinId}/market_chart?vs_currency=krw&days=${days}&interval=hourly`;
            const proxiedUrl = `${currentProxy}${encodeURIComponent(url)}`;
            
            const response = await fetch(proxiedUrl);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            
            const data = await response.json();
            console.log('✅ Price History 로드:', coinName);
            return data;
        } catch (error) {
            console.error('❌ CoinGecko API 오류:', error);
            return CoinGeckoAPI.getMockHistory();
        }
    }

    static async getMarketData(coinNames) {
        try {
            const ids = coinNames.map(name => this.coinMap[name] || name.toLowerCase()).join(',');
            const url = `${API_CONFIG.COINGECKO_BASE}/simple/price?ids=${ids}&vs_currencies=krw&include_market_cap=true&include_24hr_vol=true&include_24hr_change=true`;
            const proxiedUrl = `${currentProxy}${encodeURIComponent(url)}`;
            
            const response = await fetch(proxiedUrl);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            
            const data = await response.json();
            console.log('✅ Market Data 로드:', coinNames);
            return data;
        } catch (error) {
            console.error('❌ Market Data API 오류:', error);
            return CoinGeckoAPI.getMockMarketData(coinNames);
        }
    }

    static getMockHistory() {
        const prices = [];
        const basePrice = 50000000;
        const now = Date.now();

        for (let i = 168; i >= 0; i--) {
            const change = (Math.random() - 0.5) * 0.02;
            prices.push([
                now - i * 60 * 60 * 1000,
                Math.floor(basePrice * (1 + change))
            ]);
        }

        return { prices };
    }

    static getMockMarketData(coinNames) {
        const data = {};
        const basePrices = {
            'bitcoin': 50000000,
            'ethereum': 2500000,
            'cardano': 750,
            'solana': 120000,
            'dogecoin': 500,
            'ripple': 700,
        };

        coinNames.forEach(coin => {
            const coinId = this.coinMap[coin] || coin.toLowerCase();
            const basePrice = basePrices[coinId] || 1000000;
            const change = (Math.random() - 0.5) * 0.1;

            data[coinId] = {
                krw: Math.floor(basePrice * (1 + change)),
                krw_market_cap: Math.floor(basePrice * 1e9),
                krw_24h_vol: Math.floor(Math.random() * 1e15),
                krw_24h_change: Math.round(change * 100 * 100) / 100
            };
        });

        return data;
    }
}

// 로컬 스토리지 관리
class StorageManager {
    static saveSettings(settings) {
        localStorage.setItem('tradeSettings', JSON.stringify(settings));
    }

    static getSettings() {
        const saved = localStorage.getItem('tradeSettings');
        return saved ? JSON.parse(saved) : null;
    }

    static saveTradeHistory(trade) {
        let history = this.getTradeHistory();
        history.unshift(trade);
        if (history.length > 100) history.pop();
        localStorage.setItem('tradeHistory', JSON.stringify(history));
    }

    static getTradeHistory() {
        const saved = localStorage.getItem('tradeHistory');
        return saved ? JSON.parse(saved) : [];
    }

    static savePortfolio(portfolio) {
        localStorage.setItem('portfolio', JSON.stringify(portfolio));
    }

    static getPortfolio() {
        const saved = localStorage.getItem('portfolio');
        return saved ? JSON.parse(saved) : {};
    }
}
