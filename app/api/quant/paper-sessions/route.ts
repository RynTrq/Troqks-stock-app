import { NextResponse } from "next/server";
import { connectToDatabase } from "@/database/mongoose";
import PaperTradingSessionModel from "@/database/models/PaperTradingSession";
import StrategyExperimentModel from "@/database/models/StrategyExperiment";
import { getRequestBody, jsonError } from "@/lib/api";
import { buildPaperTradingSnapshot } from "@/lib/quant/engine";
import { getOptionalUserObjectId, getRequiredUserObjectId, QuantAuthError } from "@/lib/quant/auth";
import { fetchHistoricalMarketData } from "@/lib/quant/market-data";
import { getStrategyById } from "@/lib/quant/strategies";
import { PaperTradingSessionInput, StrategyDefinition } from "@/lib/quant/types";
import { validateStrategyDefinition } from "@/lib/quant/validation";

type CreatePaperSessionRequest = PaperTradingSessionInput;

export const GET = async () => {
  const userId = await getOptionalUserObjectId();

  if (!userId) {
    return NextResponse.json({ sessions: [] });
  }

  await connectToDatabase();
  const sessions = await PaperTradingSessionModel.find({ userId })
    .sort({ updatedAt: -1 })
    .limit(12)
    .lean();

  return NextResponse.json({
    sessions: sessions.map((session) => ({
      sessionId: session._id.toString(),
      symbol: session.symbol,
      benchmarkSymbol: session.benchmarkSymbol,
      strategyId: session.strategyId,
      strategyName: session.strategyName,
      status: session.status,
      snapshot: session.snapshot,
      trades: session.tradeLog,
      equityCurve: session.equityCurve,
      updatedAt: session.updatedAt,
    })),
  });
};

export const POST = async (request: Request) => {
  const body = await getRequestBody<CreatePaperSessionRequest>(request);

  if (!body) return jsonError("Invalid JSON payload.");
  if (!body.symbol) return jsonError("Ticker symbol is required.");
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
      fetchHistoricalMarketData(body.symbol),
      benchmarkSymbol ? fetchHistoricalMarketData(benchmarkSymbol) : Promise.resolve(null),
    ]);

    const { result, snapshot } = buildPaperTradingSnapshot(
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

    const session = await PaperTradingSessionModel.create({
      userId,
      symbol: body.symbol.toUpperCase(),
      benchmarkSymbol: benchmarkSymbol ?? null,
      strategyId: strategy.id,
      strategyName: strategy.name,
      strategyDefinition: strategy,
      parameters: result.parameters,
      initialCapital: body.capital,
      status: "active",
      lookbackBars: body.lookbackBars ?? 180,
      snapshot,
      tradeLog: result.trades,
      equityCurve: result.equityCurve,
    });

    return NextResponse.json({
      sessionId: session._id.toString(),
      symbol: session.symbol,
      benchmarkSymbol: session.benchmarkSymbol,
      strategyId: session.strategyId,
      strategyName: session.strategyName,
      status: session.status,
      snapshot,
      trades: result.trades,
      equityCurve: result.equityCurve,
    });
  } catch (error) {
    if (error instanceof QuantAuthError) {
      return jsonError(error.message, 401);
    }

    return jsonError(error instanceof Error ? error.message : "Unable to create paper session.", 500);
  }
};
