export type StrategyCategory =
  | "Trend Following"
  | "Momentum"
  | "Mean Reversion"
  | "Breakout"
  | "Volume"
  | "Volatility"
  | "Statistical Arbitrage"
  | "Hybrid";

export type PriceField = "open" | "high" | "low" | "close" | "volume";
export type SeriesSource = "primary" | "benchmark";
export type Comparator =
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "eq"
  | "crossesAbove"
  | "crossesBelow";

export type IndicatorName =
  | "sma"
  | "ema"
  | "rsi"
  | "macd"
  | "macdSignal"
  | "macdHistogram"
  | "stochasticK"
  | "stochasticD"
  | "bollingerUpper"
  | "bollingerLower"
  | "bollingerMiddle"
  | "atr"
  | "roc"
  | "zscore"
  | "donchianUpper"
  | "donchianLower"
  | "donchianMiddle"
  | "obv"
  | "volumeSma"
  | "vwap"
  | "volatility"
  | "adx"
  | "plusDi"
  | "minusDi"
  | "relativeStrength";

export type ParameterDefinition = {
  key: string;
  label: string;
  type: "number" | "string";
  defaultValue: number | string;
  min?: number;
  max?: number;
  step?: number;
  description: string;
};

export type IndicatorRef = {
  kind: "indicator";
  name: IndicatorName;
  source?: SeriesSource;
  params?: Record<string, number | string>;
  offset?: number;
};

export type PriceRef = {
  kind: "price";
  field: PriceField;
  source?: SeriesSource;
  offset?: number;
};

export type ConstantRef = {
  kind: "constant";
  value: number | string;
};

export type Operand = IndicatorRef | PriceRef | ConstantRef;

export type RuleCondition = {
  type: "condition";
  left: Operand;
  comparator: Comparator;
  right: Operand;
};

export type RuleGroup = {
  type: "all" | "any";
  rules: RuleNode[];
};

export type RuleNode = RuleCondition | RuleGroup;

export type StrategyRisk = {
  stopLossPct?: number;
  takeProfitPct?: number;
  trailingStopPct?: number;
  maxBarsInTrade?: number;
};

export type StrategyDefinition = {
  id: string;
  name: string;
  category: StrategyCategory;
  description: string;
  benchmarkSymbol?: string;
  parameters: ParameterDefinition[];
  entry: RuleNode;
  exit: RuleNode;
  risk: StrategyRisk;
};

export type MarketBar = {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type MarketSeries = {
  symbol: string;
  bars: MarketBar[];
};

export type StrategyRunInput = {
  symbol: string;
  benchmarkSymbol?: string;
  startDate: string;
  endDate: string;
  capital: number;
  strategyId?: string;
  customStrategy?: StrategyDefinition;
  parameters?: Record<string, number | string>;
  barExecutionDelay?: number;
};

export type TradeDirection = "LONG";

export type TradeRecord = {
  id: string;
  strategyId: string;
  symbol: string;
  direction: TradeDirection;
  entryTimestamp: string;
  entryPrice: number;
  exitTimestamp: string;
  exitPrice: number;
  quantity: number;
  profitLoss: number;
  returnPct: number;
  barsHeld: number;
  exitReason: string;
};

export type EquityPoint = {
  timestamp: string;
  equity: number;
  cash: number;
  positionValue: number;
  drawdownPct: number;
};

export type BacktestMetrics = {
  totalProfitLoss: number;
  returnPct: number;
  maxDrawdownPct: number;
  winRatePct: number;
  numberOfTrades: number;
  profitFactor: number;
  averageTradeReturnPct: number;
  sharpeRatio: number;
  endingCapital: number;
};

export type BacktestResult = {
  symbol: string;
  benchmarkSymbol?: string;
  strategy: StrategyDefinition;
  parameters: Record<string, number | string>;
  startDate: string;
  endDate: string;
  initialCapital: number;
  metrics: BacktestMetrics;
  equityCurve: EquityPoint[];
  trades: TradeRecord[];
};

export type PaperTradingSnapshot = {
  lastEvaluatedAt: string;
  equity: number;
  unrealizedProfitLoss: number;
  realizedProfitLoss: number;
  openPosition:
    | {
        entryTimestamp: string;
        entryPrice: number;
        quantity: number;
        currentPrice: number;
        marketValue: number;
        unrealizedProfitLoss: number;
      }
    | null;
};

export type PaperTradingSessionInput = {
  symbol: string;
  benchmarkSymbol?: string;
  capital: number;
  strategyId?: string;
  customStrategy?: StrategyDefinition;
  parameters?: Record<string, number | string>;
  lookbackBars?: number;
};
