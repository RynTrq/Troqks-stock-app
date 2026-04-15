import { describe, expect, it } from "vitest";
import { validateBacktestRequest, validatePaperSessionRequest } from "@/lib/quant/request-validation";

describe("quant request validation", () => {
  it("normalizes valid backtest requests", () => {
    expect(
      validateBacktestRequest({
        symbol: " aapl ",
        benchmarkSymbol: " spy ",
        startDate: "2024-01-01",
        endDate: "2024-12-31",
        capital: 100_000.129,
      }),
    ).toEqual({
      symbol: "AAPL",
      benchmarkSymbol: "SPY",
      startDate: "2024-01-01",
      endDate: "2024-12-31",
      capital: 100_000.13,
    });
  });

  it("rejects inverted and future backtest windows", () => {
    expect(() =>
      validateBacktestRequest({
        symbol: "AAPL",
        startDate: "2024-12-31",
        endDate: "2024-01-01",
        capital: 10_000,
      }),
    ).toThrow("Start date must be before end date.");

    expect(() =>
      validateBacktestRequest({
        symbol: "AAPL",
        startDate: "2026-01-01",
        endDate: "2999-01-01",
        capital: 10_000,
      }),
    ).toThrow("End date cannot be in the future.");
  });

  it("rejects weak paper trading inputs", () => {
    expect(() =>
      validatePaperSessionRequest({
        symbol: "bad symbol!",
        capital: 10_000,
      }),
    ).toThrow("Ticker symbol must be a valid market symbol.");

    expect(() =>
      validatePaperSessionRequest({
        symbol: "MSFT",
        capital: 10,
      }),
    ).toThrow("Capital must be at least 100.");

    expect(() =>
      validatePaperSessionRequest({
        symbol: "MSFT",
        capital: 10_000,
        lookbackBars: 12,
      }),
    ).toThrow("Paper trading lookback must be between 60 and 1500 daily bars.");
  });
});
