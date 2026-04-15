import {
  IndicatorName,
  ParameterDefinition,
  StrategyDefinition,
  StrategyCategory,
  RuleNode,
} from "@/lib/quant/types";

const price = (field: "open" | "high" | "low" | "close" | "volume", source?: "primary" | "benchmark") => ({
  kind: "price" as const,
  field,
  source,
});

const indicator = (
  name: IndicatorName,
  params?: Record<string, number | string>,
  source?: "primary" | "benchmark",
) => strategyIndicator(name, params, source);

function strategyIndicator(
  name: IndicatorName,
  params?: Record<string, number | string>,
  source?: "primary" | "benchmark",
) {
  return {
    kind: "indicator" as const,
    name,
    params,
    source,
  };
}

const constant = (value: number | string) => ({ kind: "constant" as const, value });

const all = (...rules: RuleNode[]): RuleNode => ({ type: "all", rules });
const any = (...rules: RuleNode[]): RuleNode => ({ type: "any", rules });

const compare = (
  left: ReturnType<typeof price> | ReturnType<typeof indicator> | ReturnType<typeof constant>,
  comparator: "gt" | "gte" | "lt" | "lte" | "eq" | "crossesAbove" | "crossesBelow",
  right: ReturnType<typeof price> | ReturnType<typeof indicator> | ReturnType<typeof constant>,
) => ({
  type: "condition" as const,
  left,
  comparator,
  right,
});

const parameterSets = {
  fastSlow: [
    {
      key: "fastPeriod",
      label: "Fast Period",
      type: "number",
      defaultValue: 20,
      min: 2,
      max: 100,
      step: 1,
      description: "Shorter lookback for the fast signal.",
    },
    {
      key: "slowPeriod",
      label: "Slow Period",
      type: "number",
      defaultValue: 50,
      min: 5,
      max: 250,
      step: 1,
      description: "Longer lookback for the slower trend filter.",
    },
  ] satisfies ParameterDefinition[],
  rsi: [
    {
      key: "rsiPeriod",
      label: "RSI Period",
      type: "number",
      defaultValue: 14,
      min: 2,
      max: 50,
      step: 1,
      description: "Lookback used to compute RSI.",
    },
    {
      key: "oversold",
      label: "Oversold Threshold",
      type: "number",
      defaultValue: 30,
      min: 5,
      max: 50,
      step: 1,
      description: "RSI level that marks oversold conditions.",
    },
    {
      key: "overbought",
      label: "Overbought Threshold",
      type: "number",
      defaultValue: 70,
      min: 50,
      max: 95,
      step: 1,
      description: "RSI level that marks overbought conditions.",
    },
  ] satisfies ParameterDefinition[],
  breakout: [
    {
      key: "breakoutPeriod",
      label: "Breakout Period",
      type: "number",
      defaultValue: 20,
      min: 5,
      max: 120,
      step: 1,
      description: "Lookback used for price channel highs and lows.",
    },
  ] satisfies ParameterDefinition[],
  bollinger: [
    {
      key: "bollingerPeriod",
      label: "Bollinger Period",
      type: "number",
      defaultValue: 20,
      min: 5,
      max: 100,
      step: 1,
      description: "Lookback used for the moving average and bands.",
    },
    {
      key: "stdDev",
      label: "Band Width",
      type: "number",
      defaultValue: 2,
      min: 1,
      max: 4,
      step: 0.1,
      description: "Standard deviation multiplier for the bands.",
    },
  ] satisfies ParameterDefinition[],
};

const createStrategy = ({
  id,
  name,
  category,
  description,
  parameters = [],
  entry,
  exit,
  risk,
  benchmarkSymbol,
}: StrategyDefinition) => ({
  id,
  name,
  category,
  description,
  parameters,
  entry,
  exit,
  risk,
  benchmarkSymbol,
});

const strategies: StrategyDefinition[] = [
  createStrategy({
    id: "sma-crossover",
    name: "SMA Crossover",
    category: "Trend Following",
    description: "Long when the fast simple moving average crosses above the slow simple moving average.",
    parameters: parameterSets.fastSlow,
    entry: compare(
      indicator("sma", { period: "$fastPeriod" }),
      "crossesAbove",
      indicator("sma", { period: "$slowPeriod" }),
    ),
    exit: compare(
      indicator("sma", { period: "$fastPeriod" }),
      "crossesBelow",
      indicator("sma", { period: "$slowPeriod" }),
    ),
    risk: { stopLossPct: 0.06, takeProfitPct: 0.14, trailingStopPct: 0.08 },
  }),
  createStrategy({
    id: "ema-crossover",
    name: "EMA Crossover",
    category: "Trend Following",
    description: "Captures accelerating trends using a faster-reacting EMA pair.",
    parameters: parameterSets.fastSlow.map((item, index) => ({
      ...item,
      defaultValue: index === 0 ? 12 : 26,
    })),
    entry: compare(
      indicator("ema", { period: "$fastPeriod" }),
      "crossesAbove",
      indicator("ema", { period: "$slowPeriod" }),
    ),
    exit: compare(
      indicator("ema", { period: "$fastPeriod" }),
      "crossesBelow",
      indicator("ema", { period: "$slowPeriod" }),
    ),
    risk: { stopLossPct: 0.05, takeProfitPct: 0.12, trailingStopPct: 0.07 },
  }),
  createStrategy({
    id: "golden-cross",
    name: "Golden Cross",
    category: "Trend Following",
    description: "Classic 50 over 200 day crossover with a slower exit filter.",
    parameters: [],
    entry: compare(indicator("sma", { period: 50 }), "crossesAbove", indicator("sma", { period: 200 })),
    exit: compare(indicator("sma", { period: 50 }), "crossesBelow", indicator("sma", { period: 200 })),
    risk: { stopLossPct: 0.08, takeProfitPct: 0.2, trailingStopPct: 0.1 },
  }),
  createStrategy({
    id: "price-above-ema-stack",
    name: "Price Above EMA Stack",
    category: "Trend Following",
    description: "Requires price to trend above stacked EMAs before entering.",
    parameters: [],
    entry: all(
      compare(price("close"), "gt", indicator("ema", { period: 20 })),
      compare(indicator("ema", { period: 20 }), "gt", indicator("ema", { period: 50 })),
      compare(indicator("ema", { period: 50 }), "gt", indicator("ema", { period: 100 })),
    ),
    exit: any(
      compare(price("close"), "lt", indicator("ema", { period: 20 })),
      compare(indicator("ema", { period: 20 }), "crossesBelow", indicator("ema", { period: 50 })),
    ),
    risk: { stopLossPct: 0.05, takeProfitPct: 0.18, trailingStopPct: 0.07 },
  }),
  createStrategy({
    id: "adx-trend-follow",
    name: "ADX Trend Filter",
    category: "Trend Following",
    description: "Buys trend strength only when ADX confirms a persistent move.",
    parameters: [],
    entry: all(
      compare(indicator("adx", { period: 14 }), "gt", constant(22)),
      compare(indicator("plusDi", { period: 14 }), "gt", indicator("minusDi", { period: 14 })),
      compare(price("close"), "gt", indicator("ema", { period: 50 })),
    ),
    exit: any(
      compare(indicator("plusDi", { period: 14 }), "crossesBelow", indicator("minusDi", { period: 14 })),
      compare(indicator("adx", { period: 14 }), "lt", constant(18)),
    ),
    risk: { stopLossPct: 0.05, takeProfitPct: 0.15, trailingStopPct: 0.06 },
  }),
  createStrategy({
    id: "rsi-mean-reclaim",
    name: "RSI Oversold Reclaim",
    category: "Momentum",
    description: "Looks for RSI recovery from oversold territory with price reclaiming the EMA.",
    parameters: parameterSets.rsi,
    entry: all(
      compare(indicator("rsi", { period: "$rsiPeriod" }), "crossesAbove", constant("$oversold")),
      compare(price("close"), "gt", indicator("ema", { period: 20 })),
    ),
    exit: any(
      compare(indicator("rsi", { period: "$rsiPeriod" }), "gt", constant("$overbought")),
      compare(price("close"), "lt", indicator("ema", { period: 20 })),
    ),
    risk: { stopLossPct: 0.04, takeProfitPct: 0.1 },
  }),
  createStrategy({
    id: "macd-signal-reversal",
    name: "MACD Signal Reversal",
    category: "Momentum",
    description: "Enters when MACD line flips above the signal line while price remains above the 50 EMA.",
    parameters: [],
    entry: all(
      compare(indicator("macd", { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 }), "crossesAbove", indicator("macdSignal", { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 })),
      compare(price("close"), "gt", indicator("ema", { period: 50 })),
    ),
    exit: any(
      compare(indicator("macd", { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 }), "crossesBelow", indicator("macdSignal", { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 })),
      compare(indicator("macdHistogram", { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 }), "lt", constant(0)),
    ),
    risk: { stopLossPct: 0.05, takeProfitPct: 0.12 },
  }),
  createStrategy({
    id: "stochastic-oversold-pop",
    name: "Stochastic Oversold Pop",
    category: "Momentum",
    description: "Targets reversals when fast stochastic emerges from oversold conditions.",
    parameters: [],
    entry: all(
      compare(indicator("stochasticK", { period: 14, smoothPeriod: 3 }), "crossesAbove", indicator("stochasticD", { period: 14, smoothPeriod: 3 })),
      compare(indicator("stochasticK", { period: 14, smoothPeriod: 3 }), "lt", constant(25)),
    ),
    exit: any(
      compare(indicator("stochasticK", { period: 14, smoothPeriod: 3 }), "gt", constant(80)),
      compare(indicator("stochasticK", { period: 14, smoothPeriod: 3 }), "crossesBelow", indicator("stochasticD", { period: 14, smoothPeriod: 3 })),
    ),
    risk: { stopLossPct: 0.04, takeProfitPct: 0.08 },
  }),
  createStrategy({
    id: "roc-acceleration",
    name: "Rate of Change Acceleration",
    category: "Momentum",
    description: "Trades positive acceleration and exits when momentum rolls over.",
    parameters: [],
    entry: all(
      compare(indicator("roc", { period: 10 }), "gt", constant(4)),
      compare(indicator("roc", { period: 20 }), "gt", constant(0)),
    ),
    exit: any(
      compare(indicator("roc", { period: 10 }), "lt", constant(0)),
      compare(price("close"), "lt", indicator("ema", { period: 20 })),
    ),
    risk: { stopLossPct: 0.05, takeProfitPct: 0.12 },
  }),
  createStrategy({
    id: "dual-momentum",
    name: "Dual Momentum",
    category: "Momentum",
    description: "Combines price versus long trend and short-term momentum confirmation.",
    parameters: [],
    entry: all(
      compare(price("close"), "gt", indicator("sma", { period: 100 })),
      compare(indicator("roc", { period: 63 }), "gt", constant(6)),
      compare(indicator("rsi", { period: 14 }), "gt", constant(55)),
    ),
    exit: any(
      compare(indicator("roc", { period: 21 }), "lt", constant(-2)),
      compare(price("close"), "lt", indicator("sma", { period: 50 })),
    ),
    risk: { stopLossPct: 0.06, takeProfitPct: 0.16, trailingStopPct: 0.08 },
  }),
  createStrategy({
    id: "bollinger-reversion",
    name: "Bollinger Mean Reversion",
    category: "Mean Reversion",
    description: "Buys lower-band dislocations and exits on the move back to the mean.",
    parameters: parameterSets.bollinger,
    entry: compare(
      price("close"),
      "lt",
      indicator("bollingerLower", { period: "$bollingerPeriod", stdDev: "$stdDev" }),
    ),
    exit: any(
      compare(
        price("close"),
        "gte",
        indicator("bollingerMiddle", { period: "$bollingerPeriod", stdDev: "$stdDev" }),
      ),
      compare(indicator("rsi", { period: 14 }), "gt", constant(60)),
    ),
    risk: { stopLossPct: 0.04, takeProfitPct: 0.09 },
  }),
  createStrategy({
    id: "zscore-reversion",
    name: "Z-Score Reversion",
    category: "Mean Reversion",
    description: "Targets statistically stretched closes using a rolling z-score.",
    parameters: [],
    entry: compare(indicator("zscore", { period: 20 }), "lt", constant(-2)),
    exit: any(
      compare(indicator("zscore", { period: 20 }), "gte", constant(-0.2)),
      compare(price("close"), "gt", indicator("sma", { period: 20 })),
    ),
    risk: { stopLossPct: 0.04, takeProfitPct: 0.08 },
  }),
  createStrategy({
    id: "rsi-bollinger-reclaim",
    name: "RSI Bollinger Reclaim",
    category: "Mean Reversion",
    description: "Needs both volatility stretch and an RSI washout before buying the bounce.",
    parameters: [],
    entry: all(
      compare(price("close"), "lt", indicator("bollingerLower", { period: 20, stdDev: 2 })),
      compare(indicator("rsi", { period: 14 }), "lt", constant(30)),
    ),
    exit: any(
      compare(price("close"), "gte", indicator("bollingerMiddle", { period: 20, stdDev: 2 })),
      compare(indicator("rsi", { period: 14 }), "gt", constant(58)),
    ),
    risk: { stopLossPct: 0.05, takeProfitPct: 0.09 },
  }),
  createStrategy({
    id: "atr-pullback",
    name: "ATR Pullback Reversal",
    category: "Mean Reversion",
    description: "Seeks sharp pullbacks in a broader uptrend once price extends below ATR support.",
    parameters: [],
    entry: all(
      compare(price("close"), "gt", indicator("sma", { period: 100 })),
      compare(indicator("zscore", { period: 15 }), "lt", constant(-1.6)),
      compare(indicator("atr", { period: 14 }), "gt", constant(0)),
    ),
    exit: any(
      compare(price("close"), "gt", indicator("ema", { period: 20 })),
      compare(indicator("zscore", { period: 15 }), "gt", constant(-0.2)),
    ),
    risk: { stopLossPct: 0.045, takeProfitPct: 0.1 },
  }),
  createStrategy({
    id: "donchian-breakout",
    name: "Donchian Breakout",
    category: "Breakout",
    description: "Buys fresh channel highs and exits on a lower channel break.",
    parameters: parameterSets.breakout,
    entry: compare(price("close"), "crossesAbove", indicator("donchianUpper", { period: "$breakoutPeriod" })),
    exit: compare(price("close"), "crossesBelow", indicator("donchianLower", { period: 10 })),
    risk: { stopLossPct: 0.06, takeProfitPct: 0.18, trailingStopPct: 0.08 },
  }),
  createStrategy({
    id: "opening-range-breakout-daily",
    name: "Daily Range Expansion",
    category: "Breakout",
    description: "Uses a close above the recent high range with volume confirmation.",
    parameters: [],
    entry: all(
      compare(price("close"), "crossesAbove", indicator("donchianUpper", { period: 10 })),
      compare(price("volume"), "gt", indicator("volumeSma", { period: 20 })),
    ),
    exit: any(
      compare(price("close"), "lt", indicator("donchianMiddle", { period: 10 })),
      compare(price("close"), "lt", indicator("ema", { period: 20 })),
    ),
    risk: { stopLossPct: 0.05, takeProfitPct: 0.14, trailingStopPct: 0.06 },
  }),
  createStrategy({
    id: "bollinger-squeeze-breakout",
    name: "Bollinger Squeeze Breakout",
    category: "Breakout",
    description: "Looks for compressed volatility followed by upside release.",
    parameters: [],
    entry: all(
      compare(indicator("volatility", { period: 20 }), "lt", constant(18)),
      compare(price("close"), "crossesAbove", indicator("bollingerUpper", { period: 20, stdDev: 2 })),
    ),
    exit: any(
      compare(price("close"), "lt", indicator("ema", { period: 20 })),
      compare(indicator("volatility", { period: 20 }), "gt", constant(40)),
    ),
    risk: { stopLossPct: 0.05, takeProfitPct: 0.13, trailingStopPct: 0.06 },
  }),
  createStrategy({
    id: "high-tight-flag",
    name: "High Tight Flag",
    category: "Breakout",
    description: "Requires strong prior momentum followed by a shallow consolidation break.",
    parameters: [],
    entry: all(
      compare(indicator("roc", { period: 20 }), "gt", constant(12)),
      compare(price("close"), "crossesAbove", indicator("donchianUpper", { period: 15 })),
    ),
    exit: any(
      compare(price("close"), "lt", indicator("ema", { period: 10 })),
      compare(indicator("rsi", { period: 14 }), "lt", constant(45)),
    ),
    risk: { stopLossPct: 0.05, takeProfitPct: 0.18, trailingStopPct: 0.07 },
  }),
  createStrategy({
    id: "volume-spike-breakout",
    name: "Volume Spike Breakout",
    category: "Volume",
    description: "Confirms breakouts only when volume materially exceeds its rolling average.",
    parameters: [],
    entry: all(
      compare(price("close"), "crossesAbove", indicator("donchianUpper", { period: 20 })),
      compare(price("volume"), "gt", indicator("volumeSma", { period: 20 })),
      compare(indicator("roc", { period: 5 }), "gt", constant(2)),
    ),
    exit: any(
      compare(price("close"), "lt", indicator("ema", { period: 20 })),
      compare(price("volume"), "lt", indicator("volumeSma", { period: 10 })),
    ),
    risk: { stopLossPct: 0.05, takeProfitPct: 0.15, trailingStopPct: 0.06 },
  }),
  createStrategy({
    id: "obv-confirmation",
    name: "OBV Confirmation",
    category: "Volume",
    description: "Buys when price and on-balance volume trend higher together.",
    parameters: [],
    entry: all(
      compare(indicator("obv"), "gt", indicator("sma", { period: 10, input: "obv" })),
      compare(price("close"), "gt", indicator("sma", { period: 20 })),
      compare(price("volume"), "gt", indicator("volumeSma", { period: 20 })),
    ),
    exit: any(
      compare(indicator("obv"), "lt", indicator("sma", { period: 10, input: "obv" })),
      compare(price("close"), "lt", indicator("ema", { period: 20 })),
    ),
    risk: { stopLossPct: 0.05, takeProfitPct: 0.12 },
  }),
  createStrategy({
    id: "vwap-reclaim",
    name: "VWAP Reclaim",
    category: "Volume",
    description: "Targets sessions where price and participation reclaim long-run fair value.",
    parameters: [],
    entry: all(
      compare(price("close"), "crossesAbove", indicator("vwap")),
      compare(price("volume"), "gt", indicator("volumeSma", { period: 10 })),
    ),
    exit: any(
      compare(price("close"), "crossesBelow", indicator("vwap")),
      compare(indicator("rsi", { period: 14 }), "gt", constant(72)),
    ),
    risk: { stopLossPct: 0.04, takeProfitPct: 0.08 },
  }),
  createStrategy({
    id: "accumulation-pullback",
    name: "Accumulation Pullback",
    category: "Volume",
    description: "Rides uptrends that pull back on lighter volume and re-expand on stronger turnover.",
    parameters: [],
    entry: all(
      compare(price("close"), "gt", indicator("ema", { period: 50 })),
      compare(price("volume"), "gt", indicator("volumeSma", { period: 20 })),
      compare(indicator("rsi", { period: 14 }), "gt", constant(50)),
    ),
    exit: any(
      compare(price("close"), "lt", indicator("ema", { period: 20 })),
      compare(price("volume"), "lt", indicator("volumeSma", { period: 20 })),
    ),
    risk: { stopLossPct: 0.05, takeProfitPct: 0.12 },
  }),
  createStrategy({
    id: "atr-breakout-trend",
    name: "ATR Breakout Trend",
    category: "Volatility",
    description: "Enters only when both price and ATR expand together.",
    parameters: [],
    entry: all(
      compare(price("close"), "crossesAbove", indicator("donchianUpper", { period: 20 })),
      compare(indicator("atr", { period: 14 }), "gt", indicator("ema", { period: 14 })),
    ),
    exit: any(
      compare(price("close"), "lt", indicator("ema", { period: 20 })),
      compare(indicator("atr", { period: 14 }), "lt", indicator("ema", { period: 14 })),
    ),
    risk: { stopLossPct: 0.06, takeProfitPct: 0.16, trailingStopPct: 0.08 },
  }),
  createStrategy({
    id: "volatility-contraction-expansion",
    name: "Volatility Contraction Expansion",
    category: "Volatility",
    description: "Trades upside breakouts when annualized realized volatility compresses, then expands.",
    parameters: [],
    entry: all(
      compare(indicator("volatility", { period: 20 }), "lt", constant(22)),
      compare(price("close"), "crossesAbove", indicator("ema", { period: 20 })),
      compare(price("volume"), "gt", indicator("volumeSma", { period: 20 })),
    ),
    exit: any(
      compare(indicator("volatility", { period: 20 }), "gt", constant(42)),
      compare(price("close"), "lt", indicator("ema", { period: 20 })),
    ),
    risk: { stopLossPct: 0.05, takeProfitPct: 0.11 },
  }),
  createStrategy({
    id: "atr-channel-reversal",
    name: "ATR Channel Reversal",
    category: "Volatility",
    description: "Buys large downside deviations once volatility normalizes.",
    parameters: [],
    entry: all(
      compare(indicator("zscore", { period: 10 }), "lt", constant(-1.8)),
      compare(indicator("atr", { period: 14 }), "gt", constant(0)),
      compare(indicator("rsi", { period: 14 }), "lt", constant(35)),
    ),
    exit: any(
      compare(indicator("zscore", { period: 10 }), "gte", constant(-0.1)),
      compare(indicator("rsi", { period: 14 }), "gt", constant(60)),
    ),
    risk: { stopLossPct: 0.05, takeProfitPct: 0.09 },
  }),
  createStrategy({
    id: "volatility-regime-trend",
    name: "Volatility Regime Trend",
    category: "Volatility",
    description: "Favors long exposure when price is above long trend and realized volatility is not stressed.",
    parameters: [],
    entry: all(
      compare(price("close"), "gt", indicator("sma", { period: 200 })),
      compare(indicator("volatility", { period: 30 }), "lt", constant(28)),
      compare(indicator("adx", { period: 14 }), "gt", constant(20)),
    ),
    exit: any(
      compare(indicator("volatility", { period: 30 }), "gt", constant(38)),
      compare(price("close"), "lt", indicator("sma", { period: 100 })),
    ),
    risk: { stopLossPct: 0.06, takeProfitPct: 0.14, trailingStopPct: 0.08 },
  }),
  createStrategy({
    id: "relative-strength-spread",
    name: "Relative Strength Spread",
    category: "Statistical Arbitrage",
    description: "Buys a stock when its relative strength to SPY turns up from a depressed state.",
    benchmarkSymbol: "SPY",
    parameters: [],
    entry: all(
      compare(indicator("relativeStrength", { period: 20 }), "crossesAbove", constant(-1)),
      compare(price("close"), "gt", indicator("ema", { period: 20 })),
    ),
    exit: any(
      compare(indicator("relativeStrength", { period: 20 }), "lt", constant(-2)),
      compare(price("close"), "lt", indicator("ema", { period: 20 })),
    ),
    risk: { stopLossPct: 0.05, takeProfitPct: 0.12 },
  }),
  createStrategy({
    id: "pair-zscore-lite",
    name: "Pair Z-Score Lite",
    category: "Statistical Arbitrage",
    description: "Uses a benchmark-relative stretch and mean reversion trigger without shorting the benchmark leg.",
    benchmarkSymbol: "QQQ",
    parameters: [],
    entry: all(
      compare(indicator("relativeStrength", { period: 10 }), "lt", constant(-2.5)),
      compare(indicator("rsi", { period: 14 }), "lt", constant(35)),
    ),
    exit: any(
      compare(indicator("relativeStrength", { period: 10 }), "gte", constant(-0.5)),
      compare(indicator("rsi", { period: 14 }), "gt", constant(60)),
    ),
    risk: { stopLossPct: 0.05, takeProfitPct: 0.1 },
  }),
  createStrategy({
    id: "benchmark-dispersion-recovery",
    name: "Benchmark Dispersion Recovery",
    category: "Statistical Arbitrage",
    description: "Looks for underperformers versus the benchmark that regain local trend.",
    benchmarkSymbol: "SPY",
    parameters: [],
    entry: all(
      compare(indicator("relativeStrength", { period: 30 }), "lt", constant(-1.5)),
      compare(price("close"), "crossesAbove", indicator("ema", { period: 20 })),
    ),
    exit: any(
      compare(indicator("relativeStrength", { period: 30 }), "gte", constant(0)),
      compare(price("close"), "lt", indicator("ema", { period: 20 })),
    ),
    risk: { stopLossPct: 0.05, takeProfitPct: 0.11 },
  }),
  createStrategy({
    id: "ema-rsi-hybrid",
    name: "EMA RSI Hybrid",
    category: "Hybrid",
    description: "Requires trend alignment and a local momentum reset before entering.",
    parameters: [],
    entry: all(
      compare(indicator("ema", { period: 20 }), "gt", indicator("ema", { period: 50 })),
      compare(indicator("rsi", { period: 14 }), "crossesAbove", constant(40)),
      compare(price("close"), "gt", indicator("ema", { period: 20 })),
    ),
    exit: any(
      compare(indicator("rsi", { period: 14 }), "gt", constant(72)),
      compare(indicator("ema", { period: 20 }), "crossesBelow", indicator("ema", { period: 50 })),
    ),
    risk: { stopLossPct: 0.05, takeProfitPct: 0.13 },
  }),
  createStrategy({
    id: "macd-bollinger-hybrid",
    name: "MACD Bollinger Hybrid",
    category: "Hybrid",
    description: "Combines a volatility reset with MACD trend resumption.",
    parameters: [],
    entry: all(
      compare(price("close"), "gt", indicator("bollingerMiddle", { period: 20, stdDev: 2 })),
      compare(indicator("macd", { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 }), "crossesAbove", indicator("macdSignal", { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 })),
    ),
    exit: any(
      compare(price("close"), "lt", indicator("bollingerMiddle", { period: 20, stdDev: 2 })),
      compare(indicator("macdHistogram", { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 }), "lt", constant(0)),
    ),
    risk: { stopLossPct: 0.05, takeProfitPct: 0.12 },
  }),
  createStrategy({
    id: "trend-volume-breakout-hybrid",
    name: "Trend Volume Breakout Hybrid",
    category: "Hybrid",
    description: "Uses long trend alignment, breakout structure, and confirming participation.",
    parameters: [],
    entry: all(
      compare(price("close"), "gt", indicator("sma", { period: 100 })),
      compare(price("close"), "crossesAbove", indicator("donchianUpper", { period: 20 })),
      compare(price("volume"), "gt", indicator("volumeSma", { period: 20 })),
    ),
    exit: any(
      compare(price("close"), "lt", indicator("ema", { period: 20 })),
      compare(indicator("rsi", { period: 14 }), "lt", constant(45)),
    ),
    risk: { stopLossPct: 0.05, takeProfitPct: 0.15, trailingStopPct: 0.07 },
  }),
  createStrategy({
    id: "mean-trend-fusion",
    name: "Mean Trend Fusion",
    category: "Hybrid",
    description: "Buys pullbacks inside a broader uptrend once price mean reverts enough to reset.",
    parameters: [],
    entry: all(
      compare(price("close"), "gt", indicator("sma", { period: 100 })),
      compare(indicator("zscore", { period: 15 }), "lt", constant(-1.4)),
      compare(indicator("rsi", { period: 14 }), "lt", constant(42)),
    ),
    exit: any(
      compare(indicator("zscore", { period: 15 }), "gte", constant(0)),
      compare(indicator("rsi", { period: 14 }), "gt", constant(65)),
    ),
    risk: { stopLossPct: 0.05, takeProfitPct: 0.11 },
  }),
  createStrategy({
    id: "triple-confirmation",
    name: "Triple Confirmation",
    category: "Hybrid",
    description: "Needs trend, momentum, and volume all leaning bullish before entering.",
    parameters: [],
    entry: all(
      compare(price("close"), "gt", indicator("ema", { period: 50 })),
      compare(indicator("rsi", { period: 14 }), "gt", constant(55)),
      compare(price("volume"), "gt", indicator("volumeSma", { period: 20 })),
      compare(indicator("adx", { period: 14 }), "gt", constant(18)),
    ),
    exit: any(
      compare(indicator("rsi", { period: 14 }), "lt", constant(45)),
      compare(price("close"), "lt", indicator("ema", { period: 20 })),
    ),
    risk: { stopLossPct: 0.05, takeProfitPct: 0.14, trailingStopPct: 0.07 },
  }),
];

export const PREBUILT_STRATEGIES = strategies;

export const getStrategyById = (strategyId: string) =>
  PREBUILT_STRATEGIES.find((strategy) => strategy.id === strategyId) ?? null;

export const getStrategiesByCategory = () =>
  PREBUILT_STRATEGIES.reduce<Record<StrategyCategory, StrategyDefinition[]>>((accumulator, strategy) => {
    accumulator[strategy.category] ??= [];
    accumulator[strategy.category].push(strategy);
    return accumulator;
  }, {
    "Trend Following": [],
    Momentum: [],
    "Mean Reversion": [],
    Breakout: [],
    Volume: [],
    Volatility: [],
    "Statistical Arbitrage": [],
    Hybrid: [],
  });
