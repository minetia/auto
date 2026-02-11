// =====================
// NEXUS TRADE - AI 암호화폐 자동매매 시뮬레이터 (최종 수정판)
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

    // 데이터 생성 (변동성 모델)
    generatePriceData(days, startPrice = 50000, coinName = 'BTC') {
        this.priceData = [];
        let price = startPrice;
        let volatility = 0.03; 
        
        // 코인별 특성 반영
        if(coinName === 'ETH') volatility = 0.035;
        if(coinName === 'SOL') volatility = 0.05;
        if(coinName === 'ZRX') volatility = 0.06;
        if(coinName === 'XRP') volatility = 0.04;
        
        const drift = 0.0002; // 약간의 우상향 경향

        for (let i = 0; i < days * 24; i++) {
            const randomChange = (Math.random() - 0.5) * 2 * volatility;
            const change = drift + randomChange;
            price = price * (1 + change);
            price = Math.max(price, 0.1); // 0원 이하 방지

            this.priceData.push({
                timestamp: new Date(Date.now() - (days * 24 - i) * 3600000),
                close: price,
            });
        }
        return this.priceData;
    }

    // 전략: 단순 이동평균 (SMA)
    strategySMA() {
        const signals = [];
        const prices = this.priceData.map(p => p.close);
        const fastPeriod = 9;
        const slowPeriod = 21;
        
        const fastSMA = this.calculateSMA(prices, fastPeriod);
        const slowSMA = this.calculateSMA(prices, slowPeriod);

        for (let i = 1; i < this.priceData.length; i++) {
            if (fastSMA[i] && slowSMA[i] && fastSMA[i-1] && slowSMA[i-1]) {
                if (fastSMA[i] > slowSMA[i] && fastSMA[i-1] <= slowSMA[i-1]) {
                    signals.push({ index: i, signal: 'BUY' });
                } else if (fastSMA[i] < slowSMA[i] && fastSMA[i-1] >= slowSMA[i-1]) {
                    signals.push({ index: i, signal: 'SELL' });
                }
            }
        }
        return signals;
    }

    // 전략: 볼린저 밴드
    strategyBollingerBands() {
        const signals = [];
        const prices = this.priceData.map(p => p.close);
        const bb = this.calculateBollingerBands(prices, 20, 2);

        for (let i = 1; i < this.priceData.length; i++) {
            if (bb[i].lower && bb[i].upper) {
                if (prices[i] < bb[i].lower) signals.push({ index: i, signal: 'BUY' });
                else if (prices[i] > bb[i].upper) signals.push({ index: i, signal: 'SELL' });
            }
        }
        return signals;
    }

    // 전략: 앙상블 (종합)
    strategyEnsemble() {
        const sma = this.strategySMA();
        const bb = this.strategyBollingerBands();
        // 간단하게 두 전략의 신호를 합침 (실제로는 더 복잡한 로직 가능)
        return [...sma, ...bb].sort((a, b) => a.index - b.index);
    }

    // 지표 계산 헬퍼
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

    calculateBollingerBands(prices, period, stdDev) {
        const sma = this.calculateSMA(prices, period);
        const bands = [];
        for (let i = 0; i < prices.length; i++) {
            if (!sma[i]) { bands.push({ upper: null, lower: null }); continue; }
            const slice = prices.slice(i - period + 1, i + 1);
            const variance = slice.reduce((sum, val) => sum + Math.pow(val - sma[i], 2), 0) / period;
            const std = Math.sqrt(variance);
            bands.push({ upper: sma[i] + std * stdDev, lower: sma[i] - std * stdDev });
        }
        return bands;
    }

    // 백테스팅 엔진
    backtest(initialBalance, stopLoss, takeProfit, riskPerTrade) {
        this.balance = initialBalance;
        this.holdings = 0;
        this.trades = [];
        this.equity = [initialBalance];
        
        // 선택된 전략 실행
        if (this.selectedStrategy === 'sma') this.strategySignals = this.strategySMA();
        else if (this.selectedStrategy === 'bb') this.strategySignals = this.strategyBollingerBands();
        else this.strategySignals = this.strategyEnsemble();

        let entryPrice = null;

        for (let i = 0; i < this.priceData.length; i++) {
            const currentPrice = this.priceData[i].close;
            const signal = this.strategySignals.find(s => s.index === i);

            // 매도 로직 (손절/익절/신호)
            if (this.holdings > 0 && entryPrice) {
                const profitPct = ((currentPrice - entryPrice) / entryPrice) * 100;
                let reason = '';
                
                if (profitPct <= -stopLoss) reason = '손절매(SL)';
                else if (profitPct >= takeProfit) reason = '익절매(TP)';
                else if (signal && signal.signal === 'SELL') reason = '전략 매도';

                if (reason) {
                    this.executeSell(i, currentPrice, reason);
                    entryPrice = null;
                }
            } 
            // 매수 로직
            else if (this.holdings === 0 && signal && signal.signal === 'BUY') {
                const investAmount = (this.balance * riskPerTrade) / 100;
                this.holdings = investAmount / currentPrice;
                this.balance -= investAmount;
                entryPrice = currentPrice;
                
                this.trades.push({
                    index: i,
                    time: this.priceData[i].timestamp,
                    type: 'BUY',
                    price: currentPrice
                });
            }
            this.equity.push(this.balance + (this.holdings * currentPrice));
        }
        return this.calculateMetrics(initialBalance);
    }

    executeSell(index, price, reason) {
        const revenue = this.holdings * price;
        this.balance += revenue;
        const lastBuy = [...this.trades].reverse().find(t => t.type === 'BUY');
        const profit = lastBuy ? revenue - (lastBuy.price * this.holdings) : 0; // 근사치 계산
        const profitPercent = lastBuy ? ((price - lastBuy.price) / lastBuy.price) * 100 : 0;

        this.trades.push({
            index: index,
            time: this.priceData[index].timestamp,
            type: 'SELL',
            price: price,
            profitPercent: profitPercent,
            reason: reason
        });
        this.holdings = 0;
    }

    calculateMetrics(initialBalance) {
        const finalBalance = this.equity[this.equity.length-1];
        const returns = ((finalBalance - initialBalance) / initialBalance) * 100;
        const sells = this.trades.filter(t => t.type === 'SELL');
        const wins = sells.filter(t => t.profitPercent > 0).length;
        
        // MDD 계산
        let maxDrawdown = 0;
        let peak = initialBalance;
        for (const val of this.equity) {
            if (val > peak) peak = val;
            const dd = ((peak - val) / peak) * 100;
            if (dd > maxDrawdown) maxDrawdown = dd;
        }

        return {
            finalBalance,
            returns,
            totalTrades: sells.length,
            winRate: sells.length > 0 ? (wins / sells.length) * 100 : 0,
            maxDrawdown,
            profitFactor: 1.5 // 간략화 (실제 계산 복잡도 제거)
        };
    }
}

// =====================
// UI 컨트롤러 (안전장치 강화됨)
// =====================
class SimulatorUI {
    constructor() {
        this.simulator = new CryptoSimulator();
        this.chart = null;
        this.init();
    }

    init() {
        const runBtn = document.getElementById('runBtn');
        if(runBtn) runBtn.addEventListener('click', () => this.runSimulation());
        
        const resetBtn = document.getElementById('resetBtn');
        if(resetBtn) resetBtn.addEventListener('click', () => this.reset());

        // 전략 카드 선택
        document.querySelectorAll('.strategy-card').forEach(card => {
            card.addEventListener('click', (e) => {
                document.querySelectorAll('.strategy-card').forEach(c => c.classList.remove('active'));
                e.currentTarget.classList.add('active');
                this.simulator.selectedStrategy = e.currentTarget.dataset.strategy;
            });
        });

        // 차트 초기화
        this.initChart();
    }

    initChart() {
        const ctx = document.getElementById('priceChart');
        if(!ctx) return;

        if(this.chart) this.chart.destroy();
        
        this.chart = new Chart(ctx, {
            type: 'line',
            data: { labels: [], datasets: [{ label: 'Price', data: [], borderColor: '#667eea', borderWidth: 2 }] },
            options: { responsive: true, maintainAspectRatio: false, elements: { point: { radius: 0 } } }
        });
    }

    async runSimulation() {
        const runBtn = document.getElementById('runBtn');
        const spinner = document.getElementById('loadingSpinner');
        
        if(runBtn) runBtn.disabled = true;
        if(spinner) spinner.classList.remove('hidden');

        try {
            // 1.5초 대기 (사용자가 시뮬레이션 중임을 느끼게 함)
            await new Promise(r => setTimeout(r, 1500));

            // 값 가져오기 (없으면 기본값 사용)
            const balanceInput = document.getElementById('initialBalance');
            const balance = balanceInput ? parseFloat(balanceInput.value) : 10000;
            
            const periodInput = document.getElementById('period');
            const period = periodInput ? parseInt(periodInput.value) : 30;

            const coinInput = document.getElementById('cryptoSelect');
            const coin = coinInput ? coinInput.value : 'BTC';

            // 실행
            this.simulator.generatePriceData(period, 50000, coin);
            const metrics = this.simulator.backtest(balance, 5, 10, 2); // 기본값: 손절5%, 익절10%, 리스크2%

            // 결과 표시
            this.updateChart();
            this.displayResults(metrics);
            this.displayTrades();
            this.showToast("시뮬레이션이 완료되었습니다!", "success");

        } catch (e) {
            console.error(e);
            this.showToast("오류 발생: " + e.message, "error");
        } finally {
            if(runBtn) runBtn.disabled = false;
            if(spinner) spinner.classList.add('hidden');
        }
    }

    updateChart() {
        if(!this.chart) return;
        const prices = this.simulator.priceData.map(p => p.close);
        const labels = this.simulator.priceData.map(p => p.timestamp.getDate() + '일');
        
        this.chart.data.labels = labels;
        this.chart.data.datasets[0].data = prices;
        this.chart.update();
    }

    displayResults(metrics) {
        // [안전장치] 요소가 없으면 건너뛰는 헬퍼 함수
        const setSafe = (id, val) => {
            const el = document.getElementById(id);
            if(el) el.textContent = val;
        };

        const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
        setSafe('finalBalance', fmt.format(metrics.finalBalance));
        setSafe('totalReturn', metrics.returns.toFixed(2) + '%');
        setSafe('winRate', metrics.winRate.toFixed(1) + '%');
        setSafe('maxDrawdown', metrics.maxDrawdown.toFixed(2) + '%');
        
        // 수익률 색상 처리
        const returnEl = document.getElementById('returnPercent');
        if(returnEl) {
            returnEl.textContent = (metrics.returns >= 0 ? '+' : '') + metrics.returns.toFixed(2) + '%';
            returnEl.style.color = metrics.returns >= 0 ? '#38ef7d' : '#f5576c';
        }
    }

    displayTrades() {
        const list = document.getElementById('tradesList');
        if(!list) return;
        list.innerHTML = '';
        
        // 최근 거래순 정렬
        [...this.simulator.trades].reverse().forEach(t => {
            const item = document.createElement('div');
            item.className = 'trade-item';
            item.style.padding = '10px';
            item.style.borderBottom = '1px solid rgba(255,255,255,0.1)';
            
            if(t.type === 'BUY') {
                item.innerHTML = `<span style="color:#38ef7d">매수</span> $${t.price.toFixed(2)}`;
            } else {
                const color = t.profitPercent >= 0 ? '#38ef7d' : '#f5576c';
                item.innerHTML = `<span style="color:#f5576c">매도</span> $${t.price.toFixed(2)} <span style="color:${color}">(${t.profitPercent.toFixed(2)}%)</span>`;
            }
            list.appendChild(item);
        });
    }

    showToast(msg, type) {
        const toast = document.getElementById('toast');
        if(!toast) return;
        toast.textContent = msg;
        toast.style.opacity = '1';
        setTimeout(() => toast.style.opacity = '0', 3000);
    }

    reset() {
        this.simulator = new CryptoSimulator();
        this.initChart();
        this.displayResults({ finalBalance: 10000, returns: 0, winRate: 0, maxDrawdown: 0 });
        const list = document.getElementById('tradesList');
        if(list) list.innerHTML = '';
        this.showToast("초기화되었습니다.", "success");
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new SimulatorUI();
});
