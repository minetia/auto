// =====================
// NEXUS TRADE - AI 암호화폐 자동매매 시뮬레이터 (Process Visualizer Ver)
// =====================

class CryptoSimulator {
    constructor() {
        this.priceData = [];
        this.trades = [];
        this.balance = 0;
        this.holdings = 0;
        this.equity = [];
        this.selectedStrategy = 'ensemble';
        
        // 2026년 2월 11일 기준
        this.simulationDate = new Date('2026-02-11T21:00:00+09:00');
    }

    // 실제 가격 가져오기 (실패 시 안전장치 작동)
    async fetchRealPrice(coinSymbol) {
        const symbolMap = { 'BTC': 'bitcoin', 'ETH': 'ethereum', 'SOL': 'solana', 'XRP': 'ripple', 'ZRX': '0x' };
        const coinId = symbolMap[coinSymbol] || 'bitcoin';
        
        try {
            // 3초 안에 응답 없으면 에러 처리 (무한 로딩 방지)
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3000);
            
            const response = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd`, { signal: controller.signal });
            clearTimeout(timeoutId);
            
            const data = await response.json();
            return data[coinId].usd;
        } catch (error) {
            console.warn("API 연결 실패 (가상 모드 전환):", error);
            // API 실패 시 현실적인 가격 반환
            if(coinSymbol === 'BTC') return 96500;
            if(coinSymbol === 'ETH') return 3400;
            if(coinSymbol === 'SOL') return 180;
            return 50000;
        }
    }

    // 데이터 생성 알고리즘
    async generatePriceData(days, coinSymbol) {
        const currentRealPrice = await this.fetchRealPrice(coinSymbol);
        this.priceData = [];
        let price = currentRealPrice;
        
        // 변동성 설정 (코인별 특성)
        let volatility = 0.03; 
        if(coinSymbol === 'SOL') volatility = 0.05;
        if(coinSymbol === 'ZRX') volatility = 0.07; // 변동성 큼
        if(coinSymbol === 'XRP') volatility = 0.04;
        
        // 과거 데이터 생성 루프
        for (let i = 0; i < days * 24; i++) {
            // 랜덤 워크 (매번 다른 패턴 생성)
            const randomChange = (Math.random() - 0.5) * 2 * volatility;
            const change = randomChange * 0.6; 
            
            price = price / (1 + change); 
            price = Math.max(price, 0.1); // 0원 방지

            const timePoint = new Date(this.simulationDate.getTime() - i * 3600000); // 1시간 단위

            this.priceData.unshift({
                timestamp: timePoint,
                close: price * (1 + change), // 현재가 복원
            });
        }
        
        // 마지막 데이터는 현재가로 보정
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
        
        let strategySignals = [];
        if (this.selectedStrategy === 'sma') strategySignals = this.strategySMA();
        else if (this.selectedStrategy === 'bb') strategySignals = this.strategyBollingerBands();
        else strategySignals = this.strategyEnsemble();

        let entryPrice = null;

        for (let i = 0; i < this.priceData.length; i++) {
            const currentPrice = this.priceData[i].close;
            const signal = strategySignals.find(s => s.index === i);

            // 매도 로직
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
            profitFactor: 1.5 // 단순화
        };
    }
}

// =====================
// UI 컨트롤러 (안전장치 + 진행바)
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

        document.querySelectorAll('.strategy-card').forEach(card => {
            card.addEventListener('click', (e) => {
                document.querySelectorAll('.strategy-card').forEach(c => c.classList.remove('active'));
                e.currentTarget.classList.add('active');
                this.simulator.selectedStrategy = e.currentTarget.dataset.strategy;
            });
        });

        // 필터링 버튼
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.displayTrades();
            });
        });

        this.initChart();
    }

    initChart() {
        const ctx = document.getElementById('priceChart');
        if(!ctx) return;
        
        // 기존 차트가 있으면 확실히 파괴 (캔버스 초기화)
        if(this.chart) {
            this.chart.destroy();
            this.chart = null;
        }
        
        this.chart = new Chart(ctx, {
            type: 'line',
            data: { labels: [], datasets: [{ label: '가격 (USD)', data: [], borderColor: '#667eea', borderWidth: 2, pointRadius: 0 }] },
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
        
        if(runBtn) runBtn.disabled = true;
        if(spinner) spinner.classList.remove('hidden');

        try {
            // [단계 1] 버튼 텍스트 변경: 데이터 수집
            if(runBtn) runBtn.innerHTML = '<i class="fas fa-satellite-dish fa-spin"></i> 시장 데이터 수집 중...';
            
            // 입력값 가져오기
            const balance = parseFloat(document.getElementById('initialBalance')?.value || 10000);
            const period = parseInt(document.getElementById('period')?.value || 30);
            const coin = document.getElementById('cryptoSelect')?.value || 'BTC';
            const risk = parseFloat(document.getElementById('riskPerTrade')?.value || 2);
            const sl = parseFloat(document.getElementById('stopLoss')?.value || 5);
            const tp = parseFloat(document.getElementById('takeProfit')?.value || 10);

            // [단계 2] 데이터 생성 (1초 대기)
            await new Promise(r => setTimeout(r, 1000));
            await this.simulator.generatePriceData(period, coin);
            
            // [단계 3] 버튼 텍스트 변경: 전략 분석
            if(runBtn) runBtn.innerHTML = '<i class="fas fa-brain fa-spin"></i> AI 전략 분석 중...';
            await new Promise(r => setTimeout(r, 1000)); // 1초 더 대기
            
            // [단계 4] 백테스팅 실행
            if(runBtn) runBtn.innerHTML = '<i class="fas fa-chart-line"></i> 매매 시뮬레이션 중...';
            await new Promise(r => setTimeout(r, 800)); // 0.8초 더 대기 (총 약 3초)
            
            const metrics = this.simulator.backtest(balance, sl, tp, risk);

            // 결과 표시
            this.updateChart();
            this.displayResults(metrics);
            this.displayTrades();
            this.showToast("시뮬레이션 완료!", "success");

        } catch (e) {
            console.error("Simulation Error:", e);
            this.showToast("오류 발생 (재시도 해주세요)", "error");
        } finally {
            // 버튼 복구
            if(runBtn) {
                runBtn.disabled = false;
                runBtn.innerHTML = '<i class="fas fa-rocket"></i> 시뮬레이션 시작';
            }
            if(spinner) spinner.classList.add('hidden');
        }
    }

    updateChart() {
        if(!this.chart) this.initChart(); // 차트가 없으면 재생성
        
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

    displayTrades() {
        const list = document.getElementById('tradesList');
        if(!list) return;
        list.innerHTML = '';
        
        // 필터 확인
        const activeBtn = document.querySelector('.filter-btn.active');
        const filterType = activeBtn ? activeBtn.dataset.filter : 'all';

        const trades = [...this.simulator.trades].reverse();

        if (trades.length === 0) {
            list.innerHTML = '<div style="padding:20px; text-align:center; color:#777;">거래 내역이 없습니다.</div>';
            return;
        }

        trades.forEach(t => {
            // 필터링
            if (filterType === 'buy' && t.type !== 'BUY') return;
            if (filterType === 'sell' && t.type !== 'SELL') return;

            const item = document.createElement('div');
            item.style.padding = '12px';
            item.style.borderBottom = '1px solid rgba(255,255,255,0.05)';
            item.style.display = 'flex';
            item.style.justifyContent = 'space-between';
            item.style.fontSize = '13px';
            
            // 시간 표시 (년.월.일 시간:분)
            const timeStr = new Intl.DateTimeFormat('ko-KR', {
                year: 'numeric', month: '2-digit', day: '2-digit',
                hour: '2-digit', minute: '2-digit', hour12: false
            }).format(t.time);

            if(t.type === 'BUY') {
                item.innerHTML = `
                    <div style="color:#888; font-size:12px;">${timeStr}</div>
                    <div><span style="color:#38ef7d; font-weight:bold;">매수</span> $${t.price.toFixed(2)}</div>
                `;
            } else {
                const color = t.profitPercent >= 0 ? '#38ef7d' : '#f5576c';
                item.innerHTML = `
                    <div style="color:#888; font-size:12px;">${timeStr}</div>
                    <div>
                        <span style="color:#f5576c; font-weight:bold;">매도</span> $${t.price.toFixed(2)} 
                        <span style="color:${color}; margin-left:5px;">(${t.profitPercent.toFixed(2)}%)</span>
                    </div>
                `;
            }
            list.appendChild(item);
        });
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
