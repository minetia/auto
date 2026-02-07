// 글로벌 변수
let currentMarket = 'KRW-BTC';
let currentCoin = 'BTC';
let currentCoinId = 'bitcoin';
let currentTimeframe = '1h';
let updateInterval = null;

// 초기화
async function initialize() {
    updateTime();
    setInterval(updateTime, 1000);

    // 초기 차트 로드
    await chartEngine.update(currentMarket, currentTimeframe);

    // 실시간 업데이트 시작
    startRealtimeUpdate();

    // API 연결 상태 확인
    await checkAPIStatus();
}

// 현재 시간 업데이트
function updateTime() {
    const now = new Date();
    document.getElementById('lastUpdate').textContent = now.toLocaleTimeString('ko-KR');
}

// API 연결 상태 확인
async function checkAPIStatus() {
    const ticker = await UpbitAPI.getTicker('KRW-BTC');
    const statusDot = document.getElementById('statusDot');
    const statusText = document.getElementById('statusText');

    if (ticker && ticker[0]) {
        statusDot.style.background = '#10b981';
        statusText.textContent = '연결됨';
    } else {
        statusDot.style.background = '#ef4444';
        statusText.textContent = '연결 실패';
    }
}

// 코인 선택
async function selectCoin(market, coin, coinId) {
    currentMarket = market;
    currentCoin = coin;
    currentCoinId = coinId;

    // UI 업데이트
    document.querySelectorAll('.coin-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');

    document.getElementById('coinDisplay').textContent = `${coin} (${market})`;

    // 차트 업데이트
    await chartEngine.update(market, currentTimeframe);

    // 가격 데이터 업데이트
    await updatePriceData(market);

    // 지표 업데이트
    await updateIndicators();
}

// 시간 단위 변경
async function changeTimeframe(timeframe) {
    currentTimeframe = timeframe;

    // UI 업데이트
    document.querySelectorAll('.time-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');

    // 차트 업데이트
    await chartEngine.update(currentMarket, timeframe);
}

// 가격 데이터 업데이트
async function updatePriceData(market) {
    const ticker = await UpbitAPI.getTicker(market);

    if (!ticker || !ticker[0]) return;

    const tick = ticker[0];
    const changePercent = (tick.change_rate * 100).toFixed(2);

    // 통계 업데이트
    document.getElementById('currentPrice').textContent = 
        '₩' + tick.trade_price.toLocaleString();
    
    const change24hEl = document.getElementById('change24h');
    change24hEl.textContent = (changePercent > 0 ? '+' : '') + changePercent + '%';
    change24hEl.style.color = changePercent > 0 ? '#10b981' : '#ef4444';

    document.getElementById('volume24h').textContent = 
        (tick.acc_trade_volume / 1e8).toFixed(2) + '억';

    document.getElementById('highLow').textContent = 
        `₩${tick.high_price.toLocaleString()}/₩${tick.low_price.toLocaleString()}`;

    // 가격 정보 업데이트
    document.getElementById('priceHigh').textContent = '₩' + tick.high_price.toLocaleString();
    document.getElementById('priceLow').textContent = '₩' + tick.low_price.toLocaleString();
    document.getElementById('priceOpen').textContent = '₩' + tick.opening_price.toLocaleString();
    document.getElementById('priceVolume').textContent = 
        (tick.acc_trade_volume / 1e8).toFixed(2) + '억';
}

// 지표 업데이트
async function updateIndicators() {
    const candles = await UpbitAPI.getCandles(currentMarket, 'minutes60', 200);

    if (!candles || candles.length === 0) return;

    const closes = candles.reverse().map(c => c.trade_price);
    const highs = candles.map(c => c.high_price);
    const lows = candles.map(c => c.low_price);

    // RSI
    const rsi = TechnicalIndicators.calculateRSI(closes);
    document.getElementById('rsiValue').textContent = rsi || '-';

    // MACD
    const macd = TechnicalIndicators.calculateMACD(closes);
    document.getElementById('macdValue').textContent = 
        macd ? `${macd.macd} (신호: ${macd.signal})` : '-';

    // SMA
    const sma20 = TechnicalIndicators.calculateSMA(closes.slice(-20), 20);
    const sma50 = TechnicalIndicators.calculateSMA(closes.slice(-50), 50);

    document.getElementById('sma20Value').textContent = 
        sma20 ? '₩' + sma20.toLocaleString('ko-KR', { maximumFractionDigits: 0 }) : '-';
    document.getElementById('sma50Value').textContent = 
        sma50 ? '₩' + sma50.toLocaleString('ko-KR', { maximumFractionDigits: 0 }) : '-';

    // 볼린저 밴드
    const bb = TechnicalIndicators.calculateBollingerBands(closes);
    document.getElementById('bollingerValue').textContent = 
        bb ? `상: ₩${bb.upper} 중: ₩${bb.middle} 하: ₩${bb.lower}` : '-';

    // ATR
    const atr = TechnicalIndicators.calculateATR(highs, lows, closes);
    document.getElementById('atrValue').textContent = atr ? '₩' + atr : '-';

    // 매매 신호
    updateTradingSignals(closes, highs, lows);
}

// 매매 신호 업데이트
function updateTradingSignals(closes, highs, lows) {
    const signals = TechnicalIndicators.analyzeTrendSignal(closes, highs, lows);
    const signalsContainer = document.getElementById('tradingSignals');

    const signalHTML = signals.map(signal => {
        const bgColor = signal.type === 'buy' ? '#d1fae5' : '#fee2e2';
        const textColor = signal.type === 'buy' ? '#065f46' : '#7f1d1d';
        const icon = signal.type === 'buy' ? '📈' : '📉';
        const strengthText = signal.strength === 'strong' ? '강함' : signal.strength === 'medium' ? '중간' : '약함';

        return `
            <div style="padding: 12px; background: ${bgColor}; border-radius: 6px; color: ${textColor}; font-size: 13px; border-left: 3px solid ${signal.type === 'buy' ? '#10b981' : '#ef4444'};">
                <div style="font-weight: 700; margin-bottom: 3px;">
                    ${icon} ${signal.type === 'buy' ? '매수' : '매도'} 신호 (${strengthText})
                </div>
                <div style="font-size: 12px;">${signal.message}</div>
            </div>
        `;
    }).join('');

    signalsContainer.innerHTML = signalHTML || '<div style="padding: 12px; color: #999; font-size: 13px;">신호 없음</div>';
}

// 실시간 업데이트
function startRealtimeUpdate() {
    // 가격 데이터 업데이트 (5초마다)
    setInterval(() => updatePriceData(currentMarket), 5000);

    // 지표 업데이트 (10초마다)
    setInterval(() => updateIndicators(), 10000);
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

// 페이지 로드 시 초기화
document.addEventListener('DOMContentLoaded', initialize);

// 페이지 언로드 시 차트 제거
window.addEventListener('beforeunload', () => {
    chartEngine.destroy();
});
