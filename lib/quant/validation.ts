import {
  IndicatorName,
  Operand,
  RuleNode,
  StrategyDefinition,
} from "@/lib/quant/types";

const ALLOWED_INDICATORS = new Set<IndicatorName>([
  "sma",
  "ema",
  "rsi",
  "macd",
  "macdSignal",
  "macdHistogram",
  "stochasticK",
  "stochasticD",
  "bollingerUpper",
  "bollingerLower",
  "bollingerMiddle",
  "atr",
  "roc",
  "zscore",
  "donchianUpper",
  "donchianLower",
  "donchianMiddle",
  "obv",
  "volumeSma",
  "vwap",
  "volatility",
  "adx",
  "plusDi",
  "minusDi",
  "relativeStrength",
]);

const ALLOWED_CATEGORIES = new Set([
  "Trend Following",
  "Momentum",
  "Mean Reversion",
  "Breakout",
  "Volume",
  "Volatility",
  "Statistical Arbitrage",
  "Hybrid",
]);

const ensureOperand = (operand: Operand) => {
  if (operand.kind === "indicator" && !ALLOWED_INDICATORS.has(operand.name)) {
    throw new Error(`Indicator "${operand.name}" is not allowed.`);
  }

  if (operand.kind === "constant") {
    const value = operand.value;
    if (typeof value !== "number" && typeof value !== "string") {
      throw new Error("Constants must be numbers or parameter placeholders.");
    }
  }
};

const ensureRule = (rule: RuleNode) => {
  if (rule.type === "all" || rule.type === "any") {
    if (!Array.isArray(rule.rules) || rule.rules.length === 0) {
      throw new Error("Rule groups must contain at least one child rule.");
    }
    rule.rules.forEach(ensureRule);
    return;
  }

  if (!("comparator" in rule)) {
    throw new Error("Invalid terminal rule.");
  }

  const condition = rule;
  ensureOperand(condition.left);
  ensureOperand(condition.right);
};

const ensureParameterKeys = (strategy: StrategyDefinition) => {
  const keys = new Set(strategy.parameters.map((parameter) => parameter.key));
  const inspectOperand = (operand: Operand) => {
    if (operand.kind === "constant" && typeof operand.value === "string" && operand.value.startsWith("$")) {
      if (!keys.has(operand.value.slice(1))) {
        throw new Error(`Unknown parameter reference "${operand.value}".`);
      }
    }

    if (operand.kind === "indicator") {
      Object.values(operand.params ?? {}).forEach((value) => {
        if (typeof value === "string" && value.startsWith("$") && !keys.has(value.slice(1))) {
          throw new Error(`Unknown parameter reference "${value}".`);
        }
      });
    }
  };

  const inspectRule = (rule: RuleNode): void => {
    if (rule.type === "all" || rule.type === "any") {
      rule.rules.forEach(inspectRule);
      return;
    }

    if (!("comparator" in rule)) {
      throw new Error("Invalid terminal rule.");
    }

    const condition = rule;
    inspectOperand(condition.left);
    inspectOperand(condition.right);
  };

  inspectRule(strategy.entry);
  inspectRule(strategy.exit);
};

const ensureRisk = (strategy: StrategyDefinition) => {
  const boundedRiskFields = ["stopLossPct", "takeProfitPct", "trailingStopPct"] as const;

  boundedRiskFields.forEach((field) => {
    const value = strategy.risk[field];

    if (value !== undefined && (!Number.isFinite(value) || value <= 0 || value >= 1)) {
      throw new Error(`${field} must be a decimal number between 0 and 1.`);
    }
  });

  if (
    strategy.risk.maxBarsInTrade !== undefined &&
    (!Number.isInteger(strategy.risk.maxBarsInTrade) || strategy.risk.maxBarsInTrade <= 0)
  ) {
    throw new Error("maxBarsInTrade must be a positive integer.");
  }
};

export const validateStrategyDefinition = (strategy: StrategyDefinition) => {
  if (!strategy.id || !/^[a-z0-9-]+$/.test(strategy.id)) {
    throw new Error("Strategy id must be slug-like.");
  }

  if (!strategy.name || strategy.name.length < 3) {
    throw new Error("Strategy name is required.");
  }

  if (!ALLOWED_CATEGORIES.has(strategy.category)) {
    throw new Error("Strategy category is invalid.");
  }

  if (!strategy.description || strategy.description.length < 12) {
    throw new Error("Strategy description should explain the logic.");
  }

  ensureRule(strategy.entry);
  ensureRule(strategy.exit);
  ensureParameterKeys(strategy);
  ensureRisk(strategy);

  return strategy;
};
