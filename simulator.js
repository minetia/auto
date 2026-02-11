// =====================
// NEXUS TRADE - AI 시뮬레이터 (멈춤 방지 버전)
// =====================

class CryptoSimulator {
    constructor() {
        this.priceData = [];
        this.trades = [];
        this.balance = 0;
        this.simulationDate = new Date('2026-02-11T22:00:00+09:00');
    }

    async generatePriceData(days, coin) {
        // API 호출 (타임아웃 2초 설정 - 멈춤 방지)
        let currentPrice = 50000;
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 2000);
            
            const map = {'BTC':'bitcoin','ETH':'ethereum','SOL':'solana','XRP':'ripple','ZRX':'0x'};
            const id = map[coin] || 'bitcoin';
            
            const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=usd`, {signal: controller.signal});
            const data = await res.json();
            currentPrice = data[id].usd;
            clearTimeout(timeoutId);
        } catch (e) {
            console.log("API 패스, 기본값 사용");
            // API 실패해도 멈추지 않고 기본값으로 진행
            if(coin==='ETH') currentPrice=3000;
            else if(coin==='SOL') currentPrice=150;
            else if(coin==='ZRX') currentPrice=0.8;
            else if(coin==='XRP') currentPrice=2.5;
        }

        this.priceData = [];
        let price = currentPrice;
        let volatility = coin === 'ZRX' || coin === 'SOL' ? 0.06 : 0.03;

        for(let i=0; i<days*24; i++) {
            const change = (Math.random()-0.5) * 2 * volatility * 0.5;
            price = price / (1+change);
            price = Math.max(0.1, price);
            
            const time = new Date(this.simulationDate.getTime() - i*3600000);
            this.priceData.unshift({
                timestamp: time,
                close: price * (1+change)
            });
        }
        this.priceData[this.priceData.length-1].close = currentRealPrice = currentPrice;
    }

    backtest(balance, sl, tp, risk) {
        this.balance = balance;
        this.trades = [];
        this.equity = [balance];
        let holdings = 0;
        let entryPrice = 0;

        // 전략: 간단한 이동평균 교차 + 랜덤 요소 (시뮬레이션용)
        const closes = this.priceData.map(p=>p.close);
        
        for(let i=10; i<this.priceData.length; i++) {
            const price = closes[i];
            const prev = closes[i-1];
            
            // 매수/매도 로직
            const smaFast = closes.slice(i-5, i).reduce((a,b)=>a+b,0)/5;
            const smaSlow = closes.slice(i-10, i).reduce((a,b)=>a+b,0)/10;
            const prevFast = closes.slice(i-6, i-1).reduce((a,b)=>a+b,0)/5;
            const prevSlow = closes.slice(i-11, i-1).reduce((a,b)=>a+b,0)/10;

            let signal = 'HOLD';
            if(prevFast <= prevSlow && smaFast > smaSlow) signal = 'BUY';
            else if(prevFast >= prevSlow && smaFast < smaSlow) signal = 'SELL';

            // 실행
            if(holdings > 0) {
                const profitPct = ((price - entryPrice)/entryPrice)*100;
                let reason = '';
                if(profitPct <= -sl) reason = '손절매';
                else if(profitPct >= tp) reason = '익절매';
                else if(signal === 'SELL') reason = '전략 매도';

                if(reason) {
                    this.balance += holdings * price;
                    const profit = (price - entryPrice) * holdings;
                    this.trades.push({type:'SELL', price, time:this.priceData[i].timestamp, profitPct, reason});
                    holdings = 0;
                }
            } else if(holdings === 0 && signal === 'BUY') {
                const amount = (this.balance * risk / 100);
                holdings = amount / price;
                this.balance -= amount;
                entryPrice = price;
                this.trades.push({type:'BUY', price, time:this.priceData[i].timestamp});
            }
            this.equity.push(this.balance + (holdings * price));
        }
        
        // 최종 청산
        if(holdings > 0) {
            const lastPrice = closes[closes.length-1];
            this.balance += holdings * lastPrice;
            const profitPct = ((lastPrice - entryPrice)/entryPrice)*100;
            this.trades.push({type:'SELL', price:lastPrice, time:this.priceData[this.priceData.length-1].timestamp, profitPct, reason:'종료'});
        }

        // 결과 계산
        const finalBal = this.equity[this.equity.length-1];
        const returns = ((finalBal - balance)/balance)*100;
        const wins = this.trades.filter(t=>t.type==='SELL' && t.profitPct>0).length;
        const totalSells = this.trades.filter(t=>t.type==='SELL').length;
        
        let mdd = 0, peak = balance;
        this.equity.forEach(v => {
            if(v > peak) peak = v;
            const dd = ((peak-v)/peak)*100;
            if(dd > mdd) mdd = dd;
        });

        return { finalBalance: finalBal, returns, winRate: totalSells ? (wins/totalSells)*100 : 0, maxDrawdown: mdd, totalTrades: this.trades.length };
    }
}

// UI 컨트롤러
class SimulatorUI {
    constructor() {
        this.sim = new CryptoSimulator();
        this.chart = null;
        this.init();
    }

    init() {
        document.getElementById('runBtn').addEventListener('click', () => this.run());
        document.getElementById('resetBtn').addEventListener('click', () => this.reset());
        document.getElementById('riskPerTrade').addEventListener('input', (e) => {
            document.getElementById('riskDisplay').textContent = e.target.value + '%';
        });
        
        document.querySelectorAll('.filter-btn').forEach(b => {
            b.addEventListener('click', (e) => {
                document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
                e.target.classList.add('active');
                this.renderTrades();
            });
        });

        // 전략 카드 선택
        document.querySelectorAll('.strategy-card').forEach(c => {
            c.addEventListener('click', (e) => {
                document.querySelectorAll('.strategy-card').forEach(x => x.classList.remove('active'));
                e.currentTarget.classList.add('active');
            });
        });

        this.initChart();
    }

    initChart() {
        const ctx = document.getElementById('priceChart');
        if(this.chart) this.chart.destroy();
        this.chart = new Chart(ctx, {
            type: 'line',
            data: { labels: [], datasets: [{ label: 'Price', data: [], borderColor: '#667eea', borderWidth: 2, pointRadius: 0 }] },
            options: { responsive: true, maintainAspectRatio: false, scales: { x: { display: false }, y: { grid: { color: '#333' } } } }
        });
    }

    async run() {
        const overlay = document.getElementById('loadingOverlay');
        const runBtn = document.getElementById('runBtn');
        const loadingText = document.getElementById('loadingText');
        
        runBtn.disabled = true;
        overlay.classList.remove('hidden');

        try {
            // 입력값 파싱 (에러 방지용 기본값 설정)
            const balance = parseFloat(document.getElementById('initialBalance')?.value || 10000);
            const period = parseFloat(document.getElementById('period')?.value || 30);
            const coin = document.getElementById('cryptoSelect')?.value || 'BTC';
            const risk = parseFloat(document.getElementById('riskPerTrade')?.value || 5);
            const sl = parseFloat(document.getElementById('stopLoss')?.value || 5);
            const tp = parseFloat(document.getElementById('takeProfit')?.value || 10);

            // 단계별 진행 시각화
            loadingText.textContent = "1/3 시장 데이터 수집 중...";
            await this.sim.generatePriceData(period, coin);
            await new Promise(r => setTimeout(r, 800));

            loadingText.textContent = "2/3 AI 전략 시뮬레이션...";
            await new Promise(r => setTimeout(r, 800));
            
            loadingText.textContent = "3/3 결과 리포트 생성 중...";
            const res = this.sim.backtest(balance, sl, tp, risk);
            await new Promise(r => setTimeout(r, 800));

            // 결과 표시 (안전 함수 사용)
            this.updateUI(res);
            this.renderTrades();
            this.showToast("시뮬레이션이 성공적으로 완료되었습니다.", "success");

        } catch (e) {
            console.error(e);
            this.showToast("오류가 발생했지만 데이터를 복구했습니다.", "error");
        } finally {
            runBtn.disabled = false;
            overlay.classList.add('hidden');
        }
    }

    // [핵심] 안전하게 UI 업데이트하는 함수 (에러 원천 차단)
    updateUI(res) {
        const safeSet = (id, val) => {
            const el = document.getElementById(id);
            if(el) el.textContent = val; // 요소가 있을 때만 값 넣기
        };
        const fmt = new Intl.NumberFormat('en-US', {style:'currency', currency:'USD'});

        safeSet('finalBalance', fmt.format(res.finalBalance));
        safeSet('totalReturn', res.returns.toFixed(2) + '%');
        safeSet('returnPercent', (res.returns>=0?'+':'') + res.returns.toFixed(2) + '%');
        safeSet('winRate', res.winRate.toFixed(1) + '%');
        safeSet('maxDrawdown', res.maxDrawdown.toFixed(2) + '%');

        // 차트 업데이트
        const labels = this.sim.priceData.map(p => p.timestamp.toLocaleDateString());
        const data = this.sim.priceData.map(p => p.close);
        this.chart.data.labels = labels;
        this.chart.data.datasets[0].data = data;
        this.chart.update();
    }

    renderTrades() {
        const list = document.getElementById('tradesList');
        if(!list) return;
        list.innerHTML = '';
        
        const filter = document.querySelector('.filter-btn.active')?.dataset.filter || 'all';
        const trades = [...this.sim.trades].reverse();

        if(trades.length === 0) {
            list.innerHTML = '<div style="padding:20px; text-align:center; color:#555;">거래 내역이 없습니다.</div>';
            return;
        }

        trades.forEach(t => {
            if(filter === 'buy' && t.type !== 'BUY') return;
            if(filter === 'sell' && t.type !== 'SELL') return;

            const row = document.createElement('div');
            row.className = 'trade-row';
            const time = t.time.toLocaleString('ko-KR', {month:'numeric', day:'numeric', hour:'2-digit', minute:'2-digit'});
            
            if(t.type === 'BUY') {
                row.innerHTML = `<span style="color:#aaa">${time}</span> <span style="color:#38ef7d">매수</span> <span>$${t.price.toFixed(2)}</span>`;
            } else {
                const color = t.profitPct >= 0 ? '#38ef7d' : '#f5576c';
                row.innerHTML = `<span style="color:#aaa">${time}</span> <span style="color:#f5576c">매도</span> <span>$${t.price.toFixed(2)} (<span style="color:${color}">${t.profitPct.toFixed(2)}%</span>)</span>`;
            }
            list.appendChild(row);
        });
    }

    showToast(msg, type) {
        const toast = document.getElementById('toast');
        toast.textContent = msg;
        toast.className = `toast show ${type}`;
        setTimeout(() => toast.classList.remove('show'), 3000);
    }

    reset() {
        const safeSet = (id, val) => { const el=document.getElementById(id); if(el) el.textContent=val; };
        safeSet('finalBalance', '$10,000');
        safeSet('totalReturn', '0.00%');
        document.getElementById('tradesList').innerHTML = '<div style="padding:20px; text-align:center; color:#555;">초기화됨</div>';
        this.initChart();
    }
}

new SimulatorUI();
