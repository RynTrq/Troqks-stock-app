import { NextResponse } from "next/server";
import { connectToDatabase } from "@/database/mongoose";
import PaperTradingSessionModel from "@/database/models/PaperTradingSession";
import { getRequestBody, jsonError } from "@/lib/api";
import { getRequiredUserObjectId, QuantAuthError } from "@/lib/quant/auth";
import mongoose from "mongoose";

type RouteContext = {
  params: Promise<{ sessionId: string }>;
};

type UpdatePaperSessionRequest = {
  status: "active" | "paused" | "closed";
};

export const PATCH = async (request: Request, context: RouteContext) => {
  const { sessionId } = await context.params;
  const body = await getRequestBody<UpdatePaperSessionRequest>(request);

  if (!body?.status) {
    return jsonError("Session status is required.");
  }

  if (!["active", "paused", "closed"].includes(body.status)) {
    return jsonError("Session status is invalid.");
  }

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

  session.status = body.status;
  await session.save();

  return NextResponse.json({
    sessionId: session._id.toString(),
    status: session.status,
    snapshot: session.snapshot,
    trades: session.tradeLog,
    equityCurve: session.equityCurve,
  });
};
