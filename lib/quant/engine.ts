import {
  BacktestMetrics,
  BacktestResult,
  Comparator,
  ConstantRef,
  IndicatorRef,
  MarketBar,
  MarketSeries,
  Operand,
  PaperTradingSessionInput,
  PaperTradingSnapshot,
  PriceRef,
  RuleNode,
  StrategyDefinition,
  StrategyRunInput,
  TradeRecord,
} from "@/lib/quant/types";
import {
  adx,
  atr,
  bollinger,
  donchian,
  ema,
  macd,
  obv,
  relativeStrength,
  roc,
  rsi,
  sma,
  stochastic,
  volatility,
  volumeSma,
  vwap,
  zscore,
} from "@/lib/quant/indicators";
import { getStrategyById } from "@/lib/quant/strategies";

type ComputationContext = {
  strategy: StrategyDefinition;
  parameters: Record<string, number | string>;
  primary: MarketSeries;
  benchmark?: MarketSeries | null;
  cache: Map<string, Array<number | null>>;
};

type OpenPosition = {
  id: string;
  entryIndex: number;
  entryTimestamp: string;
  entryPrice: number;
  quantity: number;
  highWaterMark: number;
};

const toFixed = (value: number) => Number(value.toFixed(4));

const generateId = () => Math.random().toString(36).slice(2, 10);

const normalizeBars = (bars: MarketBar[]) =>
  [...bars]
    .filter(
      (bar) =>
        Number.isFinite(bar.open) &&
        Number.isFinite(bar.high) &&
        Number.isFinite(bar.low) &&
        Number.isFinite(bar.close) &&
        Number.isFinite(bar.volume),
    )
    .sort((left, right) => new Date(left.timestamp).getTime() - new Date(right.timestamp).getTime());

const alignBenchmark = (primary: MarketBar[], benchmark: MarketBar[]) => {
  const benchmarkByDate = new Map(
    benchmark.map((bar) => [new Date(bar.timestamp).toISOString().slice(0, 10), bar]),
  );

  return primary
    .map((bar) => benchmarkByDate.get(new Date(bar.timestamp).toISOString().slice(0, 10)) ?? null)
    .filter((bar): bar is MarketBar | null => bar !== undefined);
};

const resolveParameterValue = (
  value: number | string | undefined,
  parameters: Record<string, number | string>,
) => {
  if (typeof value === "string" && value.startsWith("$")) {
    const parameterValue = parameters[value.slice(1)];
    return typeof parameterValue === "number" ? parameterValue : Number(parameterValue);
  }

  return typeof value === "string" ? Number(value) : value;
};

const resolveNumber = (
  ref: ConstantRef,
  parameters: Record<string, number | string>,
) => resolveParameterValue(ref.value, parameters) ?? 0;

const getSeriesFromBars = (bars: MarketBar[], field: PriceRef["field"]) => bars.map((bar) => bar[field]);

const getSourceBars = (context: ComputationContext, source: "primary" | "benchmark" = "primary") => {
  if (source === "benchmark") {
    return context.benchmark?.bars ?? [];
  }

  return context.primary.bars;
};

const indicatorKey = (ref: IndicatorRef, parameters: Record<string, number | string>) =>
  JSON.stringify({
    name: ref.name,
    source: ref.source ?? "primary",
    params: Object.fromEntries(
      Object.entries(ref.params ?? {}).map(([key, value]) => [key, resolveParameterValue(value, parameters)]),
    ),
  });

const computeIndicator = (context: ComputationContext, ref: IndicatorRef): Array<number | null> => {
  const key = indicatorKey(ref, context.parameters);
  const cached = context.cache.get(key);

  if (cached) return cached;

  const bars = getSourceBars(context, ref.source);
  const closes = bars.map((bar) => bar.close);
  const inputField = ref.params?.input;
  const selectedSeries =
    inputField === "obv"
      ? obv(bars).map((value) => value ?? 0)
      : getSeriesFromBars(bars, (inputField as PriceRef["field"] | undefined) ?? "close");
  const period = resolveParameterValue(ref.params?.period, context.parameters) ?? 14;

  let result: Array<number | null>;

  switch (ref.name) {
    case "sma":
      result = sma(selectedSeries, period);
      break;
    case "ema":
      result = ema(selectedSeries, period);
      break;
    case "rsi":
      result = rsi(closes, period);
      break;
    case "macd":
    case "macdSignal":
    case "macdHistogram": {
      const fastPeriod = resolveParameterValue(ref.params?.fastPeriod, context.parameters) ?? 12;
      const slowPeriod = resolveParameterValue(ref.params?.slowPeriod, context.parameters) ?? 26;
      const signalPeriod = resolveParameterValue(ref.params?.signalPeriod, context.parameters) ?? 9;
      const computed = macd(closes, fastPeriod, slowPeriod, signalPeriod);
      result =
        ref.name === "macd"
          ? computed.macdLine
          : ref.name === "macdSignal"
            ? computed.signal
            : computed.histogram;
      break;
    }
    case "stochasticK":
    case "stochasticD": {
      const smoothPeriod = resolveParameterValue(ref.params?.smoothPeriod, context.parameters) ?? 3;
      const computed = stochastic(bars, period, smoothPeriod);
      result = ref.name === "stochasticK" ? computed.k : computed.d;
      break;
    }
    case "bollingerUpper":
    case "bollingerLower":
    case "bollingerMiddle": {
      const stdDev = resolveParameterValue(ref.params?.stdDev, context.parameters) ?? 2;
      const computed = bollinger(closes, period, stdDev);
      result =
        ref.name === "bollingerUpper"
          ? computed.upper
          : ref.name === "bollingerLower"
            ? computed.lower
            : computed.middle;
      break;
    }
    case "atr":
      result = atr(bars, period);
      break;
    case "roc":
      result = roc(closes, period);
      break;
    case "zscore":
      result = zscore(closes, period);
      break;
    case "donchianUpper":
    case "donchianLower":
    case "donchianMiddle": {
      const computed = donchian(bars, period);
      result =
        ref.name === "donchianUpper"
          ? computed.upper
          : ref.name === "donchianLower"
            ? computed.lower
            : computed.middle;
      break;
    }
    case "obv":
      result = obv(bars);
      break;
    case "volumeSma":
      result = volumeSma(bars, period);
      break;
    case "vwap":
      result = vwap(bars);
      break;
    case "volatility":
      result = volatility(closes, period);
      break;
    case "adx":
    case "plusDi":
    case "minusDi": {
      const computed = adx(bars, period);
      result =
        ref.name === "adx"
          ? computed.adx
          : ref.name === "plusDi"
            ? computed.plusDi
            : computed.minusDi;
      break;
    }
    case "relativeStrength": {
      const benchmarkBars = context.benchmark?.bars ?? [];
      const benchmarkCloses = benchmarkBars.map((bar) => bar.close);
      result = relativeStrength(closes, benchmarkCloses, period);
      break;
    }
    default:
      result = closes.map(() => null);
  }

  context.cache.set(key, result);
  return result;
};

const getValueAt = (context: ComputationContext, operand: Operand, index: number): number | null => {
  if (operand.kind === "constant") {
    return resolveNumber(operand, context.parameters);
  }

  if (operand.kind === "price") {
    const bars = getSourceBars(context, operand.source);
    const value = bars[index - (operand.offset ?? 0)]?.[operand.field];
    return Number.isFinite(value) ? value : null;
  }

  const series = computeIndicator(context, operand);
  const value = series[index - (operand.offset ?? 0)];
  return value ?? null;
};

const compareValues = (
  comparator: Comparator,
  leftCurrent: number | null,
  rightCurrent: number | null,
  leftPrevious: number | null,
  rightPrevious: number | null,
) => {
  if (leftCurrent === null || rightCurrent === null) return false;

  switch (comparator) {
    case "gt":
      return leftCurrent > rightCurrent;
    case "gte":
      return leftCurrent >= rightCurrent;
    case "lt":
      return leftCurrent < rightCurrent;
    case "lte":
      return leftCurrent <= rightCurrent;
    case "eq":
      return leftCurrent === rightCurrent;
    case "crossesAbove":
      return (
        leftPrevious !== null &&
        rightPrevious !== null &&
        leftPrevious <= rightPrevious &&
        leftCurrent > rightCurrent
      );
    case "crossesBelow":
      return (
        leftPrevious !== null &&
        rightPrevious !== null &&
        leftPrevious >= rightPrevious &&
        leftCurrent < rightCurrent
      );
    default:
      return false;
  }
};

const evaluateRule = (context: ComputationContext, rule: RuleNode, index: number): boolean => {
  if (rule.type === "all") {
    return rule.rules.every((item) => evaluateRule(context, item, index));
  }

  if (rule.type === "any") {
    return rule.rules.some((item) => evaluateRule(context, item, index));
  }

  if (!("comparator" in rule)) {
    return false;
  }

  const condition = rule;
  const leftCurrent = getValueAt(context, condition.left, index);
  const rightCurrent = getValueAt(context, condition.right, index);
  const leftPrevious = getValueAt(context, condition.left, index - 1);
  const rightPrevious = getValueAt(context, condition.right, index - 1);

  return compareValues(condition.comparator, leftCurrent, rightCurrent, leftPrevious, rightPrevious);
};

const compileStrategy = (input: StrategyRunInput) => {
  const strategy = input.customStrategy ?? (input.strategyId ? getStrategyById(input.strategyId) : null);

  if (!strategy) {
    throw new Error("Unknown strategy.");
  }

  const parameters = Object.fromEntries(
    strategy.parameters.map((parameter) => [
      parameter.key,
      input.parameters?.[parameter.key] ?? parameter.defaultValue,
    ]),
  );

  return { strategy, parameters };
};

const computeMaxDrawdown = (equityCurve: BacktestResult["equityCurve"]) => {
  let peak = Number.NEGATIVE_INFINITY;
  let maxDrawdown = 0;

  equityCurve.forEach((point) => {
    peak = Math.max(peak, point.equity);
    if (peak > 0) {
      maxDrawdown = Math.max(maxDrawdown, ((peak - point.equity) / peak) * 100);
    }
  });

  return toFixed(maxDrawdown);
};

const computeSharpeRatio = (equityCurve: BacktestResult["equityCurve"]) => {
  const returns = equityCurve
    .map((point, index) => {
      if (index === 0 || equityCurve[index - 1].equity === 0) return null;
      return (point.equity - equityCurve[index - 1].equity) / equityCurve[index - 1].equity;
    })
    .filter((value): value is number => value !== null);

  if (returns.length < 2) return 0;

  const mean = returns.reduce((sum, value) => sum + value, 0) / returns.length;
  const variance = returns.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (returns.length - 1);
  const stdDev = Math.sqrt(variance);

  if (stdDev === 0) return 0;
  return toFixed((mean / stdDev) * Math.sqrt(252));
};

export const runBacktest = (
  input: StrategyRunInput,
  primarySeries: MarketSeries,
  benchmarkSeries?: MarketSeries | null,
): BacktestResult => {
  const { strategy, parameters } = compileStrategy(input);
  const primaryBars = normalizeBars(primarySeries.bars);

  if (primaryBars.length < 30) {
    throw new Error("Not enough market data to run a backtest.");
  }

  const alignedBenchmarkBars =
    benchmarkSeries?.bars && benchmarkSeries.bars.length > 0
      ? alignBenchmark(primaryBars, normalizeBars(benchmarkSeries.bars)).map((bar, index) => bar ?? {
          ...primaryBars[index],
          close: primaryBars[index].close,
          open: primaryBars[index].open,
          high: primaryBars[index].high,
          low: primaryBars[index].low,
          volume: primaryBars[index].volume,
        })
      : undefined;

  const context: ComputationContext = {
    strategy,
    parameters,
    primary: { symbol: primarySeries.symbol, bars: primaryBars },
    benchmark: alignedBenchmarkBars
      ? { symbol: benchmarkSeries?.symbol ?? strategy.benchmarkSymbol ?? "SPY", bars: alignedBenchmarkBars }
      : null,
    cache: new Map(),
  };

  const initialCapital = input.capital;
  let cash = initialCapital;
  let position: OpenPosition | null = null;
  const trades: TradeRecord[] = [];
  const equityCurve: BacktestResult["equityCurve"] = [];
  const executionDelay = Math.max(input.barExecutionDelay ?? 1, 1);

  for (let index = 1; index < primaryBars.length - executionDelay; index += 1) {
    const bar = primaryBars[index];

    if (!position && evaluateRule(context, strategy.entry, index)) {
      const executionBar = primaryBars[index + executionDelay];
      const quantity = Math.floor(cash / executionBar.open);

      if (quantity > 0) {
        const positionCost = quantity * executionBar.open;
        cash -= positionCost;
        position = {
          id: generateId(),
          entryIndex: index + executionDelay,
          entryTimestamp: executionBar.timestamp,
          entryPrice: executionBar.open,
          quantity,
          highWaterMark: executionBar.high,
        };
      }
    }

    if (position) {
      position.highWaterMark = Math.max(position.highWaterMark, bar.high);
      const barsHeld = index - position.entryIndex;
      const stopLossHit =
        strategy.risk.stopLossPct !== undefined &&
        bar.low <= position.entryPrice * (1 - strategy.risk.stopLossPct);
      const takeProfitHit =
        strategy.risk.takeProfitPct !== undefined &&
        bar.high >= position.entryPrice * (1 + strategy.risk.takeProfitPct);
      const trailingStopHit =
        strategy.risk.trailingStopPct !== undefined &&
        bar.low <= position.highWaterMark * (1 - strategy.risk.trailingStopPct);
      const timedExit =
        strategy.risk.maxBarsInTrade !== undefined && barsHeld >= strategy.risk.maxBarsInTrade;
      const signalExit = evaluateRule(context, strategy.exit, index);

      if (stopLossHit || takeProfitHit || trailingStopHit || timedExit || signalExit) {
        const executionBar = primaryBars[Math.min(index + executionDelay, primaryBars.length - 1)];
        const exitPrice = stopLossHit
          ? position.entryPrice * (1 - (strategy.risk.stopLossPct ?? 0))
          : takeProfitHit
            ? position.entryPrice * (1 + (strategy.risk.takeProfitPct ?? 0))
            : trailingStopHit
              ? position.highWaterMark * (1 - (strategy.risk.trailingStopPct ?? 0))
              : executionBar.open;

        const grossValue = position.quantity * exitPrice;
        cash += grossValue;

        const profitLoss = grossValue - position.entryPrice * position.quantity;
        trades.push({
          id: position.id,
          strategyId: strategy.id,
          symbol: primarySeries.symbol,
          direction: "LONG",
          entryTimestamp: position.entryTimestamp,
          entryPrice: toFixed(position.entryPrice),
          exitTimestamp: executionBar.timestamp,
          exitPrice: toFixed(exitPrice),
          quantity: position.quantity,
          profitLoss: toFixed(profitLoss),
          returnPct: toFixed((profitLoss / (position.entryPrice * position.quantity)) * 100),
          barsHeld,
          exitReason: stopLossHit
            ? "stop-loss"
            : takeProfitHit
              ? "take-profit"
              : trailingStopHit
                ? "trailing-stop"
                : timedExit
                  ? "max-hold"
                  : "signal",
        });
        position = null;
      }
    }

    const markPrice = position ? bar.close : 0;
    const positionValue = position ? position.quantity * markPrice : 0;
    const equity = cash + positionValue;
    const peak = equityCurve.length === 0 ? equity : Math.max(...equityCurve.map((point) => point.equity), equity);
    const drawdownPct = peak > 0 ? ((peak - equity) / peak) * 100 : 0;

    equityCurve.push({
      timestamp: bar.timestamp,
      equity: toFixed(equity),
      cash: toFixed(cash),
      positionValue: toFixed(positionValue),
      drawdownPct: toFixed(drawdownPct),
    });
  }

  const endingCapital = equityCurve.at(-1)?.equity ?? initialCapital;
  const winners = trades.filter((trade) => trade.profitLoss > 0);
  const losers = trades.filter((trade) => trade.profitLoss < 0);
  const grossProfit = winners.reduce((sum, trade) => sum + trade.profitLoss, 0);
  const grossLoss = Math.abs(losers.reduce((sum, trade) => sum + trade.profitLoss, 0));

  const metrics: BacktestMetrics = {
    totalProfitLoss: toFixed(endingCapital - initialCapital),
    returnPct: toFixed(((endingCapital - initialCapital) / initialCapital) * 100),
    maxDrawdownPct: computeMaxDrawdown(equityCurve),
    winRatePct: toFixed(trades.length === 0 ? 0 : (winners.length / trades.length) * 100),
    numberOfTrades: trades.length,
    profitFactor: grossLoss === 0 ? toFixed(grossProfit) : toFixed(grossProfit / grossLoss),
    averageTradeReturnPct: toFixed(
      trades.length === 0 ? 0 : trades.reduce((sum, trade) => sum + trade.returnPct, 0) / trades.length,
    ),
    sharpeRatio: computeSharpeRatio(equityCurve),
    endingCapital: toFixed(endingCapital),
  };

  return {
    symbol: input.symbol.toUpperCase(),
    benchmarkSymbol: benchmarkSeries?.symbol ?? strategy.benchmarkSymbol,
    strategy,
    parameters,
    startDate: input.startDate,
    endDate: input.endDate,
    initialCapital,
    metrics,
    equityCurve,
    trades,
  };
};

export const buildPaperTradingSnapshot = (
  sessionInput: PaperTradingSessionInput,
  primarySeries: MarketSeries,
  benchmarkSeries?: MarketSeries | null,
): { result: BacktestResult; snapshot: PaperTradingSnapshot } => {
  const endDate = primarySeries.bars.at(-1)?.timestamp ?? new Date().toISOString();
  const startDate =
    primarySeries.bars.at(Math.max(primarySeries.bars.length - (sessionInput.lookbackBars ?? 180), 0))?.timestamp ??
    primarySeries.bars[0]?.timestamp ??
    endDate;

  const result = runBacktest(
    {
      symbol: sessionInput.symbol,
      benchmarkSymbol: sessionInput.benchmarkSymbol,
      capital: sessionInput.capital,
      strategyId: sessionInput.strategyId,
      customStrategy: sessionInput.customStrategy,
      parameters: sessionInput.parameters,
      startDate,
      endDate,
    },
    primarySeries,
    benchmarkSeries,
  );

  const lastBar = primarySeries.bars.at(-1);
  const lastTrade = result.trades.at(-1);
  const snapshot: PaperTradingSnapshot = {
    lastEvaluatedAt: lastBar?.timestamp ?? new Date().toISOString(),
    equity: result.metrics.endingCapital,
    realizedProfitLoss: result.metrics.totalProfitLoss,
    unrealizedProfitLoss: 0,
    openPosition: null,
  };

  if (lastTrade && lastBar && new Date(lastTrade.exitTimestamp).getTime() < new Date(lastBar.timestamp).getTime()) {
    snapshot.openPosition = null;
  }

  return { result, snapshot };
};
