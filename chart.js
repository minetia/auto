// TradingView Lightweight Charts 엔진
class AdvancedChartEngine {
    constructor() {
        this.chart = null;
        this.candleSeries = null;
        this.volumeSeries = null;
        this.sma20Series = null;
        this.sma50Series = null;
        this.container = document.getElementById('chartContainer');
        this.currentTimeframe = '1h';
        this.currentMarket = 'KRW-BTC';
        this.candles = [];
        this.updateInterval = null;
    }

    // 차트 초기화
    initChart() {
        if (this.chart) {
            this.chart.remove();
        }

        const { LightweightCharts } = window;
        
        this.chart = LightweightCharts.createChart(this.container, {
            layout: {
                textColor: '#666',
                background: { color: '#ffffff' },
            },
            width: this.container.clientWidth,
            height: 500,
            timeScale: {
                timeVisible: true,
                secondsVisible: false,
            },
            crosshair: {
                mode: LightweightCharts.CrosshairMode.Normal,
            },
        });

        // 캔들 시리즈
        this.candleSeries = this.chart.addCandlestickSeries({
            upColor: '#10b981',
            downColor: '#ef4444',
            borderUpColor: '#10b981',
            borderDownColor: '#ef4444',
            wickUpColor: '#10b981',
            wickDownColor: '#ef4444',
        });

        // SMA 20
        this.sma20Series = this.chart.addLineSeries({
            color: '#f59e0b',
            lineWidth: 2,
            title: 'SMA 20',
        });

        // SMA 50
        this.sma50Series = this.chart.addLineSeries({
            color: '#10b981',
            lineWidth: 2,
            title: 'SMA 50',
        });

        // 거래량 시리즈
        this.volumeSeries = this.chart.addHistogramSeries({
            color: '#8b5cf6',
            priceFormat: {
                type: 'volume',
            },
            priceScaleId: 'volume',
        });

        // 우측 Y축 설정
        this.chart.priceScale('right').applyOptions({
            scaleMargins: {
                top: 0.1,
                bottom: 0.3,
            },
        });

        // 거래량 Y축
        this.chart.priceScale('volume').applyOptions({
            scaleMargins: {
                top: 0.7,
                bottom: 0,
            },
        });

        // 창 크기 변경 시 차트 크기 조정
        window.addEventListener('resize', () => this.handleResize());
    }

    // 데이터 로드
    async loadData(market, timeframe) {
        try {
            const mapping = {
                '1m': 'minutes1',
                '5m': 'minutes5',
                '15m': 'minutes15',
                '1h': 'minutes60',
                '4h': 'minutes240',
                '1d': 'days'
            };

            const unit = mapping[timeframe] || 'minutes60';
            const candles = await UpbitAPI.getCandles(market, unit, 200);

            if (!candles || candles.length === 0) {
                console.error('차트 데이터 없음');
                return;
            }

            // 오름차순으로 정렬
            this.candles = candles.reverse();

            // 캔들 데이터 준비
            const candleData = this.candles.map(candle => ({
                time: this.convertTime(candle.candle_date_time_kst),
                open: candle.opening_price,
                high: candle.high_price,
                low: candle.low_price,
                close: candle.trade_price,
            }));

            // 거래량 데이터
            const volumeData = this.candles.map(candle => ({
                time: this.convertTime(candle.candle_date_time_kst),
                value: candle.candle_acc_trade_volume,
                color: candle.trade_price >= candle.opening_price ? '#10b98133' : '#ef444433',
            }));

            // SMA 계산
            const sma20Data = this.calculateSMA(candleData, 20);
            const sma50Data = this.calculateSMA(candleData, 50);

            // 차트에 데이터 설정
            this.candleSeries.setData(candleData);
            this.volumeSeries.setData(volumeData);
            this.sma20Series.setData(sma20Data);
            this.sma50Series.setData(sma50Data);

            // 시간 범위 자동 조정
            this.chart.timeScale().fitContent();

            console.log(`📊 차트 로드 완료: ${market} ${timeframe}`);
        } catch (error) {
            console.error('차트 데이터 로드 오류:', error);
        }
    }

    // 시간 변환
    convertTime(dateString) {
        const date = new Date(dateString);
        return Math.floor(date.getTime() / 1000);
    }

    // SMA 계산
    calculateSMA(data, period) {
        const smaData = [];

        for (let i = 0; i < data.length; i++) {
            if (i < period - 1) continue;

            const sum = data
                .slice(i - period + 1, i + 1)
                .reduce((acc, candle) => acc + candle.close, 0);

            const sma = sum / period;

            smaData.push({
                time: data[i].time,
                value: sma,
            });
        }

        return smaData;
    }

    // 창 크기 변경 처리
    handleResize() {
        if (this.chart && this.container) {
            this.chart.applyOptions({
                width: this.container.clientWidth,
            });
        }
    }

    // 업데이트
    async update(market, timeframe) {
        this.currentMarket = market;
        this.currentTimeframe = timeframe;
        this.initChart();
        await this.loadData(market, timeframe);
    }

    // 차트 제거
    destroy() {
        if (this.chart) {
            this.chart.remove();
            this.chart = null;
        }
    }
}

const chartEngine = new AdvancedChartEngine();
