import { NextResponse } from "next/server";
import { connectToDatabase } from "@/database/mongoose";
import BacktestRunModel from "@/database/models/BacktestRun";
import StrategyExperimentModel from "@/database/models/StrategyExperiment";
import { getRequestBody, jsonError } from "@/lib/api";
import { runBacktest } from "@/lib/quant/engine";
import { getRequiredUserObjectId, QuantAuthError } from "@/lib/quant/auth";
import { fetchHistoricalMarketData } from "@/lib/quant/market-data";
import { getStrategyById } from "@/lib/quant/strategies";
import { StrategyDefinition, StrategyRunInput } from "@/lib/quant/types";
import { validateStrategyDefinition } from "@/lib/quant/validation";

type BacktestRequest = StrategyRunInput;

export const POST = async (request: Request) => {
  const body = await getRequestBody<BacktestRequest>(request);

  if (!body) return jsonError("Invalid JSON payload.");
  if (!body.symbol) return jsonError("Ticker symbol is required.");
  if (!body.startDate || !body.endDate) return jsonError("Start and end dates are required.");
  if (!body.capital || body.capital <= 0) return jsonError("Capital must be greater than zero.");

  try {
    const userId = await getRequiredUserObjectId();
    const strategy =
      body.customStrategy !== undefined
        ? validateStrategyDefinition(body.customStrategy as StrategyDefinition)
        : getStrategyById(body.strategyId ?? "");

    if (!strategy) {
      return jsonError("Select a valid strategy.");
    }

    const benchmarkSymbol = body.benchmarkSymbol ?? strategy.benchmarkSymbol ?? undefined;
    const [primarySeries, benchmarkSeries] = await Promise.all([
      fetchHistoricalMarketData(body.symbol, body.startDate, body.endDate),
      benchmarkSymbol
        ? fetchHistoricalMarketData(benchmarkSymbol, body.startDate, body.endDate)
        : Promise.resolve(null),
    ]);

    const result = runBacktest(
      {
        ...body,
        strategyId: strategy.id,
        customStrategy: strategy,
        benchmarkSymbol,
      },
      primarySeries,
      benchmarkSeries,
    );

    await connectToDatabase();

    await StrategyExperimentModel.updateOne(
      { userId, strategyId: strategy.id },
      {
        $setOnInsert: {
          userId,
          origin: body.customStrategy ? "ai-generated" : "prebuilt",
          strategyId: strategy.id,
          name: strategy.name,
          category: strategy.category,
          prompt: null,
          benchmarkSymbol: strategy.benchmarkSymbol ?? null,
          strategyDefinition: strategy,
          symbolUniverse: [body.symbol.toUpperCase()],
        },
      },
      { upsert: true },
    );

    const persisted = await BacktestRunModel.create({
      userId,
      symbol: result.symbol,
      benchmarkSymbol: result.benchmarkSymbol ?? null,
      strategyId: result.strategy.id,
      strategyName: result.strategy.name,
      strategyDefinition: result.strategy,
      parameters: result.parameters,
      startDate: result.startDate,
      endDate: result.endDate,
      initialCapital: result.initialCapital,
      metrics: result.metrics,
      equityCurve: result.equityCurve,
      trades: result.trades,
    });

    return NextResponse.json({
      runId: persisted._id.toString(),
      result,
    });
  } catch (error) {
    if (error instanceof QuantAuthError) {
      return jsonError(error.message, 401);
    }

    return jsonError(error instanceof Error ? error.message : "Backtest failed.", 500);
  }
};
