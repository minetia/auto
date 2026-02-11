// =====================
// 암호화폐 자동매매 시뮬레이터
// =====================

class CryptoSimulator {
    constructor() {
        this.priceData = [];
        this.trades = [];
        this.balance = 0;
        this.holdings = 0;
        this.equity = [];
        this.selectedStrategy = 'ensemble';
        this.strategySignals = [];
    }

    // 현실적인 가격 데이터 생성 (기하 브라운 운동)
    generatePriceData(days, startPrice = 50000) {
        this.priceData = [];
        let price = startPrice;
        const volatility = 0.025;
        const drift = 0.0001;

        for (let i = 0; i < days * 24; i++) {
            const randomChange = (Math.random() - 0.5) * 2 * volatility;
            const change = drift + randomChange;
            price = price * (1 + change);
            price = Math.max(price, 100);

            const open = price * (1 + (Math.random() - 0.5) * 0.005);
            const high = Math.max(price, open) * (1 + Math.abs(Math.random() * 0.02));
            const low = Math.min(price, open) * (1 - Math.abs(Math.random() * 0.02));

            this.priceData.push({
                timestamp: new Date(Date.now() - (days * 24 - i) * 3600000),
                open: open,
                high: high,
                low: low,
                close: price,
                volume: Math.random() * 1000000
            });
        }
        return this.priceData;
    }

    // ===== 전략 =====

    strategySMA(fastPeriod = 9, slowPeriod = 21) {
        const signals = [];
        const prices = this.priceData.map(p => p.close);
        const fastSMA = this.calculateSMA(prices, fastPeriod);
        const slowSMA = this.calculateSMA(prices, slowPeriod);

        for (let i = 1; i < this.priceData.length; i++) {
            if (fastSMA[i] && slowSMA[i] && fastSMA[i-1] && slowSMA[i-1]) {
                if (fastSMA[i] > slowSMA[i] && fastSMA[i-1] <= slowSMA[i-1]) {
                    signals.push({ index: i, signal: 'BUY', strength: 0.7 });
                } else if (fastSMA[i] < slowSMA[i] && fastSMA[i-1] >= slowSMA[i-1]) {
                    signals.push({ index: i, signal: 'SELL', strength: 0.7 });
                }
            }
        }
        return signals;
    }

    strategyRSI(period = 14) {
        const signals = [];
        const prices = this.priceData.map(p => p.close);
        const rsi = this.calculateRSI(prices, period);

        for (let i = 1; i < rsi.length; i++) {
            if (rsi[i] !== null && rsi[i-1] !== null) {
                if (rsi[i] < 30 && rsi[i-1] >= 30) {
                    signals.push({ index: i, signal: 'BUY', strength: 0.8 });
                } else if (rsi[i] > 70 && rsi[i-1] <= 70) {
                    signals.push({ index: i, signal: 'SELL', strength: 0.8 });
                }
            }
        }
        return signals;
    }

    strategyMACD() {
        const signals = [];
        const prices = this.priceData.map(p => p.close);
        const macd = this.calculateMACD(prices);

        for (let i = 1; i < macd.length; i++) {
            if (macd[i].histogram !== null && macd[i-1].histogram !== null) {
                if (macd[i].histogram > 0 && macd[i-1].histogram <= 0) {
                    signals.push({ index: i, signal: 'BUY', strength: 0.75 });
                } else if (macd[i].histogram < 0 && macd[i-1].histogram >= 0) {
                    signals.push({ index: i, signal: 'SELL', strength: 0.75 });
                }
            }
        }
        return signals;
    }

    strategyBollingerBands(period = 20, stdDevMultiplier = 2) {
        const signals = [];
        const prices = this.priceData.map(p => p.close);
        const bb = this.calculateBollingerBands(prices, period, stdDevMultiplier);

        for (let i = 1; i < this.priceData.length; i++) {
            if (bb[i].lower && bb[i].upper) {
                if (prices[i] < bb[i].lower && prices[i-1] >= bb[i-1].lower) {
                    signals.push({ index: i, signal: 'BUY', strength: 0.65 });
                } else if (prices[i] > bb[i].upper && prices[i-1] <= bb[i-1].upper) {
                    signals.push({ index: i, signal: 'SELL', strength: 0.65 });
                }
            }
        }
        return signals;
    }

    strategyATR(period = 14) {
        const signals = [];
        const atr = this.calculateATR(this.priceData, period);
        const prices = this.priceData.map(p => p.close);
        const sma = this.calculateSMA(prices, period);

        for (let i = period; i < this.priceData.length; i++) {
            if (atr[i] && sma[i]) {
                const upperBand = sma[i] + (atr[i] * 1.5);
                const lowerBand = sma[i] - (atr[i] * 1.5);

                if (prices[i] > upperBand && prices[i-1] <= upperBand) {
                    signals.push({ index: i, signal: 'BUY', strength: 0.6 });
                } else if (prices[i] < lowerBand && prices[i-1] >= lowerBand) {
                    signals.push({ index: i, signal: 'SELL', strength: 0.6 });
                }
            }
        }
        return signals;
    }

    strategyEnsemble() {
        const allStrategies = [
            this.strategySMA(),
            this.strategyRSI(),
            this.strategyMACD(),
            this.strategyBollingerBands(),
            this.strategyATR()
        ];

        const allSignals = allStrategies.flat();
        const signalMap = new Map();

        for (const sig of allSignals) {
            if (!signalMap.has(sig.index)) {
                signalMap.set(sig.index, { buyScore: 0, sellScore: 0 });
            }
            const current = signalMap.get(sig.index);
            if (sig.signal === 'BUY') {
                current.buyScore += sig.strength;
            } else {
                current.sellScore += sig.strength;
            }
        }

        const signals = [];
        for (const [index, scores] of signalMap) {
            const buyThreshold = 2.0;
            const sellThreshold = 2.0;

            if (scores.buyScore >= buyThreshold && scores.buyScore > scores.sellScore) {
                signals.push({ 
                    index, 
                    signal: 'BUY', 
                    strength: Math.min(scores.buyScore / 5, 1) 
                });
            } else if (scores.sellScore >= sellThreshold && scores.sellScore > scores.buyScore) {
                signals.push({ 
                    index, 
                    signal: 'SELL', 
                    strength: Math.min(scores.sellScore / 5, 1) 
                });
            }
        }

        return signals.sort((a, b) => a.index - b.index);
    }

    // ===== 기술적 지표 =====

    calculateSMA(prices, period) {
        const sma = [];
        for (let i = 0; i < prices.length; i++) {
            if (i < period) {
                sma.push(null);
            } else {
                const sum = prices.slice(i - period, i).reduce((a, b) => a + b, 0);
                sma.push(sum / period);
            }
        }
        return sma;
    }

    calculateEMA(prices, period) {
        const ema = [];
        const k = 2 / (period + 1);

        for (let i = 0; i < prices.length; i++) {
            if (i === 0) {
                ema.push(prices[i]);
            } else {
                ema.push(prices[i] * k + ema[i-1] * (1 - k));
            }
        }
        return ema;
    }

    calculateRSI(prices, period = 14) {
        const rsi = [];
        const changes = [];

        for (let i = 1; i < prices.length; i++) {
            changes.push(prices[i] - prices[i-1]);
        }

        let avgGain = 0;
        let avgLoss = 0;

        for (let i = 0; i < period; i++) {
            if (changes[i] > 0) avgGain += changes[i];
            else avgLoss += Math.abs(changes[i]);
        }

        avgGain /= period;
        avgLoss /= period;

        rsi.push(null);

        for (let i = period; i < changes.length; i++) {
            const change = changes[i];
            if (change > 0) {
                avgGain = (avgGain * (period - 1) + change) / period;
                avgLoss = (avgLoss * (period - 1)) / period;
            } else {
                avgGain = (avgGain * (period - 1)) / period;
                avgLoss = (avgLoss * (period - 1) + Math.abs(change)) / period;
            }

            const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
            const rsiValue = 100 - (100 / (1 + rs));
            rsi.push(rsiValue);
        }

        return rsi;
    }

    calculateMACD(prices) {
        const ema12 = this.calculateEMA(prices, 12);
        const ema26 = this.calculateEMA(prices, 26);
        const macd = [];

        for (let i = 0; i < prices.length; i++) {
            macd.push({
                macdLine: (ema12[i] - ema26[i]) || null,
                signal: null,
                histogram: null
            });
        }

        const signalLine = this.calculateEMA(macd.map(m => m.macdLine).filter(v => v !== null), 9);
        let signalIndex = 0;

        for (let i = 0; i < macd.length; i++) {
            if (macd[i].macdLine !== null) {
                if (signalIndex < signalLine.length) {
                    macd[i].signal = signalLine[signalIndex];
                    macd[i].histogram = macd[i].macdLine - macd[i].signal;
                    signalIndex++;
                }
            }
        }

        return macd;
    }

    calculateBollingerBands(prices, period = 20, stdDev = 2) {
        const sma = this.calculateSMA(prices, period);
        const bands = [];

        for (let i = 0; i < prices.length; i++) {
            if (i < period || !sma[i]) {
                bands.push({ upper: null, middle: null, lower: null });
                continue;
            }

            const slice = prices.slice(i - period, i);
            const mean = sma[i];
            const variance = slice.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / period;
            const std = Math.sqrt(variance);

            bands.push({
                upper: mean + (std * stdDev),
                middle: mean,
                lower: mean - (std * stdDev)
            });
        }
        return bands;
    }

    calculateATR(priceData, period = 14) {
        const atr = [];
        const tr = [];

        for (let i = 1; i < priceData.length; i++) {
            const high = priceData[i].high;
            const low = priceData[i].low;
            const prevClose = priceData[i-1].close;

            const tr1 = high - low;
            const tr2 = Math.abs(high - prevClose);
            const tr3 = Math.abs(low - prevClose);
            tr.push(Math.max(tr1, tr2, tr3));
        }

        for (let i = 0; i < tr.length; i++) {
            if (i < period - 1) {
                atr.push(null);
            } else if (i === period - 1) {
                const sum = tr.slice(0, period).reduce((a, b) => a + b, 0);
                atr.push(sum / period);
            } else {
                atr.push((atr[i-1] * (period - 1) + tr[i]) / period);
            }
        }

        return atr;
    }

    // ===== 백테스팅 =====

    backtest(initialBalance, stopLoss, takeProfit, riskPerTrade) {
        this.balance = initialBalance;
        this.holdings = 0;
        this.trades = [];
        this.equity = [initialBalance];

        this.strategySignals = this.getStrategySignals();
        let entryPrice = null;

        for (let i = 0; i < this.priceData.length; i++) {
            const currentPrice = this.priceData[i].close;
            const signal = this.strategySignals.find(s => s.index === i);

            // 손절매/익절매
            if (this.holdings > 0 && entryPrice) {
                const profitPercent = ((currentPrice - entryPrice) / entryPrice) * 100;

                if (profitPercent <= -stopLoss) {
                    this.executeSell(i, currentPrice, 'STOP_LOSS');
                    this.holdings = 0;
                    entryPrice = null;
                } else if (profitPercent >= takeProfit) {
                    this.executeSell(i, currentPrice, 'TAKE_PROFIT');
                    this.holdings = 0;
                    entryPrice = null;
                }
            }

            // 신호 처리
            if (signal) {
                if (signal.signal === 'BUY' && this.holdings === 0) {
                    const tradeSize = (this.balance * riskPerTrade) / 100 / currentPrice;
                    this.holdings = tradeSize;
                    entryPrice = currentPrice;
                    this.balance -= tradeSize * currentPrice;

                    this.trades.push({
                        index: i,
                        time: this.priceData[i].timestamp,
                        type: 'BUY',
                        price: currentPrice,
                        amount: tradeSize,
                        cost: tradeSize * currentPrice
                    });
                }
                else if (signal.signal === 'SELL' && this.holdings > 0) {
                    this.executeSell(i, currentPrice, 'SIGNAL');
                    this.holdings = 0;
                    entryPrice = null;
                }
            }

            const currentEquity = this.balance + (this.holdings * currentPrice);
            this.equity.push(currentEquity);
        }

        // 마지막 포지션 정리
        if (this.holdings > 0) {
            const finalPrice = this.priceData[this.priceData.length - 1].close;
            this.executeSell(this.priceData.length - 1, finalPrice, 'FINAL');
            this.equity[this.equity.length - 1] = this.balance;
        }

        return this.calculateMetrics(initialBalance);
    }

    executeSell(index, price, reason) {
        const revenue = this.holdings * price;
        this.balance += revenue;

        this.trades.push({
            index: index,
            time: this.priceData[index].timestamp,
            type: 'SELL',
            price: price,
            amount: this.holdings,
            revenue: revenue,
            reason: reason
        });
    }

    getStrategySignals() {
        switch(this.selectedStrategy) {
            case 'sma': return this.strategySMA();
            case 'rsi': return this.strategyRSI();
            case 'macd': return this.strategyMACD();
            case 'bb': return this.strategyBollingerBands();
            case 'atr': return this.strategyATR();
            case 'ensemble': return this.strategyEnsemble();
            default: return this.strategyEnsemble();
        }
    }

    calculateMetrics(initialBalance) {
        const finalBalance = this.equity[this.equity.length - 1];
        const returns = ((finalBalance - initialBalance) / initialBalance) * 100;

        const buyTrades = this.trades.filter(t => t.type === 'BUY');
        const sellTrades = this.trades.filter(t => t.type === 'SELL');

        let winningTrades = 0;
        let profitLossPairs = [];

        for (let i = 0; i < buyTrades.length; i++) {
            const buyTrade = buyTrades[i];
            const correspondingSell = sellTrades.find(s => s.index > buyTrade.index);

            if (correspondingSell) {
                const profit = ((correspondingSell.revenue - buyTrade.cost) / buyTrade.cost) * 100;
                profitLossPairs.push(profit);
                if (profit > 0) winningTrades++;
            }
        }

        let maxDrawdown = 0;
        let peak = this.equity[0];
        for (const eq of this.equity) {
            if (eq > peak) peak = eq;
            const drawdown = ((peak - eq) / peak) * 100;
            if (drawdown > maxDrawdown) maxDrawdown = drawdown;
        }

        const returns_arr = [];
        for (let i = 1; i < this.equity.length; i++) {
            returns_arr.push((this.equity[i] - this.equity[i-1]) / this.equity[i-1]);
        }
        const avgReturn = returns_arr.reduce((a, b) => a + b, 0) / returns_arr.length || 0;
        const variance = returns_arr.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns_arr.length;
        const stdDev = Math.sqrt(variance);
        const sharpeRatio = stdDev !== 0 ? (avgReturn / stdDev) * Math.sqrt(252) : 0;

        const grossProfit = profitLossPairs.filter(p => p > 0).reduce((a, b) => a + b, 0) || 0;
        const grossLoss = Math.abs(profitLossPairs.filter(p => p < 0).reduce((a, b) => a + b, 0)) || 1;
        const profitFactor = grossProfit / grossLoss;

        return {
            finalBalance: finalBalance,
            returns: returns,
            totalTrades: buyTrades.length,
            winRate: buyTrades.length > 0 ? (winningTrades / buyTrades.length) * 100 : 0,
            maxDrawdown: maxDrawdown,
            sharpeRatio: sharpeRatio,
            profitFactor: isFinite(profitFactor) ? profitFactor : 0,
            avgReturn: (avgReturn * 100),
            profitLossPairs: profitLossPairs
        };
    }
}

// =====================
// UI 컨트롤러
// =====================

class SimulatorUI {
    constructor() {
        this.simulator = new CryptoSimulator();
        this.chart = null;
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.initChart();
    }

    setupEventListeners() {
        document.getElementById('runBtn').addEventListener('click', () => this.runSimulation());
        document.getElementById('resetBtn').addEventListener('click', () => this.reset());

        // 전략 선택
        document.querySelectorAll('.strategy-card').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const card = e.currentTarget;
                document.querySelectorAll('.strategy-card').forEach(b => b.classList.remove('active'));
                card.classList.add('active');
                this.simulator.selectedStrategy = card.dataset.strategy;
            });
        });

        // 기간 슬라이더
        const periodSlider = document.getElementById('period');
        const periodNumber = document.getElementById('periodValue');
        periodSlider.addEventListener('input', (e) => {
            periodNumber.value = e.target.value;
        });
        periodNumber.addEventListener('input', (e) => {
            periodSlider.value = e.target.value;
        });

        // 위험률 슬라이더
        document.getElementById('riskPerTrade').addEventListener('input', (e) => {
            document.getElementById('riskDisplay').textContent = e.target.value;
        });

        // 필터 버튼
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.filterTrades(e.target.dataset.filter);
            });
        });

        // 탭
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                // 탭 전환 로직 (필요시 구현)
            });
        });
    }

    initChart() {
        const ctx = document.getElementById('priceChart').getContext('2d');
        this.chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [
                    {
                        label: 'Price',
                        data: [],
                        borderColor: '#667eea',
                        backgroundColor: 'rgba(102, 126, 234, 0.1)',
                        borderWidth: 2.5,
                        fill: true,
                        tension: 0.4,
                        pointRadius: 0,
                        pointHoverRadius: 6,
                        yAxisID: 'y',
                        segment: {
                            borderColor: ctx => ctx.p0DataIndex === -1 ? '#667eea' : '#667eea'
                        }
                    },
                    {
                        label: 'Portfolio Value',
                        data: [],
                        borderColor: '#38ef7d',
                        backgroundColor: 'rgba(56, 239, 125, 0.05)',
                        borderWidth: 2.5,
                        fill: false,
                        tension: 0.4,
                        pointRadius: 0,
                        pointHoverRadius: 6,
                        yAxisID: 'y1'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                plugins: {
                    legend: {
                        labels: {
                            color: '#b0b8d4',
                            font: { size: 12, weight: '600' },
                            boxWidth: 12,
                            padding: 15,
                            usePointStyle: true,
                            pointStyle: 'circle'
                        }
                    },
                    filler: {
                        propagate: true
                    }
                },
                scales: {
                    y: {
                        type: 'linear',
                        position: 'left',
                        ticks: {
                            color: '#7a8399',
                            font: { size: 11, weight: '500' },
                            callback: function(value) {
                                return '$' + value.toFixed(0);
                            }
                        },
                        grid: {
                            color: 'rgba(45, 53, 84, 0.5)',
                            drawBorder: false
                        }
                    },
                    y1: {
                        type: 'linear',
                        position: 'right',
                        ticks: {
                            color: '#7a8399',
                            font: { size: 11, weight: '500' },
                            callback: function(value) {
                                return '$' + value.toFixed(0);
                            }
                        },
                        grid: { drawOnChartArea: false }
                    },
                    x: {
                        ticks: {
                            color: '#7a8399',
                            font: { size: 11, weight: '500' }
                        },
                        grid: {
                            color: 'rgba(45, 53, 84, 0.5)',
                            drawBorder: false
                        }
                    }
                }
            }
        });
    }

    async runSimulation() {
        const runBtn = document.getElementById('runBtn');
        const spinner = document.getElementById('loadingSpinner');
        const noDataMsg = document.getElementById('noDataMessage');

        runBtn.disabled = true;
        spinner.classList.remove('hidden');
        noDataMsg.classList.add('hidden');

        try {
            const initialBalance = parseFloat(document.getElementById('initialBalance').value);
            const period = parseFloat(document.getElementById('period').value);
            const stopLoss = parseFloat(document.getElementById('stopLoss').value);
            const takeProfit = parseFloat(document.getElementById('takeProfit').value);
            const riskPerTrade = parseFloat(document.getElementById('riskPerTrade').value);

            // 검증
            if (!initialBalance || initialBalance < 100) {
                this.showToast('Initial capital must be at least $100', 'error');
                return;
            }
            if (!period || period < 7) {
                this.showToast('Backtest period must be at least 7 days', 'error');
                return;
            }

            // 비동기 처리
            await new Promise(resolve => setTimeout(resolve, 500));

            this.simulator.generatePriceData(period);
            const metrics = this.simulator.backtest(initialBalance, stopLoss, takeProfit, riskPerTrade);

            this.updateChart();
            this.displayResults(metrics);
            this.displayTrades();
            this.showToast('Simulation completed successfully!', 'success');
        } catch (error) {
            console.error('Simulation error:', error);
            this.showToast('Error during simulation: ' + error.message, 'error');
        } finally {
            spinner.classList.add('hidden');
            runBtn.disabled = false;
        }
    }

    updateChart() {
        const prices = this.simulator.priceData.map(p => p.close);
        const equity = this.simulator.equity;
        const labels = this.simulator.priceData.map(p => 
            p.timestamp.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        );

        this.chart.data.labels = labels;
        this.chart.data.datasets[0].data = prices;
        this.chart.data.datasets[1].data = equity;

        // Buy/Sell 포인트
        const buyPoints = this.simulator.trades
            .filter(t => t.type === 'BUY')
            .map(t => ({
                x: labels[t.index],
                y: prices[t.index],
                index: t.index
            }));

        const sellPoints = this.simulator.trades
            .filter(t => t.type === 'SELL')
            .map(t => ({
                x: labels[t.index],
                y: prices[t.index],
                index: t.index
            }));

        // 기존 포인트 데이터셋 제거 후 새로 추가
        this.chart.data.datasets = this.chart.data.datasets.slice(0, 2);

        if (buyPoints.length > 0) {
            this.chart.data.datasets.push({
                label: 'Buy Signal',
                data: buyPoints.map(p => ({ x: p.x, y: p.y })),
                pointBackgroundColor: '#667eea',
                pointBorderColor: '#667eea',
                pointRadius: 6,
                pointHoverRadius: 8,
                showLine: false,
                type: 'scatter',
                yAxisID: 'y'
            });
        }

        if (sellPoints.length > 0) {
            this.chart.data.datasets.push({
                label: 'Sell Signal',
                data: sellPoints.map(p => ({ x: p.x, y: p.y })),
                pointBackgroundColor: '#f5576c',
                pointBorderColor: '#f5576c',
                pointRadius: 6,
                pointHoverRadius: 8,
                showLine: false,
                type: 'scatter',
                yAxisID: 'y'
            });
        }

        this.chart.update();
    }

    displayResults(metrics) {
        // Final Balance
        document.getElementById('finalBalance').textContent = 
            '$' + metrics.finalBalance.toFixed(2);

        // Return Percent
        const returnPercent = document.getElementById('returnPercent');
        const returnValue = metrics.returns.toFixed(2);
        returnPercent.textContent = (metrics.returns >= 0 ? '+' : '') + returnValue + '%';
        returnPercent.classList.toggle('positive', metrics.returns >= 0);
        returnPercent.classList.toggle('negative', metrics.returns < 0);

        // Total Return
        document.getElementById('totalReturn').textContent = 
            (metrics.returns >= 0 ? '+' : '') + metrics.returns.toFixed(2) + '%';

        // Trades
        document.getElementById('totalTrades').textContent = 
            metrics.totalTrades + ' trade' + (metrics.totalTrades !== 1 ? 's' : '');

        // Win Rate
        document.getElementById('winRate').textContent = 
            metrics.winRate.toFixed(1) + '%';

        // Max Drawdown
        document.getElementById('maxDrawdown').textContent = 
            metrics.maxDrawdown.toFixed(2) + '%';

        // Sharpe Ratio
        document.getElementById('sharpeRatio').textContent = 
            metrics.sharpeRatio.toFixed(2);

        // Profit Factor
        document.getElementById('profitFactor').textContent = 
            metrics.profitFactor.toFixed(2);

        document.getElementById('avgReturn').textContent = 
            'avg: ' + metrics.avgReturn.toFixed(2) + '%';
    }

    displayTrades() {
        const tradesList = document.getElementById('tradesList');

        if (this.simulator.trades.length === 0) {
            tradesList.innerHTML = `
                <div class="empty-trades">
                    <i class="fas fa-inbox"></i>
                    <p>No trades executed</p>
                </div>
            `;
            return;
        }

        let buyTrade = null;
        let tradesHTML = '';

        for (const trade of this.simulator.trades) {
            const timeStr = trade.time.toLocaleTimeString('en-US', { 
                month: 'short', 
                day: 'numeric', 
                hour: '2-digit', 
                minute: '2-digit' 
            });

            if (trade.type === 'BUY') {
                buyTrade = trade;
                tradesHTML += `
                    <div class="trade-item buy">
                        <div class="trade-time">${trade.time.toLocaleDateString('en-US')} ${timeStr}</div>
                        <div class="trade-details">
                            <span class="trade-action">BUY</span>
                            <span class="trade-price">@ $${trade.price.toFixed(2)}</span>
                            <span>${trade.amount.toFixed(6)} units</span>
                        </div>
                    </div>
                `;
            } else {
                let profit = 0;
                let profitPercent = 0;
                
                if (buyTrade) {
                    profit = (trade.revenue - buyTrade.cost) / buyTrade.cost * 100;
                    profitPercent = profit;
                }

                tradesHTML += `
                    <div class="trade-item sell">
                        <div class="trade-time">${trade.time.toLocaleDateString('en-US')} ${timeStr}</div>
                        <div class="trade-details">
                            <span class="trade-action">SELL</span>
                            <span class="trade-price">@ $${trade.price.toFixed(2)}</span>
                            <span class="trade-profit ${profitPercent >= 0 ? '' : 'negative'}">
                                ${profitPercent >= 0 ? '+' : ''}${profitPercent.toFixed(2)}%
                            </span>
                        </div>
                    </div>
                `;
            }
        }

        tradesList.innerHTML = tradesHTML;
    }

    filterTrades(filter) {
        const trades = document.querySelectorAll('.trade-item');
        trades.forEach(trade => {
            if (filter === 'all') {
                trade.style.display = '';
            } else if (filter === 'buy') {
                trade.style.display = trade.classList.contains('buy') ? '' : 'none';
            } else if (filter === 'sell') {
                trade.style.display = trade.classList.contains('sell') ? '' : 'none';
            }
        });
    }

    reset() {
        this.simulator = new CryptoSimulator();
        document.getElementById('runBtn').disabled = false;
        
        // 차트 초기화
        this.chart.data.labels = [];
        this.chart.data.datasets.forEach(ds => ds.data = []);
        this.chart.update();

        // 메트릭 초기화
        document.getElementById('finalBalance').textContent = '$10,000.00';
        document.getElementById('returnPercent').textContent = '+0.00%';
        document.getElementById('totalReturn').textContent = '0.00%';
        document.getElementById('totalTrades').textContent = '0 trades';
        document.getElementById('winRate').textContent = '0.0%';
        document.getElementById('maxDrawdown').textContent = '0.00%';
        document.getElementById('sharpeRatio').textContent = '0.00';
        document.getElementById('profitFactor').textContent = '0.00';
        document.getElementById('avgReturn').textContent = 'avg: 0.00%';

        // 거래 초기화
        document.getElementById('tradesList').innerHTML = `
            <div class="empty-trades">
                <i class="fas fa-inbox"></i>
                <p>No trades yet</p>
            </div>
        `;

        document.getElementById('noDataMessage').classList.remove('hidden');

        this.showToast('Simulator reset successfully', 'success');
    }

    showToast(message, type = 'info') {
        const toast = document.getElementById('toast');
        toast.textContent = message;
        toast.className = `toast show ${type}`;
        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }
}

// 초기화
document.addEventListener('DOMContentLoaded', () => {
    new SimulatorUI();
});
