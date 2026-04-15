export type QuantHistoryStrategyRecord = {
  _id: string;
  name: string;
  llmName?: string | null;
  category: string;
  strategyId: string;
  updatedAt: string;
  createdAt: string;
  prompt?: string | null;
  symbolUniverse?: string[];
  benchmarkSymbol?: string | null;
};

export type QuantHistoryBacktestRecord = {
  _id: string;
  symbol: string;
  benchmarkSymbol?: string | null;
  strategyId: string;
  strategyName: string;
  parameters?: Record<string, number | string>;
  startDate: string;
  endDate: string;
  initialCapital: number;
  metrics: {
    totalProfitLoss: number;
    returnPct: number;
    maxDrawdownPct: number;
    numberOfTrades: number;
    winRatePct?: number;
    profitFactor?: number;
    sharpeRatio?: number;
    endingCapital?: number;
  };
  createdAt: string;
};

export type QuantHistoryPaperSessionRecord = {
  _id: string;
  sessionId: string;
  symbol: string;
  benchmarkSymbol?: string | null;
  strategyId: string;
  strategyName: string;
  status: string;
  parameters?: Record<string, number | string>;
  initialCapital: number;
  tradeCount: number;
  snapshot?: {
    equity: number;
    realizedProfitLoss: number;
    unrealizedProfitLoss?: number;
    lastEvaluatedAt: string;
  } | null;
  updatedAt: string;
  createdAt: string;
};

export type QuantHistoryCounts = {
  strategies: number;
  customStrategies: number;
  backtests: number;
  paperSessions: number;
};

export type QuantHistoryPayload = {
  counts: QuantHistoryCounts;
  strategies: QuantHistoryStrategyRecord[];
  backtests: QuantHistoryBacktestRecord[];
  paperSessions: QuantHistoryPaperSessionRecord[];
};
