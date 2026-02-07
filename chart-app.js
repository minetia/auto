// 글로벌 변수
let currentMarket = 'KRW-BTC';
let currentCoin = 'BTC';
let currentCoinId = 'bitcoin';
let currentTimeframe = '1h';
let updateInterval = null;
let chartReady = false;

// 초기화
async function initialize() {
    console.log('🚀 애플리케이션 초기화 시작...');
    
    updateTime();
    setInterval(updateTime, 1000);

    // 상태 업데이트
    updateConnectionStatus(true);

    try {
        // 초기 차트 로드
        console.log('📊 차트 로드 중...');
        await chartEngine.update(currentMarket, currentTimeframe);
        chartReady = true;
        document.getElementById('chartLoading').style.display = 'none';
        
        // 초기 데이터 로드
        console.log('📈 가격 데이터 로드 중...');
        await updatePriceData(currentMarket);
        
        // 지표 업데이트
        console.log('📊 기술 지표 계산 중...');
        await updateIndicators();

        // 실시간 업데이트 시작
        console.log('⚡ 실시간 업데이트 시작...');
        startRealtimeUpdate();

        showAlert('✅ 데이터 로드 완료! 차트가 준비되었습니다.', 'success');
        console.log('✅ 초기화 완료');
    } catch (error) {
        console.error('❌ 초기화 오류:', error);
        showAlert('⚠️ 데이터 로드 중 오류가 발생했습니다. 새로고침하세요.', 'error');
    }
}

// 현재 시간 업데이트
function updateTime() {
    const now = new Date();
    document.getElementById('lastUpdate').textContent = now.toLocaleTimeString('ko-KR');
}

// 연결 상태 업데이트
function updateConnectionStatus(connected) {
    const statusDot = document.getElementById('statusDot');
    const statusText = document.getElementById('statusText');

    if (connected) {
        statusDot.style.background = '#10b981';
        statusText.textContent = '✅ 데이터 준비됨';
    } else {
        statusDot.style.background = '#ef4444';
        statusText.textContent = '❌ 데이터 로드 중...';
    }
}

// 코인 선택
async function selectCoin(market, coin, coinId) {
    console.log(`🔄 코인 변경: ${coin}`);
    
    currentMarket = market;
    currentCoin = coin;
    currentCoinId = coinId;

    // UI 업데이트
    document.querySelectorAll('.coin-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');

    document.getElementById('coinDisplay').textContent = `${coin} (${market})`;

    // 로딩 상태
    updateConnectionStatus(false);
    document.getElementById('chartLoading').style.display = 'flex';

    try {
        // 차트 업데이트
        await chartEngine.update(market, currentTimeframe);
        
        // 가격 데이터 업데이트
        await updatePriceData(market);
        
        // 지표 업데이트
        await updateIndicators();

        document.getElementById('chartLoading').style.display = 'none';
        updateConnectionStatus(true);
        console.log(`✅ ${coin} 로드 완료`);
    } catch (error) {
        console.error('❌ 코인 선택 오류:', error);
        showAlert('⚠️ 코인 로드 실패', 'error');
    }
}

// 시간 단위 변경
async function changeTimeframe(timeframe) {
    console.log(`⏱️ 시간 단위 변경: ${timeframe}`);
    
    currentTimeframe = timeframe;

    // UI 업데이트
    document.querySelectorAll('.time-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');

    // 로딩 상태
    document.getElementById('chartLoading').style.display = 'flex';

    try {
        await chartEngine.update(currentMarket, timeframe);
        await updatePriceData(currentMarket);
        await updateIndicators();
        
        document.getElementById('chartLoading').style.display = 'none';
        console.log(`✅ 시간 단위 변경 완료: ${timeframe}`);
    } catch (error) {
        console.error('❌ 시간 단위 변경 오류:', error);
        showAlert('⚠️ 차트 업데이트 실패', 'error');
    }
}

// 가격 데이터 업데이트
async function updatePriceData(market) {
    try {
        const ticker = await UpbitAPI.getTicker(market);

        if (!ticker || ticker.length === 0) {
            console.warn('⚠️ Ticker 데이터 없음, 목 데이터 사용');
            const mockData = UpbitAPI.getMockData(market);
            updatePriceDisplay(mockData[0]);
            return;
        }

        const tick = ticker[0];
        console.log(`📊 ${market} 가격: ₩${tick.trade_price.toLocaleString()}`);
        updatePriceDisplay(tick);
    } catch (error) {
        console.error('❌ 가격 데이터 로드 오류:', error);
        
        // 폴백: 목 데이터 사용
        const mockData = UpbitAPI.getMockData(market);
        updatePriceDisplay(mockData[0]);
    }
}

// 가격 표시 업데이트
function updatePriceDisplay(ticker) {
    try {
        const changePercent = (ticker.change_rate * 100).toFixed(2);
        const changeAmount = ticker.change_price;

        // 통계 업데이트
        document.getElementById('currentPrice').textContent = 
            '₩' + ticker.trade_price.toLocaleString('ko-KR', { maximumFractionDigits: 0 });
        
        const change24hEl = document.getElementById('change24h');
        change24hEl.textContent = (changePercent > 0 ? '+' : '') + changePercent + '%';
        change24hEl.style.color = changePercent > 0 ? '#10b981' : '#ef4444';

        const volume = (ticker.acc_trade_volume / 1e8).toFixed(2);
        document.getElementById('volume24h').textContent = volume + '억';

        document.getElementById('highLow').textContent = 
            `₩${ticker.high_price.toLocaleString('ko-KR', { maximumFractionDigits: 0 })}/₩${ticker.low_price.toLocaleString('ko-KR', { maximumFractionDigits: 0 })}`;

        // 가격 정보 업데이트
        document.getElementById('priceHigh').textContent = 
            '₩' + ticker.high_price.toLocaleString('ko-KR', { maximumFractionDigits: 0 });
        document.getElementById('priceLow').textContent = 
            '₩' + ticker.low_price.toLocaleString('ko-KR', { maximumFractionDigits: 0 });
        document.getElementById('priceOpen').textContent = 
            '₩' + ticker.opening_price.toLocaleString('ko-KR', { maximumFractionDigits: 0 });
        document.getElementById('priceVolume').textContent = 
            (ticker.acc_trade_volume / 1e8).toFixed(2) + '억';

        console.log('✅ 가격 표시 업데이트 완료');
    } catch (error) {
        console.error('❌ 가격 표시 오류:', error);
    }
}

// 지표 업데이트
async function updateIndicators() {
    try {
        console.log('📊 기술 지표 계산 중...');
        
        const candles = await UpbitAPI.getCandles(currentMarket, 'minutes60', 200);

        if (!candles || candles.length === 0) {
            console.warn('⚠️ Candles 데이터 없음, 목 데이터 사용');
            const mockCandles = UpbitAPI.getMockCandles(currentMarket, 200);
            updateIndicatorsDisplay(mockCandles);
            return;
        }

        updateIndicatorsDisplay(candles);
    } catch (error) {
        console.error('❌ 지표 계산 오류:', error);
        
        // 폴백: 목 데이터 사용
        const mockCandles = UpbitAPI.getMockCandles(currentMarket, 200);
        updateIndicatorsDisplay(mockCandles);
    }
}

// 지표 표시 업데이트
function updateIndicatorsDisplay(candles) {
    try {
        if (!candles || candles.length < 50) {
            console.warn('⚠️ 지표 계산 불충분한 데이터');
            return;
        }

        const closes = candles.reverse().map(c => c.trade_price);
        const highs = candles.map(c => c.high_price);
        const lows = candles.map(c => c.low_price);

        console.log(`📊 지표 계산 시작 (${closes.length}개 캔들)`);

        // RSI 계산
        const rsi = TechnicalIndicators.calculateRSI(closes, 14);
        const rsiEl = document.getElementById('rsiValue');
        if (rsi) {
            rsiEl.textContent = rsi;
            rsiEl.style.color = rsi < 30 ? '#10b981' : rsi > 70 ? '#ef4444' : '#667eea';
        } else {
            rsiEl.textContent = '-';
        }
        console.log(`✅ RSI: ${rsi}`);

        // MACD 계산
        const macd = TechnicalIndicators.calculateMACD(closes);
        const macdEl = document.getElementById('macdValue');
        if (macd) {
            macdEl.textContent = `${macd.macd} (S: ${macd.signal})`;
            macdEl.style.color = macd.macd > macd.signal ? '#10b981' : '#ef4444';
        } else {
            macdEl.textContent = '-';
        }
        console.log(`✅ MACD: ${macd?.macd}`);

        // SMA 계산
        const sma20 = TechnicalIndicators.calculateSMA(closes.slice(-20), 20);
        const sma50 = TechnicalIndicators.calculateSMA(closes.slice(-50), 50);

        document.getElementById('sma20Value').textContent = 
            sma20 ? '₩' + sma20.toLocaleString('ko-KR', { maximumFractionDigits: 0 }) : '-';
        document.getElementById('sma50Value').textContent = 
            sma50 ? '₩' + sma50.toLocaleString('ko-KR', { maximumFractionDigits: 0 }) : '-';
        
        console.log(`✅ SMA 20: ${sma20}, SMA 50: ${sma50}`);

        // 볼린저 밴드 계산
        const bb = TechnicalIndicators.calculateBollingerBands(closes);
        const bbEl = document.getElementById('bollingerValue');
        if (bb) {
            bbEl.textContent = `상: ${bb.upper} 중: ${bb.middle} 하: ${bb.lower}`;
        } else {
            bbEl.textContent = '-';
        }
        console.log(`✅ 볼린저 밴드 계산 완료`);

        // ATR 계산
        const atr = TechnicalIndicators.calculateATR(highs, lows, closes);
        document.getElementById('atrValue').textContent = atr ? '₩' + atr : '-';
        console.log(`✅ ATR: ${atr}`);

        // 매매 신호 업데이트
        updateTradingSignals(closes, highs, lows);

        console.log('✅ 모든 지표 계산 완료');
    } catch (error) {
        console.error('❌ 지표 표시 오류:', error);
    }
}

// 매매 신호 업데이트
function updateTradingSignals(closes, highs, lows) {
    try {
        console.log('🎯 매매 신호 분석 중...');
        
        const signals = TechnicalIndicators.analyzeTrendSignal(closes, highs, lows);
        const signalsContainer = document.getElementById('tradingSignals');

        if (!signals || signals.length === 0) {
            signalsContainer.innerHTML = '<div style="padding: 12px; color: #999; font-size: 13px;">신호 분석 중...</div>';
            return;
        }

        const signalHTML = signals.map(signal => {
            const bgColor = signal.type === 'buy' ? '#d1fae5' : '#fee2e2';
            const textColor = signal.type === 'buy' ? '#065f46' : '#7f1d1d';
            const icon = signal.type === 'buy' ? '📈' : '📉';
            const strengthText = signal.strength === 'strong' ? '강함' : signal.strength === 'medium' ? '중간' : '약함';

            return `
                <div style="padding: 12px; background: ${bgColor}; border-radius: 6px; color: ${textColor}; font-size: 13px; border-left: 3px solid ${signal.type === 'buy' ? '#10b981' : '#ef4444'};">
                    <div style="font-weight: 700; margin-bottom: 3px;">
                        ${icon} ${signal.type === 'buy' ? '📈 매수' : '📉 매도'} (${strengthText})
                    </div>
                    <div style="font-size: 12px;">${signal.message}</div>
                </div>
            `;
        }).join('');

        signalsContainer.innerHTML = signalHTML;
        console.log(`✅ ${signals.length}개 신호 생성됨`);
    } catch (error) {
        console.error('❌ 매매 신호 오류:', error);
    }
}

// 실시간 업데이트
function startRealtimeUpdate() {
    // 가격 데이터 업데이트 (5초마다)
    setInterval(() => {
        updatePriceData(currentMarket);
    }, 5000);

    // 지표 업데이트 (10초마다)
    setInterval(() => {
        updateIndicators();
    }, 10000);

    console.log('⚡ 실시간 업데이트 활성화');
}

// 알림 표시
function showAlert(message, type) {
    const alertBox = document.getElementById('alertBox');
    alertBox.innerHTML = message;
    alertBox.className = `alert-custom show ${type}`;

    setTimeout(() => {
        alertBox.classList.remove('show');
    }, 4000);

    console.log(`[${type.toUpperCase()}] ${message}`);
}

// 페이지 로드 시 초기화
document.addEventListener('DOMContentLoaded', () => {
    console.log('📄 페이지 로드됨, 초기화 시작...');
    initialize();
});

// 페이지 언로드 시 차트 제거
window.addEventListener('beforeunload', () => {
    if (chartEngine && chartEngine.destroy) {
        chartEngine.destroy();
    }
});

// 에러 처리
window.addEventListener('error', (event) => {
    console.error('❌ 글로벌 에러:', event.error);
    showAlert('⚠️ 오류 발생: ' + event.error.message, 'error');
});
