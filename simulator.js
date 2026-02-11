// =====================
// NEXUS TRADE - AI 암호화폐 자동매매 시뮬레이터 (오류 수정판)
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

    // 데이터 생성
    generatePriceData(days, startPrice = 50000, coinName = 'BTC') {
        this.priceData = [];
        let price = startPrice;
        let volatility = 0.03; 
        if(coinName === 'ETH') volatility = 0.035;
        if(coinName === 'SOL') volatility = 0.05;
        if(coinName === 'ZRX') volatility = 0.06;
        
        const drift = 0.0002;

        for (let i = 0; i < days * 24; i++) {
            const randomChange = (Math.random() - 0.5) * 2 * volatility;
            const change = drift + randomChange;
            price = price * (1 + change);
            price = Math.max(price, 0.1);

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

    // 전략 알고리즘
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
                if (rsi[i] > 30 && rsi[i-1] <= 30) {
                    signals.push({ index: i, signal: 'BUY', strength: 0.8 });
                } else if (rsi[i] < 70 && rsi[i-1] >= 70) {
                    signals.push({ index: i, signal: 'SELL', strength: 0.8 });
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
                if (prices[i] < bb[i].lower) {
                    signals.push({ index: i, signal: 'BUY', strength: 0.65 });
                } else if (prices[i] > bb[i].upper) {
                    signals.push({ index: i, signal: 'SELL', strength: 0.65 });
                }
            }
        }
        return signals;
    }

    strategyEnsemble() {
        const allStrategies = [
            this.strategySMA(),
            this.strategyRSI(),
            this.strategyBollingerBands()
        ];
        const allSignals = allStrategies.flat();
        const signalMap = new Map();

        for (const sig of allSignals) {
            if (!signalMap.has(sig.index)) signalMap.set(sig.index, { buyScore: 0, sellScore: 0 });
            const current = signalMap.get(sig.index);
            if (sig.signal === 'BUY') current.buyScore += sig.strength;
            else current.sellScore += sig.strength;
        }

        const signals = [];
        for (const [index, scores] of signalMap) {
            if (scores.buyScore >= 1.0 && scores.buyScore > scores.sellScore) {
                signals.push({ index, signal: 'BUY', strength: 1 });
            } else if (scores.sellScore >= 1.0 && scores.sellScore > scores.buyScore) {
                signals.push({ index, signal: 'SELL', strength: 1 });
            }
        }
        return signals.sort((a, b) => a.index - b.index);
    }

    calculateSMA(prices, period) {
        const sma = [];
        for (let i = 0; i < prices.length; i++) {
            if (i < period - 1) sma.push(null);
            else {
                const sum = prices.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
                sma.push(sum / period);
            }
        }
        return sma;
    }

    calculateRSI(prices, period = 14) {
        const rsi = [];
        const changes = [];
        for (let i = 1; i < prices.length; i++) {
            changes.push(prices[i] - prices[i-1]);
        }
        let avgGain = 0, avgLoss = 0;
        for (let i = 0; i < period; i++) {
            if (changes[i] > 0) avgGain += changes[i];
            else avgLoss += Math.abs(changes[i]);
        }
        avgGain /= period;
        avgLoss /= period;
        for(let i=0; i<period; i++) rsi.push(null);
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
            rsi.push(100 - (100 / (1 + rs)));
        }
        return rsi;
    }

    calculateBollingerBands(prices, period = 20, stdDev = 2) {
        const sma = this.calculateSMA(prices, period);
        const bands = [];
        for (let i = 0; i < prices.length; i++) {
            if (i < period || !sma[i]) {
                bands.push({ upper: null, middle: null, lower: null });
                continue;
            }
            const slice = prices.slice(i - period + 1, i + 1);
            const mean = sma[i];
            const variance = slice.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / period;
            const std = Math.sqrt(variance);
            bands.push({ upper: mean + (std * stdDev), middle: mean, lower: mean - (std * stdDev) });
        }
        return bands;
    }

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

            if (this.holdings > 0 && entryPrice) {
                const profitPercent = ((currentPrice - entryPrice) / entryPrice) * 100;
                if (profitPercent <= -stopLoss) {
                    this.executeSell(i, currentPrice, '손절매(SL)');
                    entryPrice = null;
                } else if (profitPercent >= takeProfit) {
                    this.executeSell(i, currentPrice, '익절매(TP)');
                    entryPrice = null;
                } else if (signal && signal.signal === 'SELL') {
                    this.executeSell(i, currentPrice, '전략 매도');
                    entryPrice = null;
                }
            } else if (this.holdings === 0) {
                if (signal && signal.signal === 'BUY') {
                    const positionSize = (this.balance * riskPerTrade) / 100;
                    const tradeAmount = positionSize / currentPrice;
                    this.holdings = tradeAmount;
                    this.balance -= positionSize;
                    entryPrice = currentPrice;
                    this.trades.push({
                        index: i,
                        time: this.priceData[i].timestamp,
                        type: 'BUY',
                        price: currentPrice,
                        amount: tradeAmount,
                        cost: positionSize
                    });
                }
            }
            this.equity.push(this.balance + (this.holdings * currentPrice));
        }

        if (this.holdings > 0) {
            const finalPrice = this.priceData[this.priceData.length - 1].close;
            this.executeSell(this.priceData.length - 1, finalPrice, '종료 청산');
        }
        return this.calculateMetrics(initialBalance);
    }

    executeSell(index, price, reason) {
        const revenue = this.holdings * price;
        this.balance += revenue;
        const lastBuy = [...this.trades].reverse().find(t => t.type === 'BUY');
        const profit = lastBuy ? revenue - lastBuy.cost : 0;
        const profitPercent = lastBuy ? (profit / lastBuy.cost) * 100 : 0;

        this.trades.push({
            index: index,
            time: this.priceData[index].timestamp,
            type: 'SELL',
            price: price,
            amount: this.holdings,
            revenue: revenue,
            profit: profit,
            profitPercent: profitPercent,
            reason: reason
        });
        this.holdings = 0;
    }

    getStrategySignals() {
        switch(this.selectedStrategy) {
            case 'sma': return this.strategySMA();
            case 'rsi': return this.strategyRSI();
            case 'bb': return this.strategyBollingerBands();
            default: return this.strategyEnsemble();
        }
    }

    calculateMetrics(initialBalance) {
        const finalBalance = this.balance;
        const returns = ((finalBalance - initialBalance) / initialBalance) * 100;
        const sellTrades = this.trades.filter(t => t.type === 'SELL');
        let wins = 0, totalProfit = 0, totalLoss = 0;

        sellTrades.forEach(t => {
            if (t.profit > 0) { wins++; totalProfit += t.profit; }
            else { totalLoss += Math.abs(t.profit); }
        });

        let maxDrawdown = 0, peak = this.equity[0];
        for (const eq of this.equity) {
            if (eq > peak) peak = eq;
            const dd = ((peak - eq) / peak) * 100;
            if (dd > maxDrawdown) maxDrawdown = dd;
        }

        return {
            finalBalance,
            returns,
            totalTrades: sellTrades.length,
            winRate: sellTrades.length > 0 ? (wins / sellTrades.length) * 100 : 0,
            maxDrawdown,
            profitFactor: totalLoss === 0 ? (totalProfit > 0 ? 999 : 0) : totalProfit / totalLoss
        };
    }
}

// =====================
// UI 컨트롤러 (여기가 수정되었습니다)
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
        // null 체크를 추가하여 버튼이 없어도 에러가 나지 않게 함
        const runBtn = document.getElementById('runBtn');
        if(runBtn) runBtn.addEventListener('click', () => this.runSimulation());
        
        const resetBtn = document.getElementById('resetBtn');
        if(resetBtn) resetBtn.addEventListener('click', () => this.reset());

        document.querySelectorAll('.strategy-card').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.strategy-card').forEach(b => b.classList.remove('active'));
                e.currentTarget.classList.add('active');
                this.simulator.selectedStrategy = e.currentTarget.dataset.strategy;
            });
        });

        const periodSlider = document.getElementById('period');
        const periodNumber = document.getElementById('periodValue');
        if(periodSlider && periodNumber) {
            periodSlider.addEventListener('input', (e) => periodNumber.value = e.target.value);
            periodNumber.addEventListener('input', (e) => periodSlider.value = e.target.value);
        }

        const riskSlider = document.getElementById('riskPerTrade');
        const riskDisplay = document.getElementById('riskDisplay');
        if(riskSlider && riskDisplay) {
            riskSlider.addEventListener('input', (e) => riskDisplay.textContent = e.target.value);
        }

        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.filterTrades(e.target.dataset.filter);
            });
        });
    }

    initChart() {
        const canvas = document.getElementById('priceChart');
        if(!canvas) return;
        const ctx = canvas.getContext('2d');
        if (this.chart) this.chart.destroy();

        this.chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: '가격',
                    data: [],
                    borderColor: '#667eea',
                    backgroundColor: 'rgba(102, 126, 234, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.1,
                    pointRadius: 0,
                    yAxisID: 'y'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                plugins: {
                    legend: { labels: { color: '#b0b8d4' } }
                },
                scales: {
                    y: { type: 'linear', display: true, position: 'left', ticks: { color: '#7a8399' } },
                    x: { ticks: { color: '#7a8399', maxTicksLimit: 10 } }
                }
            }
        });
    }

    async runSimulation() {
        const runBtn = document.getElementById('runBtn');
        const spinner = document.getElementById('loadingSpinner');
        const noDataMsg = document.getElementById('noDataMessage');

        if(runBtn) runBtn.disabled = true;
        if(spinner) spinner.classList.remove('hidden');
        if(noDataMsg) noDataMsg.classList.add('hidden');

        try {
            const initialBalance = parseFloat(document.getElementById('initialBalance').value);
            const period = parseFloat(document.getElementById('period').value);
            const stopLoss = parseFloat(document.getElementById('stopLoss').value);
            const takeProfit = parseFloat(document.getElementById('takeProfit').value);
            const riskPerTrade = parseFloat(document.getElementById('riskPerTrade').value);
            const coinSelect = document.getElementById('cryptoSelect').value;

            if (initialBalance < 100) throw new Error("최소 자본금은 $100입니다.");
            
            await new Promise(resolve => setTimeout(resolve, 500));

            let startPrice = 50000;
            if(coinSelect === 'ETH') startPrice = 3000;
            if(coinSelect === 'SOL') startPrice = 100;
            if(coinSelect === 'ZRX') startPrice = 0.4;
            if(coinSelect === 'XRP') startPrice = 0.5;

            this.simulator.generatePriceData(period, startPrice, coinSelect);
            const metrics = this.simulator.backtest(initialBalance, stopLoss, takeProfit, riskPerTrade);

            this.updateChart();
            this.displayResults(metrics);
            this.displayTrades();
            this.showToast('시뮬레이션 완료', 'success');

        } catch (error) {
            console.error(error);
            this.showToast(error.message, 'error');
        } finally {
            if(spinner) spinner.classList.add('hidden');
            if(runBtn) runBtn.disabled = false;
        }
    }

    updateChart() {
        if(!this.chart) return;
        const prices = this.simulator.priceData.map(p => p.close);
        const labels = this.simulator.priceData.map(p => 
            p.timestamp.toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit' })
        );

        this.chart.data.labels = labels;
        this.chart.data.datasets[0].data = prices;

        const buyPoints = this.simulator.trades.filter(t => t.type === 'BUY').map(t => ({ x: labels[t.index], y: t.price }));
        const sellPoints = this.simulator.trades.filter(t => t.type === 'SELL').map(t => ({ x: labels[t.index], y: t.price }));

        // 기존 포인트 삭제 후 재생성
        this.chart.data.datasets = [this.chart.data.datasets[0]];

        if (buyPoints.length > 0) {
            this.chart.data.datasets.push({
                label: '매수',
                data: buyPoints,
                borderColor: '#38ef7d',
                backgroundColor: '#38ef7d',
                pointStyle: 'triangle',
                pointRadius: 6,
                type: 'scatter',
                showLine: false
            });
        }
        if (sellPoints.length > 0) {
            this.chart.data.datasets.push({
                label: '매도',
                data: sellPoints,
                borderColor: '#f5576c',
                backgroundColor: '#f5576c',
                pointStyle: 'rectRot',
                pointRadius: 6,
                type: 'scatter',
                showLine: false
            });
        }
        this.chart.update();
    }

    // [핵심 수정] 요소가 있는지 확인하고 값을 넣는 함수
    displayResults(metrics) {
        const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
        
        // 안전한 텍스트 설정 헬퍼 함수
        const setText = (id, text) => {
            const el = document.getElementById(id);
            if(el) el.textContent = text;
        };

        setText('finalBalance', fmt.format(metrics.finalBalance));
        
        const returnEl = document.getElementById('returnPercent');
        if(returnEl) {
            returnEl.textContent = (metrics.returns >= 0 ? '+' : '') + metrics.returns.toFixed(2) + '%';
            returnEl.style.color = metrics.returns >= 0 ? 'var(--success)' : 'var(--danger)';
        }

        setText('totalReturn', metrics.returns.toFixed(2) + '%');
        setText('totalTrades', metrics.totalTrades + '회 매매'); // 한글화 확인
        setText('winRate', metrics.winRate.toFixed(1) + '%');
        setText('maxDrawdown', '-' + metrics.maxDrawdown.toFixed(2) + '%');
        setText('profitFactor', metrics.profitFactor.toFixed(2));
    }

    displayTrades() {
        const list = document.getElementById('tradesList');
        if(!list) return; // 리스트가 없으면 종료 (에러 방지)
        list.innerHTML = '';

        if (this.simulator.trades.length === 0) {
            list.innerHTML = '<div class="empty-trades"><p>체결된 거래가 없습니다.</p></div>';
            return;
        }

        [...this.simulator.trades].reverse().forEach(trade => {
            const div = document.createElement('div');
            div.className = `trade-item ${trade.type.toLowerCase()}`;
            const timeStr = trade.time.toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute:'2-digit' });
            
            let details = '';
            if (trade.type === 'BUY') {
                details = `<div class="trade-info"><span class="trade-badge">BUY</span> <span>$${trade.price.toFixed(2)}</span></div>`;
            } else {
                const pClass = trade.profit >= 0 ? 'profit-positive' : 'profit-negative';
                details = `<div class="trade-info"><span class="trade-badge">SELL</span> <span>$${trade.price.toFixed(2)}</span> <span class="${pClass}">(${trade.profitPercent.toFixed(2)}%)</span></div><div style="font-size:11px; color:#aaa;">${trade.reason}</div>`;
            }
            div.innerHTML = `<div class="trade-time">${timeStr}</div><div style="text-align:right;">${details}</div>`;
            list.appendChild(div);
        });
    }

    showToast(msg, type) {
        const toast = document.getElementById('toast');
        if(!toast) return;
        toast.textContent = msg;
        toast.className = `toast show ${type}`;
        setTimeout(() => toast.classList.remove('show'), 3000);
    }

    reset() {
        this.simulator = new CryptoSimulator();
        this.initChart();
        const setText = (id, text) => {
            const el = document.getElementById(id);
            if(el) el.textContent = text;
        };
        
        setText('finalBalance', '$10,000.00');
        setText('returnPercent', '+0.00%');
        const list = document.getElementById('tradesList');
        if(list) list.innerHTML = '<div class="empty-trades"><p>초기화됨</p></div>';
        
        const noDataMsg = document.getElementById('noDataMessage');
        if(noDataMsg) noDataMsg.classList.remove('hidden');
        this.showToast('초기화되었습니다.', 'success');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new SimulatorUI();
});
