// =====================
// NEXUS TRADE - AI 암호화폐 자동매매 시뮬레이터 로직
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

    // 현실적인 가격 데이터 생성 (기하 브라운 운동 모델 사용)
    generatePriceData(days, startPrice = 50000, coinName = 'BTC') {
        this.priceData = [];
        let price = startPrice;
        
        // 코인별 변동성 설정 (가상)
        let volatility = 0.03; // 기본
        if(coinName === 'ETH') volatility = 0.035;
        if(coinName === 'SOL') volatility = 0.05;
        if(coinName === 'ZRX') volatility = 0.06; // 변동성 큼
        
        const drift = 0.0002; // 우상향 경향

        for (let i = 0; i < days * 24; i++) { // 1시간 봉 기준
            const randomChange = (Math.random() - 0.5) * 2 * volatility;
            const change = drift + randomChange;
            price = price * (1 + change);
            
            // 데이터 이상치 방지
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

    // ===== 전략 알고리즘 (한글화 주석) =====

    // 1. 단순 이동평균 교차 (SMA Crossover)
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

    // 2. 상대강도지수 (RSI) 역추세 전략
    strategyRSI(period = 14) {
        const signals = [];
        const prices = this.priceData.map(p => p.close);
        const rsi = this.calculateRSI(prices, period);

        for (let i = 1; i < rsi.length; i++) {
            if (rsi[i] !== null && rsi[i-1] !== null) {
                // 과매도(30 이하) 탈출 시 매수
                if (rsi[i] > 30 && rsi[i-1] <= 30) {
                    signals.push({ index: i, signal: 'BUY', strength: 0.8 });
                } 
                // 과매수(70 이상) 이탈 시 매도
                else if (rsi[i] < 70 && rsi[i-1] >= 70) {
                    signals.push({ index: i, signal: 'SELL', strength: 0.8 });
                }
            }
        }
        return signals;
    }

    // 3. 볼린저 밴드 전략
    strategyBollingerBands(period = 20, stdDevMultiplier = 2) {
        const signals = [];
        const prices = this.priceData.map(p => p.close);
        const bb = this.calculateBollingerBands(prices, period, stdDevMultiplier);

        for (let i = 1; i < this.priceData.length; i++) {
            if (bb[i].lower && bb[i].upper) {
                if (prices[i] < bb[i].lower) { // 하단 밴드 터치 (저가 매수 기회)
                    signals.push({ index: i, signal: 'BUY', strength: 0.65 });
                } else if (prices[i] > bb[i].upper) { // 상단 밴드 터치 (고가 매도 기회)
                    signals.push({ index: i, signal: 'SELL', strength: 0.65 });
                }
            }
        }
        return signals;
    }

    // 4. 앙상블 (모든 전략 종합 AI)
    strategyEnsemble() {
        const allStrategies = [
            this.strategySMA(),
            this.strategyRSI(),
            this.strategyBollingerBands()
        ];

        const allSignals = allStrategies.flat();
        const signalMap = new Map();

        // 투표 시스템: 각 전략의 신호를 합산
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
            // 매수/매도 임계값 설정
            const buyThreshold = 1.0; 
            const sellThreshold = 1.0;

            if (scores.buyScore >= buyThreshold && scores.buyScore > scores.sellScore) {
                signals.push({ index, signal: 'BUY', strength: 1 });
            } else if (scores.sellScore >= sellThreshold && scores.sellScore > scores.buyScore) {
                signals.push({ index, signal: 'SELL', strength: 1 });
            }
        }
        return signals.sort((a, b) => a.index - b.index);
    }

    // ===== 기술적 지표 계산 함수들 =====

    calculateSMA(prices, period) {
        const sma = [];
        for (let i = 0; i < prices.length; i++) {
            if (i < period - 1) {
                sma.push(null);
            } else {
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

        // 초기 평균 계산
        let avgGain = 0;
        let avgLoss = 0;
        for (let i = 0; i < period; i++) {
            if (changes[i] > 0) avgGain += changes[i];
            else avgLoss += Math.abs(changes[i]);
        }
        avgGain /= period;
        avgLoss /= period;

        for(let i=0; i<period; i++) rsi.push(null); // 앞부분 채우기

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
            bands.push({
                upper: mean + (std * stdDev),
                middle: mean,
                lower: mean - (std * stdDev)
            });
        }
        return bands;
    }

    // ===== 백테스팅 엔진 =====

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

            // 1. 보유 중일 때 (매도 조건 체크)
            if (this.holdings > 0 && entryPrice) {
                const profitPercent = ((currentPrice - entryPrice) / entryPrice) * 100;

                // 손절매 (Stop Loss)
                if (profitPercent <= -stopLoss) {
                    this.executeSell(i, currentPrice, '손절매(SL)');
                    entryPrice = null;
                } 
                // 익절매 (Take Profit)
                else if (profitPercent >= takeProfit) {
                    this.executeSell(i, currentPrice, '익절매(TP)');
                    entryPrice = null;
                }
                // 전략 매도 신호
                else if (signal && signal.signal === 'SELL') {
                    this.executeSell(i, currentPrice, '전략 매도');
                    entryPrice = null;
                }
            }
            // 2. 미보유 중일 때 (매수 조건 체크)
            else if (this.holdings === 0) {
                if (signal && signal.signal === 'BUY') {
                    // 리스크 관리: 자산의 N%만 진입
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

            // 자산 가치 기록
            const currentEquity = this.balance + (this.holdings * currentPrice);
            this.equity.push(currentEquity);
        }

        // 마지막에 보유 중이면 강제 청산하여 최종 자산 확정
        if (this.holdings > 0) {
            const finalPrice = this.priceData[this.priceData.length - 1].close;
            this.executeSell(this.priceData.length - 1, finalPrice, '종료 청산');
        }

        return this.calculateMetrics(initialBalance);
    }

    executeSell(index, price, reason) {
        const revenue = this.holdings * price;
        this.balance += revenue;
        
        // 가장 최근 매수 기록 찾기
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
        
        const buyTrades = this.trades.filter(t => t.type === 'BUY');
        const sellTrades = this.trades.filter(t => t.type === 'SELL');
        
        let wins = 0;
        let totalProfit = 0;
        let totalLoss = 0;

        sellTrades.forEach(t => {
            if (t.profit > 0) {
                wins++;
                totalProfit += t.profit;
            } else {
                totalLoss += Math.abs(t.profit);
            }
        });

        // 최대 낙폭 (MDD)
        let maxDrawdown = 0;
        let peak = this.equity[0];
        for (const eq of this.equity) {
            if (eq > peak) peak = eq;
            const dd = ((peak - eq) / peak) * 100;
            if (dd > maxDrawdown) maxDrawdown = dd;
        }

        return {
            finalBalance,
            returns,
            totalTrades: sellTrades.length, // 완료된 거래 기준
            winRate: sellTrades.length > 0 ? (wins / sellTrades.length) * 100 : 0,
            maxDrawdown,
            profitFactor: totalLoss === 0 ? (totalProfit > 0 ? 999 : 0) : totalProfit / totalLoss
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

        // 전략 선택 버튼
        document.querySelectorAll('.strategy-card').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.strategy-card').forEach(b => b.classList.remove('active'));
                e.currentTarget.classList.add('active');
                this.simulator.selectedStrategy = e.currentTarget.dataset.strategy;
            });
        });

        // 슬라이더 값 연동
        const periodSlider = document.getElementById('period');
        const periodNumber = document.getElementById('periodValue');
        periodSlider.addEventListener('input', (e) => periodNumber.value = e.target.value);
        periodNumber.addEventListener('input', (e) => periodSlider.value = e.target.value);

        // 리스크 슬라이더
        document.getElementById('riskPerTrade').addEventListener('input', (e) => {
            document.getElementById('riskDisplay').textContent = e.target.value;
        });

        // 거래 필터링
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.filterTrades(e.target.dataset.filter);
            });
        });
    }

    // Chart.js 초기화
    initChart() {
        const ctx = document.getElementById('priceChart').getContext('2d');
        
        // 기존 차트가 있으면 파괴 (메모리 누수 방지)
        if (this.chart) {
            this.chart.destroy();
        }

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
                    legend: { labels: { color: '#b0b8d4' } },
                    tooltip: { mode: 'index', intersect: false }
                },
                scales: {
                    y: {
                        type: 'linear', display: true, position: 'left',
                        grid: { color: 'rgba(255, 255, 255, 0.05)' },
                        ticks: { color: '#7a8399' }
                    },
                    x: {
                        grid: { display: false },
                        ticks: { color: '#7a8399', maxTicksLimit: 10 }
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
            // 입력값 가져오기
            const initialBalance = parseFloat(document.getElementById('initialBalance').value);
            const period = parseFloat(document.getElementById('period').value);
            const stopLoss = parseFloat(document.getElementById('stopLoss').value);
            const takeProfit = parseFloat(document.getElementById('takeProfit').value);
            const riskPerTrade = parseFloat(document.getElementById('riskPerTrade').value);
            const coinSelect = document.getElementById('cryptoSelect').value;

            // 유효성 검사
            if (initialBalance < 100) throw new Error("초기 자본금은 최소 $100 이상이어야 합니다.");
            
            // 약간의 딜레이로 로딩 효과 (UX)
            await new Promise(resolve => setTimeout(resolve, 800));

            // 시작 가격 설정 (코인별 대략적 가격)
            let startPrice = 50000;
            if(coinSelect === 'ETH') startPrice = 3000;
            if(coinSelect === 'SOL') startPrice = 100;
            if(coinSelect === 'XRP') startPrice = 0.5;
            if(coinSelect === 'ZRX') startPrice = 0.4;

            // 시뮬레이션 실행
            this.simulator.generatePriceData(period, startPrice, coinSelect);
            const metrics = this.simulator.backtest(initialBalance, stopLoss, takeProfit, riskPerTrade);

            this.updateChart();
            this.displayResults(metrics);
            this.displayTrades();
            this.showToast('시뮬레이션이 성공적으로 완료되었습니다.', 'success');

        } catch (error) {
            console.error(error);
            this.showToast(error.message, 'error');
        } finally {
            spinner.classList.add('hidden');
            runBtn.disabled = false;
        }
    }

    updateChart() {
        const prices = this.simulator.priceData.map(p => p.close);
        const labels = this.simulator.priceData.map(p => 
            p.timestamp.toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit' })
        );

        this.chart.data.labels = labels;
        this.chart.data.datasets = [{
            label: '코인 가격',
            data: prices,
            borderColor: '#667eea',
            backgroundColor: 'rgba(102, 126, 234, 0.1)',
            borderWidth: 2,
            pointRadius: 0,
            yAxisID: 'y'
        }];

        // 매수/매도 포인트 시각화
        const buyPoints = this.simulator.trades.filter(t => t.type === 'BUY').map(t => ({ x: labels[t.index], y: t.price }));
        const sellPoints = this.simulator.trades.filter(t => t.type === 'SELL').map(t => ({ x: labels[t.index], y: t.price }));

        if (buyPoints.length > 0) {
            this.chart.data.datasets.push({
                label: '매수 진입',
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
                label: '매도 청산',
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

    displayResults(metrics) {
        // 숫자 포맷터 (달러)
        const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
        
        document.getElementById('finalBalance').textContent = fmt.format(metrics.finalBalance);
        
        const returnEl = document.getElementById('returnPercent');
        returnEl.textContent = (metrics.returns >= 0 ? '+' : '') + metrics.returns.toFixed(2) + '%';
        returnEl.style.color = metrics.returns >= 0 ? 'var(--success)' : 'var(--danger)';

        document.getElementById('totalReturn').textContent = metrics.returns.toFixed(2) + '%';
        document.getElementById('totalTrades').textContent = metrics.totalTrades + '회 완료';
        document.getElementById('winRate').textContent = metrics.winRate.toFixed(1) + '%';
        document.getElementById('maxDrawdown').textContent = '-' + metrics.maxDrawdown.toFixed(2) + '%';
        document.getElementById('profitFactor').textContent = metrics.profitFactor.toFixed(2);
    }

    displayTrades() {
        const list = document.getElementById('tradesList');
        list.innerHTML = '';

        if (this.simulator.trades.length === 0) {
            list.innerHTML = '<div class="empty-trades"><p>체결된 거래가 없습니다.</p></div>';
            return;
        }

        // 역순 정렬 (최신순)
        [...this.simulator.trades].reverse().forEach(trade => {
            const div = document.createElement('div');
            div.className = `trade-item ${trade.type.toLowerCase()}`;
            
            const timeStr = trade.time.toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute:'2-digit' });
            
            let details = '';
            if (trade.type === 'BUY') {
                details = `
                    <div class="trade-info">
                        <span class="trade-badge">BUY</span>
                        <span>$${trade.price.toFixed(2)}</span>
                    </div>`;
            } else {
                const pClass = trade.profit >= 0 ? 'profit-positive' : 'profit-negative';
                const sign = trade.profit >= 0 ? '+' : '';
                details = `
                    <div class="trade-info">
                        <span class="trade-badge">SELL</span>
                        <span>$${trade.price.toFixed(2)}</span>
                        <span class="${pClass}">(${sign}${trade.profitPercent.toFixed(2)}%)</span>
                    </div>
                    <div style="font-size:11px; color:#aaa; margin-top:2px;">${trade.reason}</div>`;
            }

            div.innerHTML = `
                <div class="trade-time">${timeStr}</div>
                <div style="text-align:right;">${details}</div>
            `;
            list.appendChild(div);
        });
    }

    filterTrades(filter) {
        const items = document.querySelectorAll('.trade-item');
        items.forEach(item => {
            if (filter === 'all') item.style.display = 'flex';
            else if (filter === 'buy' && item.classList.contains('buy')) item.style.display = 'flex';
            else if (filter === 'sell' && item.classList.contains('sell')) item.style.display = 'flex';
            else item.style.display = 'none';
        });
    }

    showToast(msg, type) {
        const toast = document.getElementById('toast');
        toast.textContent = msg;
        toast.className = `toast show ${type}`;
        setTimeout(() => toast.classList.remove('show'), 3000);
    }

    reset() {
        this.simulator = new CryptoSimulator();
        this.initChart();
        document.getElementById('finalBalance').textContent = '$10,000.00';
        document.getElementById('returnPercent').textContent = '+0.00%';
        document.getElementById('tradesList').innerHTML = '<div class="empty-trades"><p>초기화됨</p></div>';
        document.getElementById('noDataMessage').classList.remove('hidden');
        this.showToast('초기화되었습니다.', 'success');
    }
}

// 앱 시작
document.addEventListener('DOMContentLoaded', () => {
    new SimulatorUI();
});
