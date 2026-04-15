import { NextResponse } from "next/server";

import { connectToDatabase } from "@/database/mongoose";
import StrategyExperimentModel from "@/database/models/StrategyExperiment";
import { getOptionalUserObjectId } from "@/lib/quant/auth";
import { PREBUILT_STRATEGIES, getStrategiesByCategory } from "@/lib/quant/strategies";
import { StrategyDefinition } from "@/lib/quant/types";

const CUSTOM_GROUP_LABEL = "My Own Strategies";

type StrategyCatalogEntry = StrategyDefinition & {
  source?: "prebuilt" | "custom";
  displayName?: string;
  llmName?: string | null;
};

export const GET = async () => {
  const userId = await getOptionalUserObjectId();
  const savedExperiments = userId
    ? await (async () => {
        await connectToDatabase();
        return StrategyExperimentModel.find({ userId }).sort({ updatedAt: -1 }).lean();
      })()
    : [];

  const customStrategies: StrategyCatalogEntry[] = savedExperiments
    .filter((experiment) => experiment.prompt)
    .map((experiment) => {
      const strategy = experiment.strategyDefinition as StrategyDefinition;

      return {
        ...strategy,
        source: "custom" as const,
        displayName: experiment.name,
        llmName: experiment.llmName ?? strategy.name ?? null,
        name: experiment.name,
      };
    })
    .filter(Boolean);

  const prebuiltStrategies: StrategyCatalogEntry[] = PREBUILT_STRATEGIES.filter(
    (strategy) => !customStrategies.some((custom) => custom.id === strategy.id),
  ).map((strategy) => ({
    ...strategy,
    source: "prebuilt" as const,
    displayName: strategy.name,
    llmName: null,
  }));

  const prebuiltGroups = Object.fromEntries(
    Object.entries(getStrategiesByCategory()).map(([group, strategies]) => [
      group,
      strategies.map((strategy) => ({
        ...strategy,
        source: "prebuilt" as const,
        displayName: strategy.name,
        llmName: null,
      })),
    ]),
  );

  const groupedStrategies = {
    ...(customStrategies.length > 0 ? { [CUSTOM_GROUP_LABEL]: customStrategies } : {}),
    ...prebuiltGroups,
  };

  return NextResponse.json({
    count: customStrategies.length + prebuiltStrategies.length,
    strategies: [...customStrategies, ...prebuiltStrategies],
    groupedStrategies,
  });
};
