// =====================
// NEXUS TRADE - AI 암호화폐 자동매매 시뮬레이터 (Real API + KST Ver)
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
        
        // 기준 시간 설정: 2026년 2월 11일 (KST)
        this.simulationDate = new Date('2026-02-11T21:00:00+09:00');
    }

    // [핵심] 실제 코인 가격 가져오기 (CoinGecko API)
    async fetchRealPrice(coinSymbol) {
        const symbolMap = {
            'BTC': 'bitcoin',
            'ETH': 'ethereum',
            'SOL': 'solana',
            'XRP': 'ripple',
            'ZRX': '0x'
        };
        const coinId = symbolMap[coinSymbol] || 'bitcoin';
        
        try {
            const response = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd`);
            const data = await response.json();
            return data[coinId].usd;
        } catch (error) {
            console.warn("API 호출 실패, 기본값 사용:", error);
            // API 실패 시 현실적인 2026년 예상 가격 백업
            if(coinSymbol === 'BTC') return 96500;
            if(coinSymbol === 'ETH') return 3400;
            if(coinSymbol === 'SOL') return 180;
            if(coinSymbol === 'XRP') return 2.5;
            if(coinSymbol === 'ZRX') return 0.8;
            return 50000;
        }
    }

    // 데이터 생성 (실제 가격 기반 + 2026년 날짜 적용)
    async generatePriceData(days, coinSymbol) {
        // 1. 현재 실제 가격 가져오기
        const currentRealPrice = await this.fetchRealPrice(coinSymbol);
        
        this.priceData = [];
        let price = currentRealPrice; // 현재가를 끝점으로 설정하기 위해 역산하거나, 시작점으로 설정
        
        // 변동성 설정
        let volatility = 0.03; 
        if(coinSymbol === 'SOL') volatility = 0.05;
        if(coinSymbol === 'ZRX') volatility = 0.06;
        if(coinSymbol === 'XRP') volatility = 0.04;
        
        // 과거 데이터를 생성하기 위해 역방향 루프 (현재 -> 과거)
        // 시뮬레이션의 '끝'이 2026-02-11이 되도록 설정
        for (let i = 0; i < days * 24; i++) {
            // 랜덤 워크 (Geometric Brownian Motion)
            const randomChange = (Math.random() - 0.5) * 2 * volatility;
            const change = randomChange * 0.5; // 변동폭 조절
            
            // 과거 가격 추산 (현재가에서 역산)
            price = price / (1 + change); 
            price = Math.max(price, 0.1);

            // 시간: 2026-02-11 기준에서 1시간씩 뺌
            const timePoint = new Date(this.simulationDate.getTime() - i * 3600000);

            this.priceData.unshift({ // 배열 앞에 추가 (과거 -> 현재 순서 맞춤)
                timestamp: timePoint,
                close: price * (1 + change), // 다시 원복하여 저장
                high: price * (1 + volatility/2),
                low: price * (1 - volatility/2)
            });
        }
        
        // 마지막 데이터 포인트는 정확히 현재가로 보정
        this.priceData[this.priceData.length - 1].close = currentRealPrice;
        
        return this.priceData;
    }

    // --- 전략 로직 (기존과 동일하지만 데이터 기반으로 작동) ---

    strategySMA() {
        const signals = [];
        const prices = this.priceData.map(p => p.close);
        const fastSMA = this.calculateSMA(prices, 9);
        const slowSMA = this.calculateSMA(prices, 21);

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

    strategyRSI() { // RSI 로직 추가
        const signals = [];
        const prices = this.priceData.map(p => p.close);
        const rsi = this.calculateRSI(prices, 14);
        for(let i=1; i<rsi.length; i++) {
            if(rsi[i] < 30 && rsi[i-1] >= 30) signals.push({ index: i, signal: 'BUY' });
            else if(rsi[i] > 70 && rsi[i-1] <= 70) signals.push({ index: i, signal: 'SELL' });
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
        const rsi = this.strategyRSI();
        return [...sma, ...bb, ...rsi].sort((a, b) => a.index - b.index);
    }

    // --- 지표 계산 함수 ---
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
    
    calculateRSI(prices, period) {
        const rsi = [];
        const changes = [];
        for(let i=1; i<prices.length; i++) changes.push(prices[i]-prices[i-1]);
        
        // 간단한 RSI 계산
        for(let i=0; i<prices.length; i++) {
            if(i < period) { rsi.push(50); continue; }
            const slice = changes.slice(i-period, i);
            const gains = slice.filter(x => x > 0).reduce((a,b)=>a+b, 0);
            const losses = Math.abs(slice.filter(x => x < 0).reduce((a,b)=>a+b, 0));
            const rs = losses === 0 ? 100 : gains/losses;
            rsi.push(100 - (100/(1+rs)));
        }
        return rsi;
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

    // 백테스팅
    backtest(initialBalance, stopLoss, takeProfit, riskPerTrade) {
        this.balance = initialBalance;
        this.holdings = 0;
        this.trades = [];
        this.equity = [initialBalance];
        
        if (this.selectedStrategy === 'sma') this.strategySignals = this.strategySMA();
        else if (this.selectedStrategy === 'bb') this.strategySignals = this.strategyBollingerBands();
        else if (this.selectedStrategy === 'rsi') this.strategySignals = this.strategyRSI();
        else this.strategySignals = this.strategyEnsemble();

        let entryPrice = null;

        for (let i = 0; i < this.priceData.length; i++) {
            const currentPrice = this.priceData[i].close;
            const signal = this.strategySignals.find(s => s.index === i);

            // 매도 체크
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
            // 매수 체크
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
        
        // 마지막 강제 청산
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
// UI 컨트롤러 (KST 시간 + 안전장치)
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
                plugins: {
                    tooltip: {
                        intersect: false,
                        mode: 'index',
                    }
                },
                scales: {
                    x: { ticks: { maxTicksLimit: 8, color: '#aaa' } },
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
            // 사용자 입력값
            const balance = parseFloat(document.getElementById('initialBalance')?.value || 10000);
            const period = parseInt(document.getElementById('period')?.value || 30);
            const coin = document.getElementById('cryptoSelect')?.value || 'BTC';
            const risk = parseFloat(document.getElementById('riskPerTrade')?.value || 2);
            const sl = parseFloat(document.getElementById('stopLoss')?.value || 5);
            const tp = parseFloat(document.getElementById('takeProfit')?.value || 10);

            // API 호출 및 데이터 생성 (대기 시간 1.5초 포함)
            await new Promise(r => setTimeout(r, 1500));
            await this.simulator.generatePriceData(period, coin);
            
            const metrics = this.simulator.backtest(balance, sl, tp, risk);

            this.updateChart();
            this.displayResults(metrics);
            this.displayTrades();
            this.showToast("2026-02-11 기준 시뮬레이션 완료", "success");

        } catch (e) {
            console.error(e);
            this.showToast("오류: " + e.message, "error");
        } finally {
            if(runBtn) runBtn.disabled = false;
            if(spinner) spinner.classList.add('hidden');
        }
    }

    // [핵심] 차트 시간축을 한국 시간으로 표시
    updateChart() {
        if(!this.chart) return;
        const prices = this.simulator.priceData.map(p => p.close);
        
        // 날짜 포맷팅 (KST)
        const labels = this.simulator.priceData.map(p => {
            return new Intl.DateTimeFormat('ko-KR', {
                timeZone: 'Asia/Seoul',
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

    // [핵심] 거래 기록 시간을 한국 시간으로 표시
    displayTrades() {
        const list = document.getElementById('tradesList');
        if(!list) return;
        list.innerHTML = '';
        
        [...this.simulator.trades].reverse().forEach(t => {
            const item = document.createElement('div');
            item.className = 'trade-item';
            item.style.padding = '12px';
            item.style.borderBottom = '1px solid rgba(255,255,255,0.05)';
            item.style.display = 'flex';
            item.style.justifyContent = 'space-between';
            item.style.fontSize = '13px';
            
            // 시간 변환 (KST)
            const timeStr = new Intl.DateTimeFormat('ko-KR', {
                timeZone: 'Asia/Seoul',
                month: 'numeric', day: 'numeric', 
                hour: '2-digit', minute: '2-digit'
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
