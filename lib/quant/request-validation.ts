import { isValidTickerSymbol, normalizeSymbol } from "@/lib/validation";

const MIN_CAPITAL = 100;
const MAX_CAPITAL = 100_000_000;
const MAX_BACKTEST_YEARS = 15;

export type ValidatedBacktestRequest = {
  symbol: string;
  benchmarkSymbol?: string;
  startDate: string;
  endDate: string;
  capital: number;
};

export type ValidatedPaperSessionRequest = {
  symbol: string;
  benchmarkSymbol?: string;
  capital: number;
  lookbackBars?: number;
};

const parseDate = (value: string, label: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`${label} must use YYYY-MM-DD format.`);
  }

  const parsed = new Date(`${value}T00:00:00.000Z`);

  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`${label} is not a valid date.`);
  }

  return parsed;
};

const assertSymbol = (symbol: string | undefined, label: string) => {
  const normalized = normalizeSymbol(symbol ?? "");

  if (!normalized) {
    throw new Error(`${label} is required.`);
  }

  if (!isValidTickerSymbol(normalized)) {
    throw new Error(`${label} must be a valid market symbol.`);
  }

  return normalized;
};

const optionalSymbol = (symbol: string | undefined, label: string) => {
  const normalized = normalizeSymbol(symbol ?? "");

  if (!normalized) return undefined;

  if (!isValidTickerSymbol(normalized)) {
    throw new Error(`${label} must be a valid market symbol.`);
  }

  return normalized;
};

const assertCapital = (capital: number | undefined) => {
  if (!Number.isFinite(capital) || capital === undefined) {
    throw new Error("Capital must be a valid number.");
  }

  if (capital < MIN_CAPITAL) {
    throw new Error(`Capital must be at least ${MIN_CAPITAL}.`);
  }

  if (capital > MAX_CAPITAL) {
    throw new Error(`Capital must be ${MAX_CAPITAL} or less.`);
  }

  return Number(capital.toFixed(2));
};

export const validateBacktestRequest = (input: {
  symbol?: string;
  benchmarkSymbol?: string;
  startDate?: string;
  endDate?: string;
  capital?: number;
}): ValidatedBacktestRequest => {
  const symbol = assertSymbol(input.symbol, "Ticker symbol");
  const benchmarkSymbol = optionalSymbol(input.benchmarkSymbol, "Benchmark symbol");

  if (!input.startDate || !input.endDate) {
    throw new Error("Start and end dates are required.");
  }

  const start = parseDate(input.startDate, "Start date");
  const end = parseDate(input.endDate, "End date");
  const today = new Date();
  today.setUTCHours(23, 59, 59, 999);

  if (start > end) {
    throw new Error("Start date must be before end date.");
  }

  if (end > today) {
    throw new Error("End date cannot be in the future.");
  }

  const maxStart = new Date(end);
  maxStart.setUTCFullYear(end.getUTCFullYear() - MAX_BACKTEST_YEARS);

  if (start < maxStart) {
    throw new Error(`Backtests are limited to ${MAX_BACKTEST_YEARS} years.`);
  }

  return {
    symbol,
    benchmarkSymbol,
    startDate: input.startDate,
    endDate: input.endDate,
    capital: assertCapital(input.capital),
  };
};

export const validatePaperSessionRequest = (input: {
  symbol?: string;
  benchmarkSymbol?: string;
  capital?: number;
  lookbackBars?: number;
}): ValidatedPaperSessionRequest => {
  const lookbackBars = input.lookbackBars ?? 180;

  if (!Number.isInteger(lookbackBars) || lookbackBars < 60 || lookbackBars > 1_500) {
    throw new Error("Paper trading lookback must be between 60 and 1500 daily bars.");
  }

  return {
    symbol: assertSymbol(input.symbol, "Ticker symbol"),
    benchmarkSymbol: optionalSymbol(input.benchmarkSymbol, "Benchmark symbol"),
    capital: assertCapital(input.capital),
    lookbackBars,
  };
};
