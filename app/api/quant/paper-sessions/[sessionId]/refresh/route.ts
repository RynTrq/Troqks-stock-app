import { NextResponse } from "next/server";
import { connectToDatabase } from "@/database/mongoose";
import PaperTradingSessionModel from "@/database/models/PaperTradingSession";
import { jsonError } from "@/lib/api";
import { buildPaperTradingSnapshot } from "@/lib/quant/engine";
import { getRequiredUserObjectId, QuantAuthError } from "@/lib/quant/auth";
import { fetchHistoricalMarketData } from "@/lib/quant/market-data";
import mongoose from "mongoose";

type RouteContext = {
  params: Promise<{ sessionId: string }>;
};

export const POST = async (_request: Request, context: RouteContext) => {
  const { sessionId } = await context.params;

  if (!mongoose.Types.ObjectId.isValid(sessionId)) {
    return jsonError("Paper trading session not found.", 404);
  }

  let session;

  try {
    await connectToDatabase();
    const userId = await getRequiredUserObjectId();
    session = await PaperTradingSessionModel.findOne({ _id: sessionId, userId });
  } catch (error) {
    if (error instanceof QuantAuthError) {
      return jsonError(error.message, 401);
    }

    throw error;
  }

  if (!session) {
    return jsonError("Paper trading session not found.", 404);
  }

  if (session.status !== "active") {
    return jsonError(`Paper trading session is ${session.status}. Resume it before refreshing.`, 409);
  }

  try {
    const [primarySeries, benchmarkSeries] = await Promise.all([
      fetchHistoricalMarketData(session.symbol),
      session.benchmarkSymbol ? fetchHistoricalMarketData(session.benchmarkSymbol) : Promise.resolve(null),
    ]);

    const { result, snapshot } = buildPaperTradingSnapshot(
      {
        symbol: session.symbol,
        benchmarkSymbol: session.benchmarkSymbol ?? undefined,
        capital: session.initialCapital,
        customStrategy: session.strategyDefinition,
        parameters: session.parameters,
        lookbackBars: session.lookbackBars,
      },
      primarySeries,
      benchmarkSeries,
    );

    session.snapshot = snapshot;
    session.tradeLog = result.trades;
    session.equityCurve = result.equityCurve;
    session.status = "active";
    await session.save();

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
    return jsonError(error instanceof Error ? error.message : "Unable to refresh paper session.", 500);
  }
};
