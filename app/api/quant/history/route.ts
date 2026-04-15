import { NextResponse } from "next/server";
import { connectToDatabase } from "@/database/mongoose";
import BacktestRunModel from "@/database/models/BacktestRun";
import PaperTradingSessionModel from "@/database/models/PaperTradingSession";
import StrategyExperimentModel from "@/database/models/StrategyExperiment";
import { QuantHistoryPayload } from "@/lib/quant/history";
import { getOptionalUserObjectId } from "@/lib/quant/auth";

export const GET = async (request: Request) => {
  const { searchParams } = new URL(request.url);
  const scope = searchParams.get("scope");
  const isFullArchive = scope === "full";
  const userId = await getOptionalUserObjectId();

  if (!userId) {
    return NextResponse.json<QuantHistoryPayload>({
      counts: {
        strategies: 0,
        customStrategies: 0,
        backtests: 0,
        paperSessions: 0,
      },
      strategies: [],
      backtests: [],
      paperSessions: [],
    });
  }

  await connectToDatabase();
  const query = { userId };

  const [strategies, backtests, paperSessions, strategyCount, customStrategyCount, backtestCount, paperSessionCount] = await Promise.all([
    (isFullArchive
      ? StrategyExperimentModel.find(query).sort({ updatedAt: -1 })
      : StrategyExperimentModel.find(query).sort({ updatedAt: -1 }).limit(20)
    ).lean(),
    (isFullArchive
      ? BacktestRunModel.find(query).sort({ createdAt: -1 })
      : BacktestRunModel.find(query).sort({ createdAt: -1 }).limit(12)
    ).lean(),
    (isFullArchive
      ? PaperTradingSessionModel.find(query).sort({ updatedAt: -1 })
      : PaperTradingSessionModel.find(query).sort({ updatedAt: -1 }).limit(12)
    ).lean(),
    StrategyExperimentModel.countDocuments(query),
    StrategyExperimentModel.countDocuments({ ...query, prompt: { $ne: null } }),
    BacktestRunModel.countDocuments(query),
    PaperTradingSessionModel.countDocuments(query),
  ]);

  return NextResponse.json<QuantHistoryPayload>({
    counts: {
      strategies: strategyCount,
      customStrategies: customStrategyCount,
      backtests: backtestCount,
      paperSessions: paperSessionCount,
    },
    strategies: strategies.map((strategy) => ({
      _id: strategy._id.toString(),
      name: strategy.name,
      llmName: strategy.llmName ?? null,
      category: strategy.category,
      strategyId: strategy.strategyId,
      updatedAt: strategy.updatedAt.toISOString(),
      createdAt: strategy.createdAt.toISOString(),
      prompt: strategy.prompt ?? null,
      symbolUniverse: strategy.symbolUniverse ?? [],
      benchmarkSymbol: strategy.benchmarkSymbol ?? null,
    })),
    backtests: backtests.map((backtest) => ({
      _id: backtest._id.toString(),
      symbol: backtest.symbol,
      benchmarkSymbol: backtest.benchmarkSymbol ?? null,
      strategyId: backtest.strategyId,
      strategyName: backtest.strategyName,
      parameters: backtest.parameters ?? {},
      startDate: backtest.startDate,
      endDate: backtest.endDate,
      initialCapital: backtest.initialCapital,
      metrics: backtest.metrics,
      createdAt: backtest.createdAt.toISOString(),
    })),
    paperSessions: paperSessions.map((session) => ({
      _id: session._id.toString(),
      sessionId: session._id.toString(),
      symbol: session.symbol,
      benchmarkSymbol: session.benchmarkSymbol ?? null,
      strategyId: session.strategyId,
      strategyName: session.strategyName,
      status: session.status,
      parameters: session.parameters ?? {},
      initialCapital: session.initialCapital,
      tradeCount: session.tradeLog?.length ?? 0,
      snapshot: session.snapshot,
      updatedAt: session.updatedAt.toISOString(),
      createdAt: session.createdAt.toISOString(),
    })),
  });
};
