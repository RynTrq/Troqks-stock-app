import { NextResponse } from "next/server";
import { connectToDatabase } from "@/database/mongoose";
import PaperTradingSessionModel, { type PaperTradingSessionDocument } from "@/database/models/PaperTradingSession";
import StrategyExperimentModel from "@/database/models/StrategyExperiment";
import { getRequestBody, jsonError } from "@/lib/api";
import { buildPaperTradingSnapshot } from "@/lib/quant/engine";
import { getOptionalUserObjectId, getRequiredUserObjectId, QuantAuthError } from "@/lib/quant/auth";
import { fetchHistoricalMarketData } from "@/lib/quant/market-data";
import { ValidatedPaperSessionRequest, validatePaperSessionRequest } from "@/lib/quant/request-validation";
import { getStrategyById } from "@/lib/quant/strategies";
import { PaperTradingSessionInput, StrategyDefinition } from "@/lib/quant/types";
import { validateStrategyDefinition } from "@/lib/quant/validation";

type CreatePaperSessionRequest = PaperTradingSessionInput;

const serializePaperSession = (session: PaperTradingSessionDocument) => {
  if (!session) return null;

  return {
    sessionId: session._id.toString(),
    symbol: session.symbol,
    benchmarkSymbol: session.benchmarkSymbol,
    strategyId: session.strategyId,
    strategyName: session.strategyName,
    status: session.status,
    snapshot: session.snapshot,
    trades: session.tradeLog,
    tradeCount: session.tradeLog?.length ?? 0,
    equityCurve: session.equityCurve,
    initialCapital: session.initialCapital,
    parameters: session.parameters,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
  };
};

export const GET = async (request: Request) => {
  const { searchParams } = new URL(request.url);
  const scope = searchParams.get("scope");
  const userId = await getOptionalUserObjectId();

  if (!userId) {
    return NextResponse.json({ sessions: [] });
  }

  await connectToDatabase();
  const query = scope === "workspace" ? { userId, status: { $in: ["active", "paused"] } } : { userId };
  const sessionsQuery = PaperTradingSessionModel.find(query).sort({ status: 1, updatedAt: -1 });
  const sessions = await (scope === "workspace" ? sessionsQuery : sessionsQuery.limit(12));

  return NextResponse.json({
    sessions: sessions.map(serializePaperSession).filter(Boolean),
  });
};

export const POST = async (request: Request) => {
  const body = await getRequestBody<CreatePaperSessionRequest>(request);

  if (!body) return jsonError("Invalid JSON payload.");
  let validatedSession: ValidatedPaperSessionRequest;

  try {
    validatedSession = validatePaperSessionRequest(body);
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Paper trading request is invalid.");
  }

  try {
    const userId = await getRequiredUserObjectId();
    const strategy =
      body.customStrategy !== undefined
        ? validateStrategyDefinition(body.customStrategy as StrategyDefinition)
        : getStrategyById(body.strategyId ?? "");

    if (!strategy) {
      return jsonError("Select a valid strategy.");
    }

    const benchmarkSymbol = validatedSession.benchmarkSymbol ?? strategy.benchmarkSymbol ?? undefined;
    const [primarySeries, benchmarkSeries] = await Promise.all([
      fetchHistoricalMarketData(validatedSession.symbol),
      benchmarkSymbol ? fetchHistoricalMarketData(benchmarkSymbol) : Promise.resolve(null),
    ]);

    const { result, snapshot } = buildPaperTradingSnapshot(
      {
        ...body,
        ...validatedSession,
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
          symbolUniverse: [validatedSession.symbol],
        },
      },
      { upsert: true },
    );

    const session = await PaperTradingSessionModel.create({
      userId,
      symbol: validatedSession.symbol,
      benchmarkSymbol: benchmarkSymbol ?? null,
      strategyId: strategy.id,
      strategyName: strategy.name,
      strategyDefinition: strategy,
      parameters: result.parameters,
      initialCapital: validatedSession.capital,
      status: "active",
      lookbackBars: validatedSession.lookbackBars,
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
      tradeCount: result.trades.length,
      equityCurve: result.equityCurve,
      initialCapital: session.initialCapital,
      parameters: session.parameters,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
    });
  } catch (error) {
    if (error instanceof QuantAuthError) {
      return jsonError(error.message, 401);
    }

    return jsonError(error instanceof Error ? error.message : "Unable to create paper session.", 500);
  }
};
