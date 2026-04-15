import { NextResponse } from "next/server";
import { connectToDatabase } from "@/database/mongoose";
import StrategyExperimentModel from "@/database/models/StrategyExperiment";
import { getRequestBody, jsonError } from "@/lib/api";
import { AiStrategyError, generateAiStrategy } from "@/lib/quant/ai";
import { getRequiredUserObjectId, QuantAuthError } from "@/lib/quant/auth";
import { StrategyDefinition } from "@/lib/quant/types";
import { validateStrategyDefinition } from "@/lib/quant/validation";

type StrategyGeneratorRequest = {
  prompt: string;
  symbolUniverse?: string[];
  strategyName?: string;
  baseStrategy?: StrategyDefinition;
};

const toStrategyId = (name: string) =>
  name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64) || "custom-strategy";

export const POST = async (request: Request) => {
  const body = await getRequestBody<StrategyGeneratorRequest>(request);

  if (!body?.prompt?.trim()) {
    return jsonError("Describe the strategy you want to generate.");
  }

  if (!body?.strategyName?.trim() && !body.baseStrategy) {
    return jsonError("Give your strategy a name before saving it.");
  }

  try {
    const userId = await getRequiredUserObjectId();
    const baseStrategy = body.baseStrategy ? validateStrategyDefinition(body.baseStrategy) : null;
    const generated = await generateAiStrategy(
      body.prompt.trim(),
      baseStrategy ? { baseStrategy } : undefined,
    );
    const namedStrategy = validateStrategyDefinition({
      ...generated.strategy,
      id: baseStrategy?.id ?? toStrategyId(body.strategyName ?? generated.strategy.name),
      name: body.strategyName?.trim() ?? baseStrategy?.name ?? generated.strategy.name,
    });
    await connectToDatabase();

    const experiment = await StrategyExperimentModel.findOneAndUpdate(
      { userId, strategyId: namedStrategy.id },
      {
        $set: {
          userId,
          origin: "ai-generated",
          strategyId: namedStrategy.id,
          name: namedStrategy.name,
          llmName: generated.strategy.name,
          category: namedStrategy.category,
          prompt: body.prompt.trim(),
          benchmarkSymbol: namedStrategy.benchmarkSymbol ?? null,
          strategyDefinition: namedStrategy,
          symbolUniverse: body.symbolUniverse?.map((symbol) => symbol.toUpperCase()) ?? [],
        },
      },
      { upsert: true, new: true },
    );

    return NextResponse.json({
      strategyId: experiment._id.toString(),
      strategy: namedStrategy,
      explanation: generated.explanation,
    });
  } catch (error) {
    if (error instanceof QuantAuthError) {
      return jsonError(error.message, 401);
    }

    if (error instanceof AiStrategyError) {
      return jsonError(error.message, error.status);
    }

    return jsonError(error instanceof Error ? error.message : "Unable to generate strategy.", 500);
  }
};
