// 전역 변수
let currentChart = null;
let autoTradingActive = false;
let selectedMarket = 'KRW-BTC';
let selectedCoinName = 'BTC';

// 초기화
async function initialize() {
    updateTime();
    setInterval(updateTime, 1000);

    // 저장된 설정 로드
    const saved = StorageManager.getSettings();
    if (saved) {
        applySettingsToUI(saved);
    }

    // 포트폴리오 업데이트
    updatePortfolioUI();

    // 거래 내역 업데이트
    updateTradeHistoryUI();

    // 실시간 업데이트 시작
    startRealtimeUpdate();

    // API 연결 상태 확인
    await checkAPIStatus();
}

// 실시간 업데이트
async function startRealtimeUpdate() {
    // 가격 업데이트 (10초마다)
    setInterval(async () => {
        const ticker = await UpbitAPI.getTicker(selectedMarket);
        if (ticker && ticker[0]) {
            updatePriceDisplay(ticker[0]);
            updateChart();
        }
    }, 10000);

    // 통계 업데이트 (30초마다)
    setInterval(updateStats, 30000);
}

// API 연결 상태 확인
async function checkAPIStatus() {
    const ticker = await UpbitAPI.getTicker('KRW-BTC');
    const statusDot = document.getElementById('statusDot');
    const statusText = document.getElementById('statusText');

    if (ticker && ticker[0]) {
        statusDot.classList.remove('offline');
        statusText.textContent = '연결됨 (Upbit API)';
    } else {
        statusDot.classList.add('offline');
        statusText.textContent = '연결 실패';
    }
}

// 현재 시간 업데이트
function updateTime() {
    const now = new Date();
    document.getElementById('lastUpdate').textContent = now.toLocaleTimeString('ko-KR', {
        hour: '2-digit',
        minute: '2-digit'
    });
}

// 코인 선택
function selectCoin(market, coinName) {
    selectedMarket = market;
    selectedCoinName = coinName;

    // UI 업데이트
    document.querySelectorAll('.coin-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.closest('.coin-btn').classList.add('active');

    document.getElementById('selectedCoin').value = market;
    document.getElementById('selectedCoinName').value = coinName;

    // 차트 업데이트
    updateChart();

    // 가격 업데이트
    updatePriceData();
}

// 가격 데이터 업데이트
async function updatePriceData() {
    const ticker = await UpbitAPI.getTicker(selectedMarket);
    if (ticker && ticker[0]) {
        updatePriceDisplay(ticker[0]);
    }
}

// 가격 표시 업데이트
function updatePriceDisplay(ticker) {
    const changePercent = ticker.change_rate * 100;
    const changeAmount = ticker.change_price;

    console.log(`${selectedCoinName}: ₩${ticker.trade_price.toLocaleString()} (${changePercent.toFixed(2)}%)`);
}

// 차트 업데이트
async function updateChart() {
    const candles = await UpbitAPI.getCandles(selectedMarket, 'minutes60', 100);
    if (!candles || candles.length === 0) {
        showAlert('차트 데이터를 불러올 수 없습니다', 'error');
        return;
    }

    const chartData = {
        labels: candles.reverse().map(c => {
            const date = new Date(c.candle_date_time_kst);
            return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
        }),
        datasets: [{
            label: `${selectedCoinName} 가격`,
            data: candles.map(c => c.trade_price),
            borderColor: '#667eea',
            backgroundColor: 'rgba(102, 126, 234, 0.1)',
            borderWidth: 2,
            fill: true,
            tension: 0.4,
            pointRadius: 2,
            pointBackgroundColor: '#667eea'
        }]
    };

    const ctx = document.getElementById('priceChart').getContext('2d');

    if (currentChart) {
        currentChart.destroy();
    }

    currentChart = new Chart(ctx, {
        type: 'line',
        data: chartData,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'top'
                }
            },
            scales: {
                y: {
                    beginAtZero: false,
                    ticks: {
                        callback: function (value) {
                            return '₩' + value.toLocaleString();
                        }
                    }
                }
            }
        }
    });
}

// 설정 저장
function saveSettings() {
    const settings = {
        market: selectedMarket,
        coinName: selectedCoinName,
        strategy: document.getElementById('strategy').value,
        buyPrice: parseFloat(document.getElementById('buyPrice').value) || 0,
        sellPrice: parseFloat(document.getElementById('sellPrice').value) || 0,
        tradeAmount: parseFloat(document.getElementById('tradeAmount').value) || 0,
        investAmount: parseFloat(document.getElementById('investAmount').value) || 0,
        stopLoss: parseFloat(document.getElementById('stopLoss').value) || 2,
        takeProfit: parseFloat(document.getElementById('takeProfit').value) || 5
    };

    // 유효성 검사
    if (!settings.market || !settings.coinName) {
        showAlert('코인을 선택해주세요', 'error');
        return;
    }

    if (settings.buyPrice <= 0 || settings.sellPrice <= 0) {
        showAlert('매수/매도 가격을 입력해주세요', 'error');
        return;
    }

    if (settings.buyPrice >= settings.sellPrice) {
        showAlert('매수 가격이 매도 가격보다 작아야 합니다', 'error');
        return;
    }

    StorageManager.saveSettings(settings);
    showAlert('설정이 저장되었습니다', 'success');
}

// 자동 매매 토글
function toggleAutoTrade() {
    const toggle = document.getElementById('autoTradeToggle');

    if (toggle.checked) {
        const settings = StorageManager.getSettings();
        if (!settings) {
            showAlert('먼저 설정을 저장해주세요', 'error');
            toggle.checked = false;
            return;
        }

        tradingEngine.loadSettings(settings);
        tradingEngine.start(settings.market, settings);
        autoTradingActive = true;
        showAlert(`${settings.coinName} 자동 매매가 활성화되었습니다`, 'success');
    }
}

// 자동 매매 중지
function stopAutoTrade() {
    tradingEngine.stop();
    document.getElementById('autoTradeToggle').checked = false;
    autoTradingActive = false;
    showAlert('자동 매매가 중지되었습니다', 'warning');
}

// 포트폴리오 UI 업데이트
function updatePortfolioUI() {
    const portfolio = StorageManager.getPortfolio();
    const tbody = document.getElementById('portfolio');

    if (Object.keys(portfolio).length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #999; padding: 30px;">보유 자산이 없습니다</td></tr>';
        return;
    }

    tbody.innerHTML = Object.entries(portfolio).map(([coin, data]) => `
        <tr>
            <td>${coin}</td>
            <td>${data.amount.toFixed(8)}</td>
            <td>₩${data.avgPrice.toLocaleString()}</td>
            <td id="price-${coin}">-</td>
            <td id="profit-${coin}">-</td>
        </tr>
    `).join('');
}

// 거래 내역 UI 업데이트
function updateTradeHistoryUI() {
    const history = StorageManager.getTradeHistory();
    const tbody = document.getElementById('tradeHistory');

    if (history.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: #999; padding: 30px;">거래 내역이 없습니다</td></tr>';
        return;
    }

    tbody.innerHTML = history.slice(0, 20).map(trade => {
        const badgeClass = trade.type === '매수' ? 'badge-buy' : 'badge-sell';
        return `
            <tr>
                <td>${trade.coin}</td>
                <td><span class="badge-custom ${badgeClass}">${trade.type}</span></td>
                <td>₩${trade.price.toLocaleString()}</td>
                <td>${trade.amount.toFixed(8)}</td>
                <td><span class="badge-custom badge-active">${trade.status}</span></td>
                <td>${trade.timestamp}</td>
            </tr>
        `;
    }).join('');
}

// 통계 업데이트
function updateStats() {
    const portfolio = StorageManager.getPortfolio();
    const history = StorageManager.getTradeHistory();

    // 총 자산 계산
    let totalAsset = 0;
    Object.values(portfolio).forEach(p => {
        totalAsset += p.amount * p.avgPrice;
    });

    document.getElementById('totalAsset').textContent = '₩' + totalAsset.toLocaleString();
    document.getElementById('activeOrders').textContent = Object.keys(portfolio).length;

    // 오늘 수익 계산
    const today = new Date().toDateString();
    const todayTrades = history.filter(t => new Date(t.timestamp).toDateString() === today);
    let todayProfit = 0;

    const buys = todayTrades.filter(t => t.type === '매수').reduce((sum, t) => sum + t.total, 0);
    const sells = todayTrades.filter(t => t.type === '매도').reduce((sum, t) => sum + t.total, 0);
    todayProfit = sells - buys;

    document.getElementById('todayProfit').textContent = '₩' + todayProfit.toLocaleString();
    document.getElementById('todayProfitPercent').textContent = (todayProfit > 0 ? '+' : '') + todayProfit.toFixed(0);
}

// 거래 내역 초기화
function clearHistory() {
    if (confirm('거래 내역을 모두 삭제하시겠습니까?')) {
        localStorage.removeItem('tradeHistory');
        updateTradeHistoryUI();
        showAlert('거래 내역이 초기화되었습니다', 'success');
    }
}

// 알림 표시
function showAlert(message, type) {
    const alertBox = document.getElementById('alertBox');
    alertBox.textContent = message;
    alertBox.className = `alert-custom show ${type}`;

    setTimeout(() => {
        alertBox.classList.remove('show');
    }, 3000);
}

// 폼 적용
function applySettingsToUI(settings) {
    document.getElementById('strategy').value = settings.strategy || 'price';
    document.getElementById('buyPrice').value = settings.buyPrice || '';
    document.getElementById('sellPrice').value = settings.sellPrice || '';
    document.getElementById('tradeAmount').value = settings.tradeAmount || '';
    document.getElementById('investAmount').value = settings.investAmount || '';
    document.getElementById('stopLoss').value = settings.stopLoss || 2;
    document.getElementById('takeProfit').value = settings.takeProfit || 5;
}

// 페이지 로드 시 초기화
document.addEventListener('DOMContentLoaded', initialize);
