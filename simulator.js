// =====================
// NEXUS TRADE - AI 암호화폐 자동매매 시뮬레이터 (기능 강화판)
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
        
        // 기준 시간: 2026년 2월 11일 (KST)
        this.simulationDate = new Date('2026-02-11T21:00:00+09:00');
    }

    // 실제 코인 가격 가져오기 (API)
    async fetchRealPrice(coinSymbol) {
        const symbolMap = { 'BTC': 'bitcoin', 'ETH': 'ethereum', 'SOL': 'solana', 'XRP': 'ripple', 'ZRX': '0x' };
        const coinId = symbolMap[coinSymbol] || 'bitcoin';
        try {
            const response = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd`);
            const data = await response.json();
            return data[coinId].usd;
        } catch (error) {
            console.warn("API 오류, 기본값 사용");
            if(coinSymbol === 'BTC') return 96500;
            if(coinSymbol === 'ETH') return 3400;
            if(coinSymbol === 'SOL') return 180;
            return 50000;
        }
    }

    // 데이터 생성 (과거 데이터 역산)
    async generatePriceData(days, coinSymbol) {
        const currentRealPrice = await this.fetchRealPrice(coinSymbol);
        this.priceData = [];
        let price = currentRealPrice;
        
        let volatility = 0.03; 
        if(coinSymbol === 'SOL') volatility = 0.05;
        if(coinSymbol === 'ZRX') volatility = 0.06;
        if(coinSymbol === 'XRP') volatility = 0.04;
        
        const drift = 0.0002;

        for (let i = 0; i < days * 24; i++) {
            const randomChange = (Math.random() - 0.5) * 2 * volatility;
            const change = randomChange * 0.5; 
            
            price = price / (1 + change); 
            price = Math.max(price, 0.1);

            const timePoint = new Date(this.simulationDate.getTime() - i * 3600000);

            this.priceData.unshift({
                timestamp: timePoint,
                close: price * (1 + change),
            });
        }
        this.priceData[this.priceData.length - 1].close = currentRealPrice;
        return this.priceData;
    }

    // --- 전략 로직 ---
    strategySMA() {
        const signals = [];
        const prices = this.priceData.map(p => p.close);
        const fastSMA = this.calculateSMA(prices, 9);
        const slowSMA = this.calculateSMA(prices, 21);

        for (let i = 1; i < this.priceData.length; i++) {
            if (fastSMA[i] && slowSMA[i] && fastSMA[i-1] && slowSMA[i-1]) {
                if (fastSMA[i] > slowSMA[i] && fastSMA[i-1] <= slowSMA[i-1]) signals.push({ index: i, signal: 'BUY' });
                else if (fastSMA[i] < slowSMA[i] && fastSMA[i-1] >= slowSMA[i-1]) signals.push({ index: i, signal: 'SELL' });
            }
        }
        return signals;
    }

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

    strategyEnsemble() {
        const sma = this.strategySMA();
        const bb = this.strategyBollingerBands();
        return [...sma, ...bb].sort((a, b) => a.index - b.index);
    }

    calculateSMA(prices, period) {
        const sma = [];
        for (let i = 0; i < prices.length; i++) {
            if (i < period - 1) sma.push(null);
            else sma.push(prices.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0) / period);
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
        
        if (this.selectedStrategy === 'sma') this.strategySignals = this.strategySMA();
        else if (this.selectedStrategy === 'bb') this.strategySignals = this.strategyBollingerBands();
        else this.strategySignals = this.strategyEnsemble();

        let entryPrice = null;

        for (let i = 0; i < this.priceData.length; i++) {
            const currentPrice = this.priceData[i].close;
            const signal = this.strategySignals.find(s => s.index === i);

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
        
        if(this.holdings > 0) {
            this.executeSell(this.priceData.length-1, this.priceData[this.priceData.length-1].close, '종료 청산');
        }

        return this.calculateMetrics(initialBalance);
    }

    executeSell(index, price, reason) {
        const revenue = this.holdings * price;
        this.balance += revenue;
        const lastBuy = [...this.trades].reverse().find(t => t.type === 'BUY');
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
        
        let maxDrawdown = 0, peak = initialBalance;
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
            profitFactor: 1.5
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
        // 버튼 이벤트
        const runBtn = document.getElementById('runBtn');
        if(runBtn) runBtn.addEventListener('click', () => this.runSimulation());
        const resetBtn = document.getElementById('resetBtn');
        if(resetBtn) resetBtn.addEventListener('click', () => this.reset());

        // 전략 선택
        document.querySelectorAll('.strategy-card').forEach(card => {
            card.addEventListener('click', (e) => {
                document.querySelectorAll('.strategy-card').forEach(c => c.classList.remove('active'));
                e.currentTarget.classList.add('active');
                this.simulator.selectedStrategy = e.currentTarget.dataset.strategy;
            });
        });

        // [기능 추가] 필터 버튼 이벤트 (전체/매수/매도)
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                // 활성 상태 변경
                document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                
                // 필터링 실행
                const filterType = e.target.dataset.filter; // 'all', 'buy', 'sell'
                this.filterTrades(filterType);
            });
        });

        this.initChart();
    }

    initChart() {
        const ctx = document.getElementById('priceChart');
        if(!ctx) return;
        if(this.chart) this.chart.destroy();
        
        this.chart = new Chart(ctx, {
            type: 'line',
            data: { labels: [], datasets: [{ label: 'Price (USD)', data: [], borderColor: '#667eea', borderWidth: 2, pointRadius: 0 }] },
            options: { 
                responsive: true, 
                maintainAspectRatio: false,
                plugins: { tooltip: { intersect: false, mode: 'index' } },
                scales: {
                    x: { ticks: { maxTicksLimit: 6, color: '#aaa' } },
                    y: { ticks: { color: '#aaa' }, grid: { color: 'rgba(255,255,255,0.05)' } }
                }
            }
        });
    }

    async runSimulation() {
        const runBtn = document.getElementById('runBtn');
        const spinner = document.getElementById('loadingSpinner');
        
        // [기능 추가] 시뮬레이션 상태 표시
        if(runBtn) {
            runBtn.disabled = true;
            runBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> AI 분석 및 매매 중...'; // 버튼 텍스트 변경
        }
        if(spinner) spinner.classList.remove('hidden');

        try {
            // 입력값
            const balance = parseFloat(document.getElementById('initialBalance')?.value || 10000);
            const period = parseInt(document.getElementById('period')?.value || 30);
            const coin = document.getElementById('cryptoSelect')?.value || 'BTC';
            const risk = parseFloat(document.getElementById('riskPerTrade')?.value || 2);
            const sl = parseFloat(document.getElementById('stopLoss')?.value || 5);
            const tp = parseFloat(document.getElementById('takeProfit')?.value || 10);

            // API 호출 및 분석 (2초 대기 연출)
            await new Promise(r => setTimeout(r, 2000));
            await this.simulator.generatePriceData(period, coin);
            
            const metrics = this.simulator.backtest(balance, sl, tp, risk);

            this.updateChart();
            this.displayResults(metrics);
            this.displayTrades();
            this.showToast("시뮬레이션이 완료되었습니다.", "success");

        } catch (e) {
            console.error(e);
            this.showToast("오류: " + e.message, "error");
        } finally {
            // 상태 복구
            if(runBtn) {
                runBtn.disabled = false;
                runBtn.innerHTML = '<i class="fas fa-rocket"></i> 시뮬레이션 시작';
            }
            if(spinner) spinner.classList.add('hidden');
        }
    }

    updateChart() {
        if(!this.chart) return;
        const prices = this.simulator.priceData.map(p => p.close);
        const labels = this.simulator.priceData.map(p => {
            return new Intl.DateTimeFormat('ko-KR', {
                month: 'numeric', day: 'numeric', hour: 'numeric'
            }).format(p.timestamp);
        });
        
        this.chart.data.labels = labels;
        this.chart.data.datasets[0].data = prices;
        this.chart.update();
    }

    displayResults(metrics) {
        const setSafe = (id, val) => { const el = document.getElementById(id); if(el) el.textContent = val; };
        const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
        
        setSafe('finalBalance', fmt.format(metrics.finalBalance));
        setSafe('totalReturn', metrics.returns.toFixed(2) + '%');
        setSafe('winRate', metrics.winRate.toFixed(1) + '%');
        setSafe('maxDrawdown', metrics.maxDrawdown.toFixed(2) + '%');
        
        const returnEl = document.getElementById('returnPercent');
        if(returnEl) {
            returnEl.textContent = (metrics.returns >= 0 ? '+' : '') + metrics.returns.toFixed(2) + '%';
            returnEl.style.color = metrics.returns >= 0 ? '#38ef7d' : '#f5576c';
        }
    }

    // [기능 추가] 거래 내역 표시 (필터링 및 상세 날짜)
    displayTrades() {
        const list = document.getElementById('tradesList');
        if(!list) return;
        list.innerHTML = '';
        
        // 현재 선택된 필터 확인 ('active' 클래스가 있는 버튼의 data-filter 값)
        const activeBtn = document.querySelector('.filter-btn.active');
        const filterType = activeBtn ? activeBtn.dataset.filter : 'all';

        [...this.simulator.trades].reverse().forEach(t => {
            // 필터링 로직: 선택된 필터와 거래 타입이 다르면 건너뜀
            if (filterType !== 'all') {
                if (filterType === 'buy' && t.type !== 'BUY') return;
                if (filterType === 'sell' && t.type !== 'SELL') return;
            }

            const item = document.createElement('div');
            // 필터링을 위한 클래스 추가 (buy/sell)
            item.className = `trade-item ${t.type.toLowerCase()}`; 
            item.style.padding = '12px';
            item.style.borderBottom = '1px solid rgba(255,255,255,0.05)';
            item.style.display = 'flex';
            item.style.justifyContent = 'space-between';
            item.style.fontSize = '13px';
            
            // [기능 추가] 날짜/시간 정밀 표시
            const timeStr = new Intl.DateTimeFormat('ko-KR', {
                year: 'numeric', month: '2-digit', day: '2-digit',
                hour: '2-digit', minute: '2-digit', hour12: false
            }).format(t.time);

            if(t.type === 'BUY') {
                item.innerHTML = `
                    <div style="color:#aaa">${timeStr}</div>
                    <div><span style="color:#38ef7d; font-weight:bold;">매수</span> $${t.price.toFixed(2)}</div>
                `;
            } else {
                const color = t.profitPercent >= 0 ? '#38ef7d' : '#f5576c';
                item.innerHTML = `
                    <div style="color:#aaa">${timeStr}</div>
                    <div>
                        <span style="color:#f5576c; font-weight:bold;">매도</span> $${t.price.toFixed(2)} 
                        <span style="color:${color}; margin-left:5px;">(${t.profitPercent.toFixed(2)}%)</span>
                    </div>
                `;
            }
            list.appendChild(item);
        });
        
        // 거래가 없을 경우
        if(list.children.length === 0) {
            list.innerHTML = '<div style="padding:20px; text-align:center; color:#aaa;">조건에 맞는 거래 내역이 없습니다.</div>';
        }
    }

    // [기능 추가] 필터 버튼 클릭 시 호출되는 함수
    filterTrades(type) {
        // displayTrades를 다시 호출하면 현재 필터 상태(active class)를 읽어서 다시 그립니다.
        this.displayTrades();
    }

    showToast(msg, type) {
        const toast = document.getElementById('toast');
        if(!toast) return;
        toast.textContent = msg;
        toast.style.opacity = '1';
        toast.style.background = type === 'success' ? 'linear-gradient(135deg, #11998e, #38ef7d)' : '#333';
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
