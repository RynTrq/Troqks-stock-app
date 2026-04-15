import "server-only";

import { RuleNode, StrategyDefinition } from "@/lib/quant/types";
import { validateStrategyDefinition } from "@/lib/quant/validation";

const DEFAULT_MODEL = process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile";

class AiStrategyError extends Error {
  status: number;

  constructor(message: string, status = 500) {
    super(message);
    this.name = "AiStrategyError";
    this.status = status;
  }
}

const cleanJson = (payload: string) =>
  payload
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "");

const extractJsonObject = (payload: string) => {
  const cleaned = cleanJson(payload);
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");

  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    return cleaned;
  }

  return cleaned.slice(firstBrace, lastBrace + 1);
};

const COMPARATORS = new Set([
  "gt",
  "gte",
  "lt",
  "lte",
  "eq",
  "crossesAbove",
  "crossesBelow",
]);

const GROUP_TYPES = new Set(["all", "any"]);

const normalizeOperand = (operand: unknown): unknown => {
  if (!operand || typeof operand !== "object") return operand;

  const value = operand as Record<string, unknown>;

  if (value.kind === "price") {
    return {
      kind: "price",
      field: value.field ?? value.name ?? "close",
      source: value.source,
      offset: value.offset,
    };
  }

  if (value.kind === "indicator") {
    if (value.name === "volume") {
      return {
        kind: "price",
        field: "volume",
        source: value.source,
        offset: value.offset,
      };
    }

    const rawParams = value.params ?? value.parameters;
    const params =
      rawParams && typeof rawParams === "object"
        ? { ...(rawParams as Record<string, unknown>) }
        : {};

    if (value.period !== undefined && params.period === undefined) {
      params.period = value.period;
    }

    if (value.fastPeriod !== undefined && params.fastPeriod === undefined) {
      params.fastPeriod = value.fastPeriod;
    }

    if (value.slowPeriod !== undefined && params.slowPeriod === undefined) {
      params.slowPeriod = value.slowPeriod;
    }

    if (value.signalPeriod !== undefined && params.signalPeriod === undefined) {
      params.signalPeriod = value.signalPeriod;
    }

    if (value.stdDev !== undefined && params.stdDev === undefined) {
      params.stdDev = value.stdDev;
    }

    return {
      kind: "indicator",
      name: value.name,
      params,
      source: value.source,
      offset: value.offset,
    };
  }

  if (value.kind === "constant") {
    return {
      kind: "constant",
      value: value.value,
    };
  }

  return operand;
};

const normalizeRule = (rule: unknown): unknown => {
  if (!rule || typeof rule !== "object") return rule;

  const value = rule as Record<string, unknown>;

  if (GROUP_TYPES.has(String(value.type))) {
    return {
      type: value.type,
      rules: Array.isArray(value.rules) ? value.rules.map(normalizeRule) : [],
    };
  }

  if (value.type === "condition" && value.comparator) {
    return {
      type: "condition",
      comparator: value.comparator,
      left: normalizeOperand(value.left),
      right: normalizeOperand(value.right),
    };
  }

  if (value.comparator && value.left && value.right) {
    return {
      type: "condition",
      comparator: value.comparator,
      left: normalizeOperand(value.left),
      right: normalizeOperand(value.right),
    };
  }

  if (COMPARATORS.has(String(value.type))) {
    return {
      type: "condition",
      comparator: value.type,
      left: normalizeOperand(value.left),
      right: normalizeOperand(value.right),
    };
  }

  return rule;
};

const normalizeGeneratedStrategy = (strategy: StrategyDefinition): StrategyDefinition => {
  const toNumberOrUndefined = (
    value: unknown,
    fallback?: number,
  ) => {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim() && !value.trim().startsWith("$")) {
      const numericValue = Number(value);
      return Number.isFinite(numericValue) ? numericValue : undefined;
    }

    return typeof value === "string" && value.trim().startsWith("$") ? fallback : undefined;
  };

  const normalized = {
    ...strategy,
    entry: normalizeRule(strategy.entry),
    exit: normalizeRule(strategy.exit),
    risk: {
      stopLossPct: toNumberOrUndefined(strategy.risk?.stopLossPct, 0.05),
      takeProfitPct: toNumberOrUndefined(strategy.risk?.takeProfitPct, 0.12),
      trailingStopPct: toNumberOrUndefined(strategy.risk?.trailingStopPct, 0.08),
      maxBarsInTrade: toNumberOrUndefined(strategy.risk?.maxBarsInTrade, 40),
    },
  } as StrategyDefinition;

  normalized.parameters = normalized.parameters.map((parameter) => ({
    ...parameter,
    type: parameter.type ?? "number",
  }));

  return normalized;
};

const price = (field: "open" | "high" | "low" | "close" | "volume") => ({
  kind: "price" as const,
  field,
});

const indicator = (name: "ema" | "sma" | "rsi", params: Record<string, number>) => ({
  kind: "indicator" as const,
  name,
  params,
});

const constant = (value: number) => ({
  kind: "constant" as const,
  value,
});

const compare = (
  left: ReturnType<typeof price> | ReturnType<typeof indicator>,
  comparator: "gt" | "gte" | "lt" | "lte" | "eq" | "crossesAbove" | "crossesBelow",
  right: ReturnType<typeof indicator> | ReturnType<typeof constant>,
): RuleNode => ({
  type: "condition",
  left,
  comparator,
  right,
});

const appendRule = (rule: RuleNode, addition: RuleNode): RuleNode => {
  if (rule.type === "all") {
    return {
      ...rule,
      rules: [...rule.rules, addition],
    };
  }

  return {
    type: "all",
    rules: [rule, addition],
  };
};

const buildLocalEditedStrategy = (prompt: string, baseStrategy: StrategyDefinition): ParsedStrategyPayload => {
  const normalizedPrompt = prompt.toLowerCase();
  const strategy = JSON.parse(JSON.stringify(baseStrategy)) as StrategyDefinition;
  const entryLogic: string[] = [];
  const exitLogic: string[] = [];
  const riskLogic: string[] = [];

  if (normalizedPrompt.includes("200") && normalizedPrompt.includes("trend")) {
    const averageType = normalizedPrompt.includes("ema") ? "ema" : "sma";
    strategy.entry = appendRule(strategy.entry, compare(price("close"), "gt", indicator(averageType, { period: 200 })));
    entryLogic.push(`Requires price to be above the 200 ${averageType.toUpperCase()} before opening a trade.`);
  }

  if (normalizedPrompt.includes("rsi")) {
    strategy.entry = appendRule(strategy.entry, compare(indicator("rsi", { period: 14 }), "gt", constant(50)));
    entryLogic.push("Adds RSI confirmation so entries only happen when momentum is positive.");
  }

  if (normalizedPrompt.includes("trailing stop") || normalizedPrompt.includes("trailing-stop")) {
    strategy.risk = {
      ...strategy.risk,
      trailingStopPct: normalizedPrompt.includes("tight") ? 0.06 : strategy.risk.trailingStopPct ?? 0.08,
    };
    riskLogic.push(
      normalizedPrompt.includes("tight")
        ? "Uses a tighter 6% trailing stop to protect gains."
        : "Uses a trailing stop so profitable trends can keep running.",
    );
  }

  if (normalizedPrompt.includes("instead of fixed") || normalizedPrompt.includes("avoid fixed")) {
    strategy.risk = {
      ...strategy.risk,
      takeProfitPct: undefined,
    };
    exitLogic.push("Removes the fixed take-profit target in favor of the strategy exit and trailing stop.");
  }

  strategy.description = `${baseStrategy.description} Personalized with requested AI-edit rules.`;

  return {
    strategy: validateStrategyDefinition(strategy),
    explanation: {
      summary: "The AI provider was unavailable, so Troqks applied a deterministic edit to the selected strategy.",
      entryLogic: entryLogic.length > 0 ? entryLogic : ["Keeps the selected strategy entry logic."],
      exitLogic: exitLogic.length > 0 ? exitLogic : ["Keeps the selected strategy exit logic."],
      riskLogic: riskLogic.length > 0 ? riskLogic : ["Keeps the selected strategy risk rules."],
    },
  };
};

type GroqResponse = {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
};

type GroqErrorResponse = {
  error?: {
    code?: number;
    message?: string;
    status?: string;
    details?: Array<{
      "@type"?: string;
      retryDelay?: string;
    }>;
  };
};

type ParsedStrategyPayload = {
  strategy: StrategyDefinition;
  explanation?: {
    summary?: string;
    entryLogic?: string[];
    exitLogic?: string[];
    riskLogic?: string[];
  };
};

const parseTextFromResponse = (response: GroqResponse) => {
  const text = response?.choices?.[0]?.message?.content?.trim();

  if (!text) {
    throw new Error("The AI provider returned an empty strategy definition.");
  }

  return text;
};

const sanitizeJsonCandidate = (payload: string) =>
  payload
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/,\s*([}\]])/g, "$1")
    .replace(/("[^"]*"|\d+(?:\.\d+)?|true|false|null|[}\]])\s*;\s*(?="[^"]+"\s*:)/g, "$1,")
    .replace(/("[^"]*"|\d+(?:\.\d+)?|true|false|null|[}\]])\s*;\s*([}\]])/g, "$1$2");

const parseStrategyPayload = (payload: string): ParsedStrategyPayload => {
  const extracted = extractJsonObject(payload);
  const candidates = [extracted, sanitizeJsonCandidate(extracted)];
  let lastError: unknown = null;

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate) as ParsedStrategyPayload;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Invalid JSON payload.");
};

const requestGroq = async (apiKey: string, messages: Array<{ role: "system" | "user"; content: string }>) => {
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      temperature: 0.1,
      max_completion_tokens: 3000,
      response_format: { type: "json_object" },
      messages,
    }),
  });

  if (!response.ok) {
    throw await toProviderError(response);
  }

  return parseTextFromResponse((await response.json()) as GroqResponse);
};

const toProviderError = async (response: Response) => {
  let payload: GroqErrorResponse | null = null;

  try {
    payload = (await response.json()) as GroqErrorResponse;
  } catch {
    payload = null;
  }

  const providerMessage = payload?.error?.message?.trim();
  const retryDelay = payload?.error?.details?.find((detail) => detail.retryDelay)?.retryDelay;

  if (response.status === 429) {
    const suffix = retryDelay ? ` Retry after roughly ${retryDelay}.` : "";
    return new AiStrategyError(
      providerMessage
        ? `Groq AI quota exceeded. ${providerMessage}${suffix}`
        : `Groq AI quota exceeded for ${DEFAULT_MODEL}.${suffix}`,
      429,
    );
  }

  if (response.status === 403) {
    return new AiStrategyError(
      providerMessage
        ? `Groq API access was denied. ${providerMessage}`
        : "Groq API access was denied. Check the API key and project permissions.",
      403,
    );
  }

  if (response.status === 400) {
    return new AiStrategyError(
      providerMessage
        ? `Groq rejected the strategy request. ${providerMessage}`
        : "Groq rejected the strategy request.",
      400,
    );
  }

  return new AiStrategyError(
    providerMessage
      ? `The AI strategy service failed. ${providerMessage}`
      : "The AI strategy service could not generate a strategy right now.",
    response.status || 500,
  );
};

type GenerateAiStrategyOptions = {
  baseStrategy?: StrategyDefinition;
};

const buildUserInstruction = (prompt: string, options?: GenerateAiStrategyOptions) => {
  if (!options?.baseStrategy) {
    return `Convert this natural-language trading idea into the supported JSON strategy schema: ${prompt}`;
  }

  return `
Modify the existing supported JSON strategy using the requested changes.

Existing strategy:
${JSON.stringify(options.baseStrategy)}

Requested changes:
${prompt}

Preserve the existing strategy id and name unless the requested changes explicitly ask for a rename. Keep the response executable with the same supported schema.
  `.trim();
};

export const generateAiStrategy = async (prompt: string, options?: GenerateAiStrategyOptions) => {
  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey) {
    throw new AiStrategyError("Set GROQ_API_KEY to enable AI strategy generation.", 503);
  }

  const systemInstruction = `
You are a quantitative trading strategy compiler.
Return one strict JSON object only. No markdown. No commentary.

The JSON must match:
{
  "strategy": {
    "id": "slug",
    "name": "Strategy Name",
    "category": "Trend Following|Momentum|Mean Reversion|Breakout|Volume|Volatility|Statistical Arbitrage|Hybrid",
    "description": "1-2 sentence explanation",
    "benchmarkSymbol": "optional symbol or null",
    "parameters": [
      {
        "key": "string",
        "label": "string",
        "type": "number",
        "defaultValue": 14,
        "min": 1,
        "max": 300,
        "step": 1,
        "description": "string"
      }
    ],
    "entry": {},
    "exit": {},
    "risk": {
      "stopLossPct": 0.05,
      "takeProfitPct": 0.12,
      "trailingStopPct": 0.08,
      "maxBarsInTrade": 40
    }
  },
  "explanation": {
    "summary": "short explanation",
    "entryLogic": ["bullet", "bullet"],
    "exitLogic": ["bullet", "bullet"],
    "riskLogic": ["bullet", "bullet"]
  }
}

Rules:
- Allowed indicators only: sma, ema, rsi, macd, macdSignal, macdHistogram, stochasticK, stochasticD, bollingerUpper, bollingerLower, bollingerMiddle, atr, roc, zscore, donchianUpper, donchianLower, donchianMiddle, obv, volumeSma, vwap, volatility, adx, plusDi, minusDi, relativeStrength.
- Operands must be {kind:"indicator"...}, {kind:"price"...}, or {kind:"constant"...}.
- Constants may reference parameters via "$parameterName".
- Rule groups may only be {type:"all", rules:[...]} or {type:"any", rules:[...]}.
- Conditions may only use comparators gt, gte, lt, lte, eq, crossesAbove, crossesBelow.
- Long-only strategies only.
- Do not generate code, eval, functions, or arbitrary expressions.
- Keep strategy executable with daily OHLCV data.
- If you are unsure, still return the closest valid JSON object that follows the schema.
  `.trim();

  let parsedText = "";

  try {
    parsedText = await requestGroq(apiKey, [
      {
        role: "system",
        content: systemInstruction,
      },
      {
        role: "user",
        content: buildUserInstruction(prompt, options),
      },
    ]);
    const parsed = parseStrategyPayload(parsedText);

    return {
      strategy: validateStrategyDefinition(normalizeGeneratedStrategy(parsed.strategy)),
      explanation: parsed.explanation ?? null,
    };
  } catch (error) {
    if (error instanceof AiStrategyError) throw error;

    if (!parsedText) {
      if (options?.baseStrategy) {
        return buildLocalEditedStrategy(prompt, options.baseStrategy);
      }

      throw new AiStrategyError("Groq returned an unreadable strategy payload.", 502);
    }

    try {
      const repairedText = await requestGroq(apiKey, [
        {
          role: "system",
          content:
            "Repair the supplied JSON into one strict JSON object that matches the trading strategy schema. Return JSON only. Do not change strategy meaning unless needed to make the schema valid.",
        },
        {
          role: "user",
          content: `The parser failed with: ${
            error instanceof Error ? error.message : "Unknown validation error."
          }\n\nRepair this payload:\n${extractJsonObject(parsedText)}`,
        },
      ]);
      const repaired = parseStrategyPayload(repairedText);

      return {
        strategy: validateStrategyDefinition(normalizeGeneratedStrategy(repaired.strategy)),
        explanation: repaired.explanation ?? null,
      };
    } catch (repairError) {
      if (repairError instanceof AiStrategyError) throw repairError;

      if (options?.baseStrategy) {
        return buildLocalEditedStrategy(prompt, options.baseStrategy);
      }

      throw new AiStrategyError(
        `Groq returned a strategy payload that could not be validated. ${
          repairError instanceof Error
            ? repairError.message
            : error instanceof Error
              ? error.message
              : "Unknown validation error."
        }`,
        502,
      );
    }
  }
};

export { AiStrategyError };
