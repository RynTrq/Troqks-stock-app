import { MarketBar } from "@/lib/quant/types";

const round = (value: number) => Number(value.toFixed(6));

const mapNulls = (length: number) => Array.from({ length }, () => null as number | null);

export const sma = (values: number[], period: number) => {
  const result = mapNulls(values.length);
  let sum = 0;

  for (let index = 0; index < values.length; index += 1) {
    sum += values[index];

    if (index >= period) {
      sum -= values[index - period];
    }

    if (index >= period - 1) {
      result[index] = round(sum / period);
    }
  }

  return result;
};

export const ema = (values: number[], period: number) => {
  const result = mapNulls(values.length);
  const multiplier = 2 / (period + 1);
  let previous: number | null = null;

  values.forEach((value, index) => {
    if (index === period - 1) {
      const seed = values.slice(0, period).reduce((sum, item) => sum + item, 0) / period;
      previous = seed;
      result[index] = round(seed);
      return;
    }

    if (index < period || previous === null) {
      return;
    }

    previous = (value - previous) * multiplier + previous;
    result[index] = round(previous);
  });

  return result;
};

export const roc = (values: number[], period: number) =>
  values.map((value, index) => {
    if (index < period || values[index - period] === 0) return null;

    return round(((value - values[index - period]) / values[index - period]) * 100);
  });

export const rollingStdDev = (values: number[], period: number) =>
  values.map((_, index) => {
    if (index < period - 1) return null;
    const window = values.slice(index - period + 1, index + 1);
    const mean = window.reduce((sum, item) => sum + item, 0) / period;
    const variance =
      window.reduce((sum, item) => sum + (item - mean) ** 2, 0) / period;

    return round(Math.sqrt(variance));
  });

export const rsi = (values: number[], period: number) => {
  const result = mapNulls(values.length);
  let avgGain = 0;
  let avgLoss = 0;

  for (let index = 1; index < values.length; index += 1) {
    const change = values[index] - values[index - 1];
    const gain = Math.max(change, 0);
    const loss = Math.max(-change, 0);

    if (index <= period) {
      avgGain += gain;
      avgLoss += loss;

      if (index === period) {
        avgGain /= period;
        avgLoss /= period;
        const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
        result[index] = round(100 - 100 / (1 + rs));
      }

      continue;
    }

    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    result[index] = round(100 - 100 / (1 + rs));
  }

  return result;
};

export const macd = (values: number[], fastPeriod: number, slowPeriod: number, signalPeriod: number) => {
  const fast = ema(values, fastPeriod);
  const slow = ema(values, slowPeriod);
  const macdLine = values.map((_, index) => {
    if (fast[index] === null || slow[index] === null) return null;
    return round((fast[index] as number) - (slow[index] as number));
  });

  const signal = ema(
    macdLine.map((value) => value ?? 0),
    signalPeriod,
  ).map((value, index) => (macdLine[index] === null ? null : value));

  const histogram = macdLine.map((value, index) => {
    if (value === null || signal[index] === null) return null;
    return round(value - (signal[index] as number));
  });

  return { macdLine, signal, histogram };
};

export const stochastic = (bars: MarketBar[], period: number, smoothPeriod: number) => {
  const k = bars.map((bar, index) => {
    if (index < period - 1) return null;
    const window = bars.slice(index - period + 1, index + 1);
    const lowest = Math.min(...window.map((item) => item.low));
    const highest = Math.max(...window.map((item) => item.high));

    if (highest === lowest) return 50;
    return round(((bar.close - lowest) / (highest - lowest)) * 100);
  });

  const d = sma(
    k.map((value) => value ?? 0),
    smoothPeriod,
  ).map((value, index) => (k[index] === null ? null : value));

  return { k, d };
};

export const bollinger = (values: number[], period: number, stdDev: number) => {
  const middle = sma(values, period);
  const deviation = rollingStdDev(values, period);

  const upper = values.map((_, index) => {
    if (middle[index] === null || deviation[index] === null) return null;
    return round((middle[index] as number) + (deviation[index] as number) * stdDev);
  });

  const lower = values.map((_, index) => {
    if (middle[index] === null || deviation[index] === null) return null;
    return round((middle[index] as number) - (deviation[index] as number) * stdDev);
  });

  return { upper, middle, lower };
};

export const trueRange = (bars: MarketBar[]) =>
  bars.map((bar, index) => {
    if (index === 0) return round(bar.high - bar.low);
    const previousClose = bars[index - 1].close;

    return round(
      Math.max(
        bar.high - bar.low,
        Math.abs(bar.high - previousClose),
        Math.abs(bar.low - previousClose),
      ),
    );
  });

export const atr = (bars: MarketBar[], period: number) => ema(trueRange(bars), period);

export const zscore = (values: number[], period: number) => {
  const means = sma(values, period);
  const deviations = rollingStdDev(values, period);

  return values.map((value, index) => {
    if (means[index] === null || deviations[index] === null || deviations[index] === 0) {
      return null;
    }

    return round((value - (means[index] as number)) / (deviations[index] as number));
  });
};

export const donchian = (bars: MarketBar[], period: number) => {
  const upper = bars.map((_, index) => {
    if (index < period - 1) return null;
    return round(Math.max(...bars.slice(index - period + 1, index + 1).map((bar) => bar.high)));
  });

  const lower = bars.map((_, index) => {
    if (index < period - 1) return null;
    return round(Math.min(...bars.slice(index - period + 1, index + 1).map((bar) => bar.low)));
  });

  const middle = upper.map((value, index) => {
    if (value === null || lower[index] === null) return null;
    return round((value + (lower[index] as number)) / 2);
  });

  return { upper, lower, middle };
};

export const obv = (bars: MarketBar[]) => {
  const result = mapNulls(bars.length);
  let running = 0;
  result[0] = 0;

  for (let index = 1; index < bars.length; index += 1) {
    if (bars[index].close > bars[index - 1].close) running += bars[index].volume;
    if (bars[index].close < bars[index - 1].close) running -= bars[index].volume;
    result[index] = running;
  }

  return result;
};

export const volumeSma = (bars: MarketBar[], period: number) => sma(bars.map((bar) => bar.volume), period);

export const vwap = (bars: MarketBar[]) => {
  let cumulativePriceVolume = 0;
  let cumulativeVolume = 0;

  return bars.map((bar) => {
    const typicalPrice = (bar.high + bar.low + bar.close) / 3;
    cumulativePriceVolume += typicalPrice * bar.volume;
    cumulativeVolume += bar.volume;

    if (cumulativeVolume === 0) return null;
    return round(cumulativePriceVolume / cumulativeVolume);
  });
};

export const volatility = (values: number[], period: number) => {
  const dailyReturns = values.map((value, index) => {
    if (index === 0 || values[index - 1] === 0) return 0;
    return (value - values[index - 1]) / values[index - 1];
  });

  return rollingStdDev(dailyReturns, period).map((value) =>
    value === null ? null : round(value * Math.sqrt(252) * 100),
  );
};

export const adx = (bars: MarketBar[], period: number) => {
  const plusDm = mapNulls(bars.length);
  const minusDm = mapNulls(bars.length);
  const tr = trueRange(bars);

  for (let index = 1; index < bars.length; index += 1) {
    const upMove = bars[index].high - bars[index - 1].high;
    const downMove = bars[index - 1].low - bars[index].low;

    plusDm[index] = upMove > downMove && upMove > 0 ? round(upMove) : 0;
    minusDm[index] = downMove > upMove && downMove > 0 ? round(downMove) : 0;
  }

  const atrSeries = ema(tr.map((value) => value ?? 0), period);
  const plusDi = plusDm.map((_, index) => {
    if (atrSeries[index] === null || atrSeries[index] === 0) return null;
    const plusSeries = ema(plusDm.map((value) => value ?? 0), period);
    return plusSeries[index] === null ? null : round(((plusSeries[index] as number) / (atrSeries[index] as number)) * 100);
  });
  const minusDi = minusDm.map((_, index) => {
    if (atrSeries[index] === null || atrSeries[index] === 0) return null;
    const minusSeries = ema(minusDm.map((value) => value ?? 0), period);
    return minusSeries[index] === null ? null : round(((minusSeries[index] as number) / (atrSeries[index] as number)) * 100);
  });

  const dx = plusDi.map((value, index) => {
    if (value === null || minusDi[index] === null || value + (minusDi[index] as number) === 0) {
      return null;
    }
    return round((Math.abs(value - (minusDi[index] as number)) / (value + (minusDi[index] as number))) * 100);
  });

  const adxSeries = ema(dx.map((value) => value ?? 0), period).map((value, index) =>
    dx[index] === null ? null : value,
  );

  return { adx: adxSeries, plusDi, minusDi };
};

export const relativeStrength = (
  primaryValues: number[],
  benchmarkValues: number[],
  period: number,
) => {
  const ratio = primaryValues.map((value, index) => {
    const benchmarkValue = benchmarkValues[index];
    if (!benchmarkValue) return null;
    return round(value / benchmarkValue);
  });

  const ratioValues = ratio.map((value) => value ?? 0);
  return sma(ratioValues, period).map((value, index) => {
    if (ratio[index] === null || value === null || value === 0) return null;
    return round(((ratio[index] as number) / value - 1) * 100);
  });
};

