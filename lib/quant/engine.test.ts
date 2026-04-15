import { describe, expect, it } from "vitest";
import { runBacktest } from "@/lib/quant/engine";
import { PREBUILT_STRATEGIES } from "@/lib/quant/strategies";
import { validateStrategyDefinition } from "@/lib/quant/validation";

const bars = Array.from({ length: 260 }, (_, index) => {
  const drift = 100 + index * 0.7 + Math.sin(index / 6) * 3;
  return {
    timestamp: new Date(Date.UTC(2024, 0, index + 1)).toISOString(),
    open: drift,
    high: drift + 1.5,
    low: drift - 1.5,
    close: drift + Math.sin(index / 4),
    volume: 1_000_000 + index * 1000,
  };
});

describe("quant engine", () => {
  it("runs a backtest with the prebuilt catalog", () => {
    const result = runBacktest(
      {
        symbol: "AAPL",
        strategyId: "golden-cross",
        startDate: bars[0].timestamp,
        endDate: bars.at(-1)?.timestamp ?? bars[0].timestamp,
        capital: 100_000,
      },
      { symbol: "AAPL", bars },
    );

    expect(result.strategy.id).toBe("golden-cross");
    expect(result.equityCurve.length).toBeGreaterThan(10);
    expect(result.metrics.endingCapital).toBeGreaterThan(0);
  });

  it("validates all prebuilt strategies", () => {
    expect(() => PREBUILT_STRATEGIES.forEach(validateStrategyDefinition)).not.toThrow();
    expect(PREBUILT_STRATEGIES.length).toBeGreaterThanOrEqual(30);
  });
});
