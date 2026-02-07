// 기술 지표 계산 엔진
class TechnicalIndicators {
    static calculateRSI(closes, period = 14) {
        if (closes.length < period) return null;

        const gains = [];
        const losses = [];

        for (let i = 1; i < closes.length; i++) {
            const diff = closes[i] - closes[i - 1];
            gains.push(diff > 0 ? diff : 0);
            losses.push(diff < 0 ? -diff : 0);
        }

        const avgGain = gains.slice(-period).reduce((a, b) => a + b, 0) / period;
        const avgLoss = losses.slice(-period).reduce((a, b) => a + b, 0) / period;

        const rs = avgGain / (avgLoss || 1);
        const rsi = 100 - (100 / (1 + rs));

        return rsi.toFixed(2);
    }

    static calculateMACD(closes, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
        if (closes.length < slowPeriod) return null;

        const ema12 = this.calculateEMA(closes, fastPeriod);
        const ema26 = this.calculateEMA(closes, slowPeriod);
        const macd = ema12 - ema26;

        // Signal line 계산
        const macdLine = [];
        for (let i = slowPeriod - 1; i < closes.length; i++) {
            const ema12_temp = this.calculateEMA(closes.slice(0, i + 1), fastPeriod);
            const ema26_temp = this.calculateEMA(closes.slice(0, i + 1), slowPeriod);
            macdLine.push(ema12_temp - ema26_temp);
        }

        const signal = this.calculateEMA(macdLine, signalPeriod);

        return {
            macd: macd.toFixed(2),
            signal: signal.toFixed(2),
            histogram: (macd - signal).toFixed(2)
        };
    }

    static calculateEMA(data, period) {
        const k = 2 / (period + 1);
        let ema = data[0];

        for (let i = 1; i < data.length; i++) {
            ema = data[i] * k + ema * (1 - k);
        }

        return ema;
    }

    static calculateSMA(data, period) {
        if (data.length < period) return null;

        let sum = 0;
        for (let i = 0; i < period; i++) {
            sum += data[i];
        }

        return sum / period;
    }

    static calculateBollingerBands(closes, period = 20, stdDev = 2) {
        if (closes.length < period) return null;

        const sma = this.calculateSMA(closes.slice(-period), period);

        const variance = closes
            .slice(-period)
            .reduce((sum, price) => sum + Math.pow(price - sma, 2), 0) / period;

        const std = Math.sqrt(variance);

        return {
            upper: (sma + stdDev * std).toFixed(2),
            middle: sma.toFixed(2),
            lower: (sma - stdDev * std).toFixed(2)
        };
    }

    static calculateATR(highs, lows, closes, period = 14) {
        if (highs.length < period) return null;

        const trs = [];

        for (let i = 1; i < highs.length; i++) {
            const tr1 = highs[i] - lows[i];
            const tr2 = Math.abs(highs[i] - closes[i - 1]);
            const tr3 = Math.abs(lows[i] - closes[i - 1]);

            trs.push(Math.max(tr1, tr2, tr3));
        }

        const atr = trs
            .slice(-period)
            .reduce((sum, tr) => sum + tr, 0) / period;

        return atr.toFixed(2);
    }

    static analyzeTrendSignal(closes, highs, lows) {
        const rsi = this.calculateRSI(closes);
        const macd = this.calculateMACD(closes);
        const sma20 = this.calculateSMA(closes.slice(-20), 20);
        const sma50 = this.calculateSMA(closes.slice(-50), 50);
        const bb = this.calculateBollingerBands(closes);

        const signals = [];

        // RSI 신호
        if (rsi < 30) {
            signals.push({ type: 'buy', indicator: 'RSI', strength: 'strong', message: 'RSI 과매도 (< 30)' });
        } else if (rsi > 70) {
            signals.push({ type: 'sell', indicator: 'RSI', strength: 'strong', message: 'RSI 과매수 (> 70)' });
        }

        // MACD 신호
        if (macd.macd > macd.signal) {
            signals.push({ type: 'buy', indicator: 'MACD', strength: 'medium', message: 'MACD 골든크로스' });
        } else {
            signals.push({ type: 'sell', indicator: 'MACD', strength: 'medium', message: 'MACD 데드크로스' });
        }

        // 이동평균선 신호
        if (sma20 > sma50) {
            signals.push({ type: 'buy', indicator: 'MA', strength: 'medium', message: 'SMA20 > SMA50 (상승 추세)' });
        } else {
            signals.push({ type: 'sell', indicator: 'MA', strength: 'medium', message: 'SMA20 < SMA50 (하락 추세)' });
        }

        // 볼린저 밴드 신호
        if (closes[closes.length - 1] < bb.lower) {
            signals.push({ type: 'buy', indicator: 'BB', strength: 'weak', message: '볼린저 밴드 하한 근처' });
        } else if (closes[closes.length - 1] > bb.upper) {
            signals.push({ type: 'sell', indicator: 'BB', strength: 'weak', message: '볼린저 밴드 상한 근처' });
        }

        return signals;
    }
}
