// 기술 지표 계산 엔진
class TechnicalIndicators {
    static calculateRSI(closes, period = 14) {
        try {
            if (!closes || closes.length < period) {
                console.warn('⚠️ RSI: 불충분한 데이터');
                return null;
            }

            const gains = [];
            const losses = [];

            for (let i = 1; i < closes.length; i++) {
                const diff = closes[i] - closes[i - 1];
                gains.push(diff > 0 ? diff : 0);
                losses.push(diff < 0 ? -diff : 0);
            }

            const recentGains = gains.slice(-period);
            const recentLosses = losses.slice(-period);

            const avgGain = recentGains.reduce((a, b) => a + b, 0) / period;
            const avgLoss = recentLosses.reduce((a, b) => a + b, 0) / period;

            if (avgLoss === 0) return 100;

            const rs = avgGain / avgLoss;
            const rsi = 100 - (100 / (1 + rs));

            return rsi.toFixed(2);
        } catch (error) {
            console.error('❌ RSI 계산 오류:', error);
            return null;
        }
    }

    static calculateMACD(closes, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
        try {
            if (!closes || closes.length < slowPeriod) {
                console.warn('⚠️ MACD: 불충분한 데이터');
                return null;
            }

            const ema12 = this.calculateEMA(closes, fastPeriod);
            const ema26 = this.calculateEMA(closes, slowPeriod);
            const macdValue = ema12 - ema26;

            // Signal line 계산
            const macdLines = [];
            for (let i = slowPeriod - 1; i < closes.length; i++) {
                const tempEMA12 = this.calculateEMA(closes.slice(0, i + 1), fastPeriod);
                const tempEMA26 = this.calculateEMA(closes.slice(0, i + 1), slowPeriod);
                macdLines.push(tempEMA12 - tempEMA26);
            }

            const signal = this.calculateEMA(macdLines, signalPeriod);

            return {
                macd: macdValue.toFixed(2),
                signal: signal.toFixed(2),
                histogram: (macdValue - signal).toFixed(2)
            };
        } catch (error) {
            console.error('❌ MACD 계산 오류:', error);
            return null;
        }
    }

    static calculateEMA(data, period) {
        try {
            if (!data || data.length === 0) return 0;

            const k = 2 / (period + 1);
            let ema = data[0];

            for (let i = 1; i < data.length; i++) {
                ema = data[i] * k + ema * (1 - k);
            }

            return ema;
        } catch (error) {
            console.error('❌ EMA 계산 오류:', error);
            return 0;
        }
    }

    static calculateSMA(data, period) {
        try {
            if (!data || data.length < period) {
                console.warn(`⚠️ SMA ${period}: 불충분한 데이터 (${data?.length || 0}/${period})`);
                return null;
            }

            const sum = data.slice(-period).reduce((a, b) => a + b, 0);
            return sum / period;
        } catch (error) {
            console.error('❌ SMA 계산 오류:', error);
            return null;
        }
    }

    static calculateBollingerBands(closes, period = 20, stdDev = 2) {
        try {
            if (!closes || closes.length < period) {
                console.warn('⚠️ 볼린저 밴드: 불충분한 데이터');
                return null;
            }

            const recentCloses = closes.slice(-period);
            const sma = recentCloses.reduce((a, b) => a + b, 0) / period;

            const variance = recentCloses
                .reduce((sum, price) => sum + Math.pow(price - sma, 2), 0) / period;

            const std = Math.sqrt(variance);

            return {
                upper: (sma + stdDev * std).toFixed(0),
                middle: sma.toFixed(0),
                lower: (sma - stdDev * std).toFixed(0)
            };
        } catch (error) {
            console.error('❌ 볼린저 밴드 계산 오류:', error);
            return null;
        }
    }

    static calculateATR(highs, lows, closes, period = 14) {
        try {
            if (!highs || !lows || !closes || highs.length < period) {
                console.warn('⚠️ ATR: 불충분한 데이터');
                return null;
            }

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

            return atr.toFixed(0);
        } catch (error) {
            console.error('❌ ATR 계산 오류:', error);
            return null;
        }
    }

    static analyzeTrendSignal(closes, highs, lows) {
        try {
            const signals = [];

            if (!closes || closes.length < 50) {
                console.warn('⚠️ 신호 분석: 불충분한 데이터');
                return signals;
            }

            // RSI
            const rsi = this.calculateRSI(closes);
            if (rsi) {
                if (rsi < 30) {
                    signals.push({
                        type: 'buy',
                        indicator: 'RSI',
                        strength: 'strong',
                        message: 'RSI 과매도 (<30) - 매수 신호'
                    });
                } else if (rsi > 70) {
                    signals.push({
                        type: 'sell',
                        indicator: 'RSI',
                        strength: 'strong',
                        message: 'RSI 과매수 (>70) - 매도 신호'
                    });
                }
            }

            // MACD
            const macd = this.calculateMACD(closes);
            if (macd) {
                const macdVal = parseFloat(macd.macd);
                const signalVal = parseFloat(macd.signal);

                if (macdVal > signalVal) {
                    signals.push({
                        type: 'buy',
                        indicator: 'MACD',
                        strength: 'medium',
                        message: 'MACD 골든크로스 - 매수 신호'
                    });
                } else {
                    signals.push({
                        type: 'sell',
                        indicator: 'MACD',
                        strength: 'medium',
                        message: 'MACD 데드크로스 - 매도 신호'
                    });
                }
            }

            // SMA
            const sma20 = this.calculateSMA(closes.slice(-20), 20);
            const sma50 = this.calculateSMA(closes.slice(-50), 50);

            if (sma20 && sma50) {
                if (sma20 > sma50) {
                    signals.push({
                        type: 'buy',
                        indicator: 'MA',
                        strength: 'medium',
                        message: 'SMA20 > SMA50 - 상승 추세'
                    });
                } else {
                    signals.push({
                        type: 'sell',
                        indicator: 'MA',
                        strength: 'medium',
                        message: 'SMA20 < SMA50 - 하락 추세'
                    });
                }
            }

            // 볼린저 밴드
            const bb = this.calculateBollingerBands(closes);
            if (bb) {
                const lastClose = closes[closes.length - 1];
                if (lastClose < bb.lower) {
                    signals.push({
                        type: 'buy',
                        indicator: 'BB',
                        strength: 'weak',
                        message: '볼린저 밴드 하한 근처 - 반등 신호'
                    });
                } else if (lastClose > bb.upper) {
                    signals.push({
                        type: 'sell',
                        indicator: 'BB',
                        strength: 'weak',
                        message: '볼린저 밴드 상한 근처 - 조정 신호'
                    });
                }
            }

            return signals;
        } catch (error) {
            console.error('❌ 신호 분석 오류:', error);
            return [];
        }
    }
}
