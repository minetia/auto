// 자동 매매 엔진
class AutoTradingEngine {
    constructor() {
        this.isRunning = false;
        this.settings = null;
        this.currentPrice = 0;
        this.priceHistory = [];
        this.portfolio = StorageManager.getPortfolio();
        this.updateInterval = null;
    }

    // 설정 로드
    loadSettings(settings) {
        this.settings = settings;
    }

    // 자동 매매 시작
    async start(market, settings) {
        this.isRunning = true;
        this.settings = settings;

        console.log(`🚀 자동 매매 시작: ${market}`);

        // 실시간 가격 업데이트
        this.updateInterval = setInterval(() => this.checkTradingConditions(market), 5000);

        // 초기 가격 데이터 로드
        await this.updatePriceData(market);
    }

    // 자동 매매 중지
    stop() {
        this.isRunning = false;
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }
        console.log('🛑 자동 매매 중지');
    }

    // 가격 데이터 업데이트
    async updatePriceData(market) {
        const candles = await UpbitAPI.getCandles(market);
        if (candles && candles.length > 0) {
            this.priceHistory = candles.reverse();
            this.currentPrice = this.priceHistory[this.priceHistory.length - 1].trade_price;
        }
    }

    // 거래 조건 확인
    async checkTradingConditions(market) {
        if (!this.isRunning || !this.settings) return;

        await this.updatePriceData(market);

        const strategy = this.settings.strategy;
        let shouldBuy = false;
        let shouldSell = false;

        switch (strategy) {
            case 'price':
                ({ shouldBuy, shouldSell } = this.checkPriceStrategy());
                break;
            case 'rsi':
                ({ shouldBuy, shouldSell } = this.checkRSIStrategy());
                break;
            case 'ma':
                ({ shouldBuy, shouldSell } = this.checkMAStrategy());
                break;
            case 'macd':
                ({ shouldBuy, shouldSell } = this.checkMACDStrategy());
                break;
        }

        if (shouldBuy) {
            await this.executeBuy(market);
        }

        if (shouldSell) {
            await this.executeSell(market);
        }
    }

    // 특정 가격 전략
    checkPriceStrategy() {
        const buyPrice = parseFloat(this.settings.buyPrice);
        const sellPrice = parseFloat(this.settings.sellPrice);

        return {
            shouldBuy: this.currentPrice <= buyPrice && !this.isHolding(),
            shouldSell: this.currentPrice >= sellPrice && this.isHolding()
        };
    }

    // RSI 전략
    checkRSIStrategy() {
        const rsi = this.calculateRSI(14);
        return {
            shouldBuy: rsi < 30 && !this.isHolding(),
            shouldSell: rsi > 70 && this.isHolding()
        };
    }

    // 이동평균선 전략
    checkMAStrategy() {
        const sma20 = this.calculateSMA(20);
        const sma50 = this.calculateSMA(50);

        return {
            shouldBuy: sma20 > sma50 && !this.isHolding(),
            shouldSell: sma20 < sma50 && this.isHolding()
        };
    }

    // MACD 전략
    checkMACDStrategy() {
        const { macd, signal } = this.calculateMACD();
        return {
            shouldBuy: macd > signal && !this.isHolding(),
            shouldSell: macd < signal && this.isHolding()
        };
    }

    // RSI 계산
    calculateRSI(period = 14) {
        if (this.priceHistory.length < period) return 50;

        const closes = this.priceHistory.map(c => c.trade_price);
        const gains = [];
        const losses = [];

        for (let i = 1; i < closes.length; i++) {
            const diff = closes[i] - closes[i - 1];
            gains.push(diff > 0 ? diff : 0);
            losses.push(diff < 0 ? -diff : 0);
        }

        const avgGain = gains.slice(-period).reduce((a, b) => a + b, 0) / period;
        const avgLoss = losses.slice(-period).reduce((a, b) => a + b, 0) / period;

        const rs = avgGain / (avgLoss || 1);
        const rsi = 100 - (100 / (1 + rs));

        return rsi;
    }

    // SMA 계산
    calculateSMA(period) {
        if (this.priceHistory.length < period) return this.currentPrice;

        const closes = this.priceHistory.map(c => c.trade_price);
        const sum = closes.slice(-period).reduce((a, b) => a + b, 0);
        return sum / period;
    }

    // MACD 계산
    calculateMACD() {
        const ema12 = this.calculateEMA(12);
        const ema26 = this.calculateEMA(26);
        const macd = ema12 - ema26;

        // Signal line (9일 EMA)
        const closes = this.priceHistory.map(c => c.trade_price);
        const macdLine = [];
        for (let i = 26; i < closes.length; i++) {
            const ema12_temp = this.calculateEMA(12, i);
            const ema26_temp = this.calculateEMA(26, i);
            macdLine.push(ema12_temp - ema26_temp);
        }

        const signal = this.calculateEMA(9, this.priceHistory.length - 1, macdLine);

        return { macd, signal };
    }

    // EMA 계산
    calculateEMA(period, endIndex = null, data = null) {
        const source = data || this.priceHistory.map(c => c.trade_price);
        const prices = endIndex ? source.slice(0, endIndex + 1) : source;

        if (prices.length === 0) return 0;

        const k = 2 / (period + 1);
        let ema = prices[0];

        for (let i = 1; i < prices.length; i++) {
            ema = prices[i] * k + ema * (1 - k);
        }

        return ema;
    }

    // 매수 실행
    async executeBuy(market) {
        const amount = this.settings.tradeAmount || 
                      this.settings.investAmount / this.currentPrice;

        const trade = {
            coin: this.settings.coinName,
            type: '매수',
            price: this.currentPrice,
            amount: amount,
            total: this.currentPrice * amount,
            status: '완료',
            timestamp: new Date().toLocaleTimeString('ko-KR')
        };

        // 포트폴리오 업데이트
        this.addToPortfolio(this.settings.coinName, amount, this.currentPrice);

        // 거래 내역 저장
        StorageManager.saveTradeHistory(trade);

        // 손절매 체크 시작
        this.startStopLossCheck(market, trade);

        console.log(`✅ 매수: ${this.settings.coinName} ${amount}개 @ ${this.currentPrice}`);
    }

    // 매도 실행
    async executeSell(market) {
        const holding = this.portfolio[this.settings.coinName];
        if (!holding) return;

        const trade = {
            coin: this.settings.coinName,
            type: '매도',
            price: this.currentPrice,
            amount: holding.amount,
            total: this.currentPrice * holding.amount,
            status: '완료',
            timestamp: new Date().toLocaleTimeString('ko-KR')
        };

        // 수익률 계산
        const profitRate = ((this.currentPrice - holding.avgPrice) / holding.avgPrice) * 100;
        const profit = this.currentPrice * holding.amount - holding.avgPrice * holding.amount;

        // 포트폴리오에서 제거
        delete this.portfolio[this.settings.coinName];
        StorageManager.savePortfolio(this.portfolio);

        // 거래 내역 저장
        StorageManager.saveTradeHistory(trade);

        console.log(`✅ 매도: ${this.settings.coinName} ${holding.amount}개 @ ${this.currentPrice} (수익률: ${profitRate.toFixed(2)}%)`);
    }

    // 손절매 체크
    startStopLossCheck(market, trade) {
        const buyPrice = this.currentPrice;
        const stopLossPercent = this.settings.stopLoss || 5;
        const takeProfitPercent = this.settings.takeProfit || 10;

        const stopLossPrice = buyPrice * (1 - stopLossPercent / 100);
        const takeProfitPrice = buyPrice * (1 + takeProfitPercent / 100);

        const checkInterval = setInterval(() => {
            if (!this.isRunning) {
                clearInterval(checkInterval);
                return;
            }

            if (this.currentPrice <= stopLossPrice) {
                console.warn(`⚠️ 손절매 발동: ${this.settings.coinName}`);
                this.executeSell(market);
                clearInterval(checkInterval);
            } else if (this.currentPrice >= takeProfitPrice) {
                console.log(`💰 이익실현 발동: ${this.settings.coinName}`);
                this.executeSell(market);
                clearInterval(checkInterval);
            }
        }, 5000);
    }

    // 포트폴리오 추가
    addToPortfolio(coin, amount, price) {
        if (this.portfolio[coin]) {
            const existing = this.portfolio[coin];
            const newAmount = existing.amount + amount;
            const newAvgPrice = (existing.avgPrice * existing.amount + price * amount) / newAmount;
            this.portfolio[coin] = { amount: newAmount, avgPrice: newAvgPrice };
        } else {
            this.portfolio[coin] = { amount, avgPrice: price };
        }
        StorageManager.savePortfolio(this.portfolio);
    }

    // 보유 여부 확인
    isHolding() {
        return !!this.portfolio[this.settings.coinName];
    }

    // 포트폴리오 조회
    getPortfolio() {
        return this.portfolio;
    }
}

const tradingEngine = new AutoTradingEngine();
