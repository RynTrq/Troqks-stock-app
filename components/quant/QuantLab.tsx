"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Activity, BrainCircuit, Gauge, Play, RefreshCw, Rocket, ShieldCheck, TestTubeDiagonal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import EquityCurveChart from "@/components/quant/EquityCurveChart";
import SymbolPicker from "@/components/quant/SymbolPicker";
import { QuantHistoryPayload } from "@/lib/quant/history";
import { StrategyDefinition } from "@/lib/quant/types";

type StrategyCatalogEntry = StrategyDefinition & {
  source?: "prebuilt" | "custom";
  displayName?: string;
  llmName?: string | null;
};

type StrategiesPayload = {
  count: number;
  strategies: StrategyCatalogEntry[];
  groupedStrategies: Record<string, StrategyCatalogEntry[]>;
};

type BacktestPayload = {
  runId: string;
  result: {
    symbol: string;
    strategy: StrategyDefinition;
    parameters: Record<string, number | string>;
    startDate: string;
    endDate: string;
    initialCapital: number;
    metrics: {
      totalProfitLoss: number;
      returnPct: number;
      maxDrawdownPct: number;
      winRatePct: number;
      numberOfTrades: number;
      profitFactor: number;
      averageTradeReturnPct: number;
      sharpeRatio: number;
      endingCapital: number;
    };
    equityCurve: Array<{ timestamp: string; equity: number; positionValue?: number }>;
    trades: Array<{
      id: string;
      entryTimestamp: string;
      exitTimestamp: string;
      entryPrice?: number;
      exitPrice?: number;
      quantity?: number;
      profitLoss: number;
      returnPct: number;
      barsHeld?: number;
      exitReason: string;
    }>;
  };
};

type GeneratedPayload = {
  strategy: StrategyDefinition;
  explanation?: {
    summary?: string;
    entryLogic?: string[];
    exitLogic?: string[];
    riskLogic?: string[];
  } | null;
};

type PaperSessionPayload = {
  sessionId: string;
  symbol?: string;
  benchmarkSymbol?: string | null;
  strategyId?: string;
  strategyName?: string;
  status?: "active" | "paused" | "closed";
  initialCapital?: number;
  parameters?: Record<string, number | string>;
  snapshot: {
    equity: number;
    realizedProfitLoss: number;
    lastEvaluatedAt: string;
  } | null;
  trades: Array<{
    id: string;
    entryTimestamp: string;
    exitTimestamp: string;
    profitLoss: number;
    returnPct: number;
    exitReason: string;
  }>;
  tradeCount?: number;
  equityCurve: Array<{ timestamp: string; equity: number }>;
  createdAt?: string;
  updatedAt?: string;
};

type AiMode = "edit" | "new";

const formatDateInput = (value: Date) => value.toISOString().slice(0, 10);
const getDefaultDateRange = () => {
  const end = new Date();
  const start = new Date(end);

  start.setFullYear(end.getFullYear() - 1);

  return {
    startDate: formatDateInput(start),
    endDate: formatDateInput(end),
  };
};

const currency = (value: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);

const pct = (value: number) => `${value.toFixed(2)}%`;
const signedPct = (value: number) => `${value >= 0 ? "+" : ""}${pct(value)}`;
const formatDateTime = (value?: string) => (value ? new Date(value).toLocaleString() : "Not available");
const paperStatusOrder: Record<NonNullable<PaperSessionPayload["status"]>, number> = {
  active: 0,
  paused: 1,
  closed: 2,
};

const getThreadLabel = (session: PaperSessionPayload) =>
  `${session.symbol ?? "Symbol"} / ${session.strategyName ?? "Strategy"}`;

const getPaperSessionEquity = (session: PaperSessionPayload) => session.snapshot?.equity ?? session.initialCapital ?? 0;
const getPaperSessionRealizedPnl = (session: PaperSessionPayload) => session.snapshot?.realizedProfitLoss ?? 0;
const getPaperSessionTradeCount = (session: PaperSessionPayload) => session.tradeCount ?? session.trades.length;
const getPaperSessionLastEvaluatedAt = (session: PaperSessionPayload) => session.snapshot?.lastEvaluatedAt ?? session.updatedAt;

const sortPaperSessions = (sessions: PaperSessionPayload[]) =>
  [...sessions].sort((left, right) => {
    const statusDelta = paperStatusOrder[left.status ?? "active"] - paperStatusOrder[right.status ?? "active"];

    if (statusDelta !== 0) return statusDelta;

    return new Date(right.updatedAt ?? right.snapshot?.lastEvaluatedAt ?? 0).getTime() -
      new Date(left.updatedAt ?? left.snapshot?.lastEvaluatedAt ?? 0).getTime();
  });

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const getYearsBetween = (startDate: string, endDate: string) => {
  const start = new Date(startDate).getTime();
  const end = new Date(endDate).getTime();

  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 1;

  return Math.max((end - start) / (1000 * 60 * 60 * 24 * 365.25), 1 / 12);
};

const getResearchBrief = (result: BacktestPayload["result"]) => {
  const { metrics, trades, equityCurve } = result;
  const years = getYearsBetween(result.startDate, result.endDate);
  const cagr = ((metrics.endingCapital / result.initialCapital) ** (1 / years) - 1) * 100;
  const calmar = metrics.maxDrawdownPct > 0 ? cagr / metrics.maxDrawdownPct : cagr;
  const exposurePct =
    equityCurve.length > 0
      ? (equityCurve.filter((point) => (point.positionValue ?? 0) > 0).length / equityCurve.length) * 100
      : 0;
  const averageHoldBars =
    trades.length > 0 ? trades.reduce((sum, trade) => sum + (trade.barsHeld ?? 0), 0) / trades.length : 0;
  const bestTrade = trades.length > 0 ? Math.max(...trades.map((trade) => trade.returnPct)) : 0;
  const worstTrade = trades.length > 0 ? Math.min(...trades.map((trade) => trade.returnPct)) : 0;
  const tradeFrequency = trades.length / years;
  const riskScore = clamp(
    Math.round(
      100 -
        metrics.maxDrawdownPct * 1.8 +
        Math.min(Math.max(metrics.sharpeRatio, -1), 3) * 12 +
        Math.min(metrics.winRatePct, 80) * 0.25 +
        Math.min(Math.max(calmar, -2), 5) * 6,
    ),
    0,
    100,
  );
  const verdict =
    riskScore >= 78
      ? "Production watchlist"
      : riskScore >= 58
        ? "Promising research candidate"
        : riskScore >= 40
          ? "Needs parameter review"
          : "High-risk experiment";
  const narrative =
    metrics.numberOfTrades === 0
      ? "The strategy stayed flat in this window. Expand the date range or loosen the entry logic before trusting the read."
      : metrics.returnPct > 0 && metrics.maxDrawdownPct < 20 && metrics.sharpeRatio > 0.7
        ? "The run shows positive returns with controlled drawdown and a usable risk-adjusted profile."
        : metrics.returnPct > 0
          ? "The run made money, but the drawdown and trade quality deserve a closer look before scaling."
          : "The run lost money in this window. Treat it as a diagnostic pass and revise the signal or risk rules.";

  return {
    cagr,
    calmar,
    exposurePct,
    averageHoldBars,
    bestTrade,
    worstTrade,
    tradeFrequency,
    riskScore,
    verdict,
    narrative,
  };
};

const readJson = async <TPayload,>(response: Response): Promise<TPayload> => {
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(
      typeof payload === "object" &&
        payload !== null &&
        "error" in payload &&
        typeof payload.error === "string"
        ? payload.error
        : "Request failed.",
    );
  }

  return payload as TPayload;
};

const QuantLab = () => {
  const [strategiesPayload, setStrategiesPayload] = useState<StrategiesPayload | null>(null);
  const [history, setHistory] = useState<QuantHistoryPayload | null>(null);
  const [selectedStrategyId, setSelectedStrategyId] = useState("golden-cross");
  const [symbol, setSymbol] = useState("AAPL");
  const [benchmarkSymbol, setBenchmarkSymbol] = useState("SPY");
  const [capital, setCapital] = useState("100000");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [parameterOverrides, setParameterOverrides] = useState<Record<string, string>>({});
  const [backtest, setBacktest] = useState<BacktestPayload | null>(null);
  const [paperSessions, setPaperSessions] = useState<PaperSessionPayload[]>([]);
  const [selectedPaperSessionId, setSelectedPaperSessionId] = useState<string | null>(null);
  const [generatedStrategy, setGeneratedStrategy] = useState<GeneratedPayload | null>(null);
  const [aiMode, setAiMode] = useState<AiMode>("edit");
  const [customStrategyName, setCustomStrategyName] = useState("Momentum Volume Breakout");
  const [aiPrompt, setAiPrompt] = useState(
    "Make entries stricter by requiring RSI confirmation and add a tighter trailing stop.",
  );
  const [status, setStatus] = useState<string | null>(null);
  const [loadingState, setLoadingState] = useState<"" | "backtest" | "ai" | "paper">("");
  const [loadingSessionId, setLoadingSessionId] = useState<string | null>(null);
  const backtestResultsRef = useRef<HTMLElement | null>(null);

  const loadHistory = async () => {
    const response = await fetch("/api/quant/history");
    const historyJson = await readJson<QuantHistoryPayload>(response);
    setHistory(historyJson);
  };

  const loadStrategies = async () => {
    const response = await fetch("/api/quant/strategies");
    const strategiesJson = await readJson<StrategiesPayload>(response);
    setStrategiesPayload(strategiesJson);
  };

  useEffect(() => {
    const load = async () => {
      const defaultDateRange = getDefaultDateRange();

      setStartDate(defaultDateRange.startDate);
      setEndDate(defaultDateRange.endDate);

      try {
        const [strategiesResponse, historyResponse, paperSessionsResponse] = await Promise.all([
          fetch("/api/quant/strategies"),
          fetch("/api/quant/history"),
          fetch("/api/quant/paper-sessions?scope=workspace"),
        ]);

        const [strategiesJson, historyJson, paperSessionsJson] = await Promise.all([
          readJson<StrategiesPayload>(strategiesResponse),
          readJson<QuantHistoryPayload>(historyResponse),
          readJson<{ sessions: PaperSessionPayload[] }>(paperSessionsResponse),
        ]);

        setStrategiesPayload(strategiesJson);
        setHistory(historyJson);
        const sortedPaperSessions = sortPaperSessions(paperSessionsJson.sessions);

        setPaperSessions(sortedPaperSessions);
        setSelectedPaperSessionId(sortedPaperSessions[0]?.sessionId ?? null);
      } catch (error) {
        setStatus(error instanceof Error ? error.message : "Unable to load quant workspace.");
      }
    };

    void load();
  }, []);

  const activeStrategy = useMemo(() => {
    if (!strategiesPayload) return generatedStrategy?.strategy ?? null;
    return (
      generatedStrategy?.strategy ??
      strategiesPayload.strategies.find((strategy) => strategy.id === selectedStrategyId) ??
      null
    );
  }, [generatedStrategy, selectedStrategyId, strategiesPayload]);

  const isCustomCatalogStrategy =
    !generatedStrategy &&
    activeStrategy !== null &&
    "source" in activeStrategy &&
    activeStrategy.source === "custom";

  const strategyParameters = useMemo(() => activeStrategy?.parameters ?? [], [activeStrategy]);

  const prebuiltStrategyCount = useMemo(
    () => strategiesPayload?.strategies.filter((strategy) => strategy.source !== "custom").length ?? 0,
    [strategiesPayload],
  );

  const summaryCards = [
    {
      label: "Prebuilt Strategies",
      value: prebuiltStrategyCount,
      icon: TestTubeDiagonal,
      href: "/quant-history?section=prebuilt#prebuilt",
    },
    {
      label: "Backtests Logged",
      value: history?.counts.backtests ?? 0,
      icon: Gauge,
      href: "/quant-history?section=backtests#backtests",
    },
    {
      label: "Paper Sessions",
      value: history?.counts.paperSessions ?? 0,
      icon: Play,
      href: "/quant-history?section=paper-sessions#paper-sessions",
    },
    {
      label: "My Strategies",
      value: history?.counts.customStrategies ?? 0,
      icon: BrainCircuit,
      href: "/quant-history?section=my-strategies#my-strategies",
    },
  ];

  const researchBrief = useMemo(() => (backtest ? getResearchBrief(backtest.result) : null), [backtest]);
  const livePaperSessions = useMemo(
    () => paperSessions.filter((session) => session.status === "active" || session.status === "paused"),
    [paperSessions],
  );
  const activePaperSessions = useMemo(
    () => livePaperSessions.filter((session) => session.status === "active"),
    [livePaperSessions],
  );
  const pausedPaperSessions = useMemo(
    () => livePaperSessions.filter((session) => session.status === "paused"),
    [livePaperSessions],
  );
  const selectedPaperSession = useMemo(
    () => livePaperSessions.find((session) => session.sessionId === selectedPaperSessionId) ?? livePaperSessions[0] ?? null,
    [livePaperSessions, selectedPaperSessionId],
  );
  const latestSavedBacktest = history?.backtests[0] ?? null;
  const latestSavedStrategy = history?.strategies.find((item) => item.prompt) ?? null;

  useEffect(() => {
    if (livePaperSessions.length === 0) {
      if (selectedPaperSessionId) setSelectedPaperSessionId(null);
      return;
    }

    if (!selectedPaperSessionId || !livePaperSessions.some((session) => session.sessionId === selectedPaperSessionId)) {
      setSelectedPaperSessionId(livePaperSessions[0].sessionId);
    }
  }, [livePaperSessions, selectedPaperSessionId]);

  const upsertPaperSession = (session: PaperSessionPayload) => {
    setPaperSessions((current) => {
      if (session.status === "closed") {
        return current.filter((item) => item.sessionId !== session.sessionId);
      }

      return sortPaperSessions([...current.filter((item) => item.sessionId !== session.sessionId), session]);
    });

    if (session.status !== "closed") {
      setSelectedPaperSessionId(session.sessionId);
    }
  };

  const resolvedParameters = useMemo(
    () =>
      Object.fromEntries(
        strategyParameters.map((parameter) => [
          parameter.key,
          Number(parameterOverrides[parameter.key] ?? parameter.defaultValue),
        ]),
      ),
    [parameterOverrides, strategyParameters],
  );

  const runBacktest = async () => {
    if (!activeStrategy) {
      setStatus("Choose a strategy before running a backtest.");
      return;
    }

    if (!startDate || !endDate) {
      setStatus("Choose a start and end date before running a backtest.");
      return;
    }

    setLoadingState("backtest");
    setStatus(null);

    const response = await fetch("/api/quant/backtests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        symbol,
        benchmarkSymbol: benchmarkSymbol.trim() || undefined,
        startDate,
        endDate,
        capital: Number(capital),
        parameters: resolvedParameters,
        customStrategy: generatedStrategy?.strategy ?? (isCustomCatalogStrategy ? activeStrategy : undefined),
        strategyId: generatedStrategy || isCustomCatalogStrategy ? undefined : activeStrategy.id,
      }),
    });

    try {
      const payload = await readJson<BacktestPayload>(response);

      setBacktest(payload);
      setStatus("Backtest completed and saved.");
      void loadHistory();
      window.requestAnimationFrame(() => {
        backtestResultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to run backtest.");
    } finally {
      setLoadingState("");
    }
  };

  const createAiStrategy = async () => {
    const baseStrategy = aiMode === "edit" ? activeStrategy : null;

    if (aiMode === "new" && !customStrategyName.trim()) {
      setStatus("Give your strategy a name before saving it.");
      return;
    }

    if (aiMode === "edit" && !baseStrategy) {
      setStatus("Select a strategy to edit, or choose New Strategy first.");
      return;
    }

    if (!aiPrompt.trim()) {
      setStatus(aiMode === "edit" ? "Tell the AI what to change." : "Describe the strategy you want to create.");
      return;
    }

    setLoadingState("ai");
    setStatus(null);

    const response = await fetch("/api/quant/strategy-generator", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        strategyName: aiMode === "new" ? customStrategyName.trim() : baseStrategy?.name,
        prompt: aiPrompt.trim(),
        symbolUniverse: [symbol],
        baseStrategy: baseStrategy ?? undefined,
      }),
    });

    try {
      const payload = await readJson<GeneratedPayload>(response);

      setGeneratedStrategy(payload);
      setSelectedStrategyId(payload.strategy.id);
      setAiMode("edit");
      setParameterOverrides({});
      try {
        await Promise.all([loadStrategies(), loadHistory()]);
        setStatus(
          aiMode === "edit"
            ? "Strategy changes saved and added to My Strategies."
            : "Strategy generated, saved, and added to My Strategies.",
        );
      } catch (refreshError) {
        setStatus(
          refreshError instanceof Error
            ? `Strategy generated, but the saved list could not refresh: ${refreshError.message}`
            : "Strategy generated, but the saved list could not refresh.",
        );
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to update strategy.");
    } finally {
      setLoadingState("");
    }
  };

  const startPaperTrading = async () => {
    if (!activeStrategy) {
      setStatus("Choose a strategy before starting paper trading.");
      return;
    }

    setLoadingState("paper");
    setStatus(null);

    const response = await fetch("/api/quant/paper-sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        symbol,
        benchmarkSymbol: benchmarkSymbol.trim() || undefined,
        capital: Number(capital),
        parameters: resolvedParameters,
        customStrategy: generatedStrategy?.strategy ?? (isCustomCatalogStrategy ? activeStrategy : undefined),
        strategyId: generatedStrategy || isCustomCatalogStrategy ? undefined : activeStrategy.id,
      }),
    });

    try {
      const session = await readJson<PaperSessionPayload>(response);

      upsertPaperSession(session);
      setStatus("Paper trading thread started.");
      void loadHistory();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to start paper trading.");
    } finally {
      setLoadingState("");
    }
  };

  const refreshPaperTrading = async (sessionId: string) => {
    const session = livePaperSessions.find((item) => item.sessionId === sessionId);

    if (!session || session.status !== "active") return;

    setLoadingSessionId(sessionId);
    const response = await fetch(`/api/quant/paper-sessions/${sessionId}/refresh`, {
      method: "POST",
    });

    try {
      upsertPaperSession(await readJson<PaperSessionPayload>(response));
      setStatus(`${getThreadLabel(session)} refreshed against the latest available market data.`);
      void loadHistory();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to refresh paper trading session.");
    } finally {
      setLoadingSessionId(null);
    }
  };

  const updatePaperTradingStatus = async (sessionId: string, nextStatus: "paused" | "closed" | "active") => {
    const session = livePaperSessions.find((item) => item.sessionId === sessionId);

    if (!session) return;

    setLoadingSessionId(sessionId);
    setStatus(null);

    const response = await fetch(`/api/quant/paper-sessions/${sessionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStatus }),
    });

    try {
      upsertPaperSession(await readJson<PaperSessionPayload>(response));
      setStatus(
        nextStatus === "closed"
          ? `${getThreadLabel(session)} stopped and moved to Quant History.`
          : nextStatus === "paused"
            ? `${getThreadLabel(session)} paused.`
            : `${getThreadLabel(session)} resumed.`,
      );
      void loadHistory();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to update paper trading session.");
    } finally {
      setLoadingSessionId(null);
    }
  };

  return (
    <div className="space-y-10 pb-14">
      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-4">
          <p className="text-sm font-semibold uppercase tracking-wide text-teal-400">Quant Lab</p>
          <h1 className="text-4xl font-bold text-gray-100">AI-powered strategy research, backtesting, and paper execution</h1>
          <p className="max-w-4xl text-base leading-7 text-gray-400">
            Build on thirty plus institutional-style templates, compile natural-language trade logic into a validated strategy AST,
            run historical simulations without look-ahead bias, and keep a persistent ledger of every experiment.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {summaryCards.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className="rounded-md border border-gray-700 bg-gray-800/70 p-4 transition-colors hover:border-teal-400/50 hover:bg-gray-800"
            >
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-500">{item.label}</p>
                <item.icon className="h-4 w-4 text-yellow-400" />
              </div>
              <p className="mt-4 text-3xl font-semibold text-gray-100">{item.value}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="rounded-md border border-gray-700 bg-gray-800/70 p-5">
        <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-teal-400">Current Work</p>
            <h2 className="mt-1 text-2xl font-semibold text-gray-100">Live workspace</h2>
            <p className="mt-1 text-sm text-gray-500">
              Active and paused paper threads appear first. When none are running, the latest real saved work is shown.
            </p>
          </div>
          <Button asChild variant="outline" className="border-gray-600 bg-transparent text-gray-100">
            <Link href="/quant-history">Open Quant History</Link>
          </Button>
        </div>

        {livePaperSessions.length > 0 ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {livePaperSessions.map((session) => {
              const isLoading = loadingSessionId === session.sessionId;

              return (
                <button
                  key={session.sessionId}
                  type="button"
                  onClick={() => setSelectedPaperSessionId(session.sessionId)}
                  className={`rounded-md border p-4 text-left transition-colors ${
                    selectedPaperSession?.sessionId === session.sessionId
                      ? "border-teal-400 bg-teal-400/10"
                      : "border-gray-700 bg-gray-900/70 hover:border-gray-600"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-gray-100">{getThreadLabel(session)}</p>
                      <p className="mt-1 text-xs text-gray-500">Updated {formatDateTime(session.updatedAt)}</p>
                    </div>
                    <span
                      className={`rounded-md px-2 py-1 text-xs font-semibold uppercase tracking-wide ${
                        session.status === "active" ? "bg-teal-400/10 text-teal-400" : "bg-yellow-500/10 text-yellow-400"
                      }`}
                    >
                      {session.status}
                    </span>
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
                    <div>
                      <p className="text-gray-500">Equity</p>
                      <p className="mt-1 font-semibold text-gray-100">{currency(getPaperSessionEquity(session))}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Realized P&L</p>
                      <p className="mt-1 font-semibold text-gray-100">{currency(getPaperSessionRealizedPnl(session))}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Trades</p>
                      <p className="mt-1 font-semibold text-gray-100">{getPaperSessionTradeCount(session)}</p>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center justify-between gap-3 text-xs text-gray-500">
                    <span>Last evaluated {formatDateTime(getPaperSessionLastEvaluatedAt(session))}</span>
                    <span className="font-semibold text-teal-400">{isLoading ? "Working..." : "View thread"}</span>
                  </div>
                </button>
              );
            })}
          </div>
        ) : backtest ? (
          <div className="rounded-md border border-yellow-500/30 bg-yellow-500/10 p-4">
            <p className="text-sm font-semibold uppercase tracking-wide text-yellow-400">Latest Backtest In This Session</p>
            <div className="mt-3 grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
              <div>
                <h3 className="text-xl font-semibold text-gray-100">
                  {backtest.result.symbol} / {backtest.result.strategy.name}
                </h3>
                <p className="mt-1 text-sm text-gray-400">
                  Ending capital {currency(backtest.result.metrics.endingCapital)} with {backtest.result.metrics.numberOfTrades} trades.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                className="border-yellow-500/40 bg-transparent text-yellow-300"
                onClick={() => backtestResultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
              >
                Review Run
              </Button>
            </div>
          </div>
        ) : latestSavedBacktest ? (
          <div className="rounded-md border border-gray-700 bg-gray-900/70 p-4">
            <p className="text-sm font-semibold uppercase tracking-wide text-yellow-400">Latest Saved Backtest</p>
            <div className="mt-3 grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
              <div>
                <h3 className="text-xl font-semibold text-gray-100">
                  {latestSavedBacktest.symbol} / {latestSavedBacktest.strategyName}
                </h3>
                <p className="mt-1 text-sm text-gray-400">
                  {pct(latestSavedBacktest.metrics.returnPct)} return, {latestSavedBacktest.metrics.numberOfTrades} trades, saved{" "}
                  {formatDateTime(latestSavedBacktest.createdAt)}.
                </p>
              </div>
              <Button asChild variant="outline" className="border-gray-600 bg-transparent text-gray-100">
                <Link href="/quant-history?section=backtests#backtests">Open Backtests</Link>
              </Button>
            </div>
          </div>
        ) : latestSavedStrategy ? (
          <div className="rounded-md border border-teal-400/20 bg-teal-400/5 p-4">
            <p className="text-sm font-semibold uppercase tracking-wide text-teal-300">Latest Saved AI Strategy</p>
            <div className="mt-3 grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
              <div>
                <h3 className="text-xl font-semibold text-gray-100">{latestSavedStrategy.name}</h3>
                <p className="mt-1 text-sm text-gray-400">
                  {latestSavedStrategy.category} strategy saved {formatDateTime(latestSavedStrategy.updatedAt)}.
                </p>
              </div>
              <Button asChild variant="outline" className="border-teal-400/40 bg-transparent text-teal-300">
                <Link href="/quant-history?section=my-strategies#my-strategies">Open Strategies</Link>
              </Button>
            </div>
          </div>
        ) : (
          <div className="rounded-md border border-dashed border-gray-700 bg-gray-900/50 p-8 text-center">
            <p className="text-lg font-semibold text-gray-100">No current work yet</p>
            <p className="mt-2 text-sm text-gray-500">Run a backtest, save an AI strategy, or start a paper thread to begin.</p>
          </div>
        )}
      </section>

      <section className="grid gap-8 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="space-y-6">
          <div className="rounded-md border border-gray-700 bg-gray-800/70 p-5">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-gray-100">Research Inputs</h2>
                <p className="text-sm text-gray-500">Select the instrument, horizon, and execution capital.</p>
              </div>
              <Rocket className="h-5 w-5 text-teal-400" />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <SymbolPicker label="Ticker" value={symbol} onChange={setSymbol} placeholder="Search a valid stock symbol" />
              <SymbolPicker
                label="Benchmark"
                value={benchmarkSymbol}
                onChange={setBenchmarkSymbol}
                placeholder="Search a benchmark symbol"
              />
              <label className="space-y-2">
                <span className="form-label">Start Date</span>
                <Input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className="form-input" />
              </label>
              <label className="space-y-2">
                <span className="form-label">End Date</span>
                <Input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} className="form-input" />
              </label>
              <label className="space-y-2 md:col-span-2">
                <span className="form-label">Initial Capital</span>
                <Input value={capital} onChange={(event) => setCapital(event.target.value)} className="form-input" />
              </label>
            </div>
          </div>

          <div className="rounded-md border border-gray-700 bg-gray-800/70 p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-gray-100">Strategy Catalog</h2>
                <p className="text-sm text-gray-500">Choose a prebuilt strategy or replace it with an AI-generated one.</p>
              </div>
            </div>

            <div className="max-h-[420px] space-y-3 overflow-y-auto pr-1">
              {Object.entries(strategiesPayload?.groupedStrategies ?? {}).map(([category, strategies]) => (
                <div key={category}>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-yellow-400">{category}</p>
                  <div className="space-y-2">
                    {strategies.map((strategy) => (
                      <button
                        key={strategy.id}
                        type="button"
                        onClick={() => {
                          setGeneratedStrategy(null);
                          setAiMode("edit");
                          setSelectedStrategyId(strategy.id);
                        }}
                        className={`w-full rounded-md border px-4 py-3 text-left transition-colors ${
                          !generatedStrategy && selectedStrategyId === strategy.id
                            ? strategy.source === "custom"
                              ? "border-teal-400 bg-teal-400/10 text-gray-100"
                              : "border-teal-400 bg-gray-700 text-gray-100"
                            : strategy.source === "custom"
                              ? "border-teal-400/20 bg-teal-400/5 text-gray-300 hover:border-teal-400/40 hover:text-gray-100"
                              : "border-gray-700 bg-gray-900/70 text-gray-400 hover:border-gray-600 hover:text-gray-100"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold text-gray-100">{strategy.displayName ?? strategy.name}</p>
                            {strategy.source === "custom" &&
                              strategy.llmName &&
                              strategy.llmName !== (strategy.displayName ?? strategy.name) && (
                                <p className="mt-1 text-xs font-medium uppercase tracking-[0.18em] text-teal-300">
                                  LLM draft: {strategy.llmName}
                                </p>
                              )}
                            <p className="mt-1 text-sm text-gray-500">{strategy.description}</p>
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            <span className="text-xs uppercase tracking-wide text-teal-400">{strategy.category}</span>
                            {strategy.source === "custom" && (
                              <span className="rounded-md border border-teal-400/30 bg-teal-400/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-teal-300">
                                My Strategy
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-md border border-gray-700 bg-gray-800/70 p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-gray-100">
                  {generatedStrategy ? `My Strategy: ${generatedStrategy.strategy.name}` : activeStrategy?.name ?? "Strategy"}
                </h2>
                <p className="text-sm text-gray-500">{activeStrategy?.description}</p>
              </div>
              {generatedStrategy && (
                <span className="rounded-md bg-teal-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-teal-400">
                  AI Generated
                </span>
              )}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {strategyParameters.map((parameter) => (
                <label key={parameter.key} className="space-y-2">
                  <span className="form-label">{parameter.label}</span>
                  <Input
                    value={parameterOverrides[parameter.key] ?? parameter.defaultValue}
                    onChange={(event) =>
                      setParameterOverrides((current) => ({
                        ...current,
                        [parameter.key]: event.target.value,
                      }))
                    }
                    type="number"
                    className="form-input"
                  />
                  <span className="text-xs text-gray-500">{parameter.description}</span>
                </label>
              ))}
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <Button onClick={runBacktest} className="yellow-btn" disabled={loadingState !== ""}>
                {loadingState === "backtest" ? "Running Backtest..." : "Run Backtest"}
              </Button>
              <Button
                onClick={startPaperTrading}
                variant="outline"
                className="border-gray-600 bg-transparent text-gray-100"
                disabled={loadingState !== ""}
              >
                {loadingState === "paper" ? "Starting..." : "Start Paper Thread"}
              </Button>
            </div>
            {status && <p className="mt-4 text-sm text-teal-400">{status}</p>}
          </div>

          <div className="rounded-md border border-gray-700 bg-gray-800/70 p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-gray-100">AI Strategy Builder</h2>
                <p className="text-sm text-gray-500">
                  {aiMode === "edit" && activeStrategy
                    ? `Make changes to ${activeStrategy.name}, then save it into My Strategies.`
                    : "Create a named strategy from scratch and save it into My Strategies."}
                </p>
              </div>
              <BrainCircuit className="h-5 w-5 text-yellow-400" />
            </div>
            <div className="mb-4 flex flex-wrap items-center gap-3">
              {aiMode === "edit" && activeStrategy ? (
                <div className="rounded-md border border-teal-400/20 bg-teal-400/5 px-3 py-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-teal-300">Editing</p>
                  <p className="text-sm font-medium text-gray-100">{activeStrategy.name}</p>
                </div>
              ) : (
                <label className="block min-w-0 flex-1 space-y-2">
                  <span className="form-label">Strategy Name</span>
                  <Input
                    value={customStrategyName}
                    onChange={(event) => setCustomStrategyName(event.target.value)}
                    placeholder="My Breakout Strategy"
                    className="form-input"
                  />
                </label>
              )}
              <Button
                type="button"
                variant={aiMode === "new" ? "secondary" : "outline"}
                className={
                  aiMode === "new"
                    ? "bg-teal-400 text-gray-950 hover:bg-teal-400/90"
                    : "border-gray-600 bg-transparent text-gray-100"
                }
                onClick={() => {
                  setAiMode("new");
                  setGeneratedStrategy(null);
                  setSelectedStrategyId("");
                  setParameterOverrides({});
                  setCustomStrategyName("");
                  setAiPrompt(
                    "Buy when 20 EMA crosses above 50 EMA, RSI rises through 40, and volume is above its 20 day average. Exit when RSI reaches 72 or price falls back below the 20 EMA.",
                  );
                  setStatus("New strategy mode is ready.");
                }}
              >
                New Strategy
              </Button>
            </div>
            <Textarea
              value={aiPrompt}
              onChange={(event) => setAiPrompt(event.target.value)}
              placeholder={
                aiMode === "edit"
                  ? "Describe what should change in the selected strategy."
                  : "Describe the entry, exit, filters, and risk rules."
              }
              className="min-h-32 form-input py-3"
            />
            <div className="mt-4 flex flex-wrap gap-3">
              <Button onClick={createAiStrategy} variant="secondary" className="bg-teal-400 text-gray-950 hover:bg-teal-400/90">
                {loadingState === "ai" ? "Compiling..." : aiMode === "edit" ? "Make Changes" : "Create Strategy"}
              </Button>
              {generatedStrategy && (
                <Button
                  variant="ghost"
                  className="text-gray-300 hover:text-gray-100"
                  onClick={() => {
                    setGeneratedStrategy(null);
                    setAiMode("edit");
                  }}
                >
                  Return To Selected Strategy
                </Button>
              )}
            </div>

            {generatedStrategy?.explanation && (
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                {[generatedStrategy.explanation.entryLogic, generatedStrategy.explanation.exitLogic, generatedStrategy.explanation.riskLogic]
                  .filter(Boolean)
                  .map((items, index) => (
                    <div key={`${index}-${items?.length ?? 0}`} className="rounded-md border border-gray-700 bg-gray-900/70 p-4">
                      <p className="text-sm font-semibold text-gray-100">
                        {index === 0 ? "Entry Logic" : index === 1 ? "Exit Logic" : "Risk Logic"}
                      </p>
                      <div className="mt-2 space-y-2 text-sm text-gray-400">
                        {items?.map((item) => <p key={item}>{item}</p>)}
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {backtest && (
        <section ref={backtestResultsRef} className="scroll-mt-24 space-y-6">
          <div className="rounded-md border border-yellow-500/30 bg-yellow-500/10 p-5">
            <p className="text-sm font-semibold uppercase tracking-wide text-yellow-400">Latest Backtest Results</p>
            <div className="mt-2 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
              <div>
                <h2 className="text-2xl font-semibold text-gray-100">
                  {backtest.result.symbol} / {backtest.result.strategy.name}
                </h2>
                <p className="text-sm text-gray-400">
                  Run saved as {backtest.runId}. Metrics and trade details are shown below.
                </p>
              </div>
              <p className="text-sm text-gray-300">
                Ending capital: <span className="font-semibold text-gray-100">{currency(backtest.result.metrics.endingCapital)}</span>
              </p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            {[
              { label: "P&L", value: currency(backtest.result.metrics.totalProfitLoss) },
              { label: "Return", value: pct(backtest.result.metrics.returnPct) },
              { label: "Max Drawdown", value: pct(backtest.result.metrics.maxDrawdownPct) },
              { label: "Win Rate", value: pct(backtest.result.metrics.winRatePct) },
              { label: "Sharpe", value: backtest.result.metrics.sharpeRatio.toFixed(2) },
            ].map((metric) => (
              <div key={metric.label} className="rounded-md border border-gray-700 bg-gray-800/70 p-4">
                <p className="text-sm text-gray-500">{metric.label}</p>
                <p className="mt-3 text-2xl font-semibold text-gray-100">{metric.value}</p>
              </div>
            ))}
          </div>

          {researchBrief && (
            <div className="grid gap-5 xl:grid-cols-[0.85fr_1.15fr]">
              <div className="rounded-md border border-teal-400/20 bg-[linear-gradient(135deg,rgba(15,237,190,0.12),rgba(20,20,20,0.92)_48%,rgba(253,212,88,0.10))] p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-wide text-teal-300">Research Brief</p>
                    <h3 className="mt-2 text-2xl font-semibold text-gray-100">{researchBrief.verdict}</h3>
                  </div>
                  <ShieldCheck className="h-6 w-6 text-teal-300" />
                </div>
                <div className="mt-6">
                  <div className="flex items-end justify-between">
                    <span className="text-sm text-gray-400">Strategy Quality Score</span>
                    <span className="text-3xl font-semibold text-gray-100">{researchBrief.riskScore}</span>
                  </div>
                  <div className="mt-3 h-3 overflow-hidden rounded-full bg-gray-900">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-red-500 via-yellow-400 to-teal-400"
                      style={{ width: `${researchBrief.riskScore}%` }}
                    />
                  </div>
                </div>
                <p className="mt-5 text-sm leading-7 text-gray-300">{researchBrief.narrative}</p>
              </div>

              <div className="rounded-md border border-gray-700 bg-gray-800/70 p-5">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-wide text-yellow-400">Performance Diagnostics</p>
                    <h3 className="mt-1 text-xl font-semibold text-gray-100">Risk, pacing, and trade quality</h3>
                  </div>
                  <Activity className="h-5 w-5 text-yellow-400" />
                </div>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {[
                    { label: "CAGR", value: signedPct(researchBrief.cagr), tone: researchBrief.cagr >= 0 ? "text-teal-400" : "text-red-400" },
                    { label: "Calmar", value: researchBrief.calmar.toFixed(2), tone: researchBrief.calmar >= 0 ? "text-teal-400" : "text-red-400" },
                    { label: "Exposure", value: pct(researchBrief.exposurePct), tone: "text-gray-100" },
                    { label: "Trades / Year", value: researchBrief.tradeFrequency.toFixed(1), tone: "text-gray-100" },
                    { label: "Avg Hold", value: `${researchBrief.averageHoldBars.toFixed(1)} bars`, tone: "text-gray-100" },
                    { label: "Avg Trade", value: signedPct(backtest.result.metrics.averageTradeReturnPct), tone: backtest.result.metrics.averageTradeReturnPct >= 0 ? "text-teal-400" : "text-red-400" },
                    { label: "Best Trade", value: signedPct(researchBrief.bestTrade), tone: "text-teal-400" },
                    { label: "Worst Trade", value: signedPct(researchBrief.worstTrade), tone: "text-red-400" },
                  ].map((metric) => (
                    <div key={metric.label} className="rounded-md border border-gray-700 bg-gray-900/70 p-3">
                      <p className="text-xs uppercase tracking-wide text-gray-500">{metric.label}</p>
                      <p className={`mt-2 text-lg font-semibold ${metric.tone}`}>{metric.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          <EquityCurveChart points={backtest.result.equityCurve} />

          <div className="rounded-md border border-gray-700 bg-gray-800/70 p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-gray-100">Trade Log</h2>
                <p className="text-sm text-gray-500">Every simulated entry and exit for the active run.</p>
              </div>
              <p className="text-sm text-gray-400">{backtest.result.metrics.numberOfTrades} trades</p>
            </div>
            {backtest.result.trades.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="text-gray-500">
                    <tr>
                      <th className="pb-3 pr-6">Entry</th>
                      <th className="pb-3 pr-6">Exit</th>
                      <th className="pb-3 pr-6">P&L</th>
                      <th className="pb-3 pr-6">Return</th>
                      <th className="pb-3 pr-6">Reason</th>
                    </tr>
                  </thead>
                  <tbody className="text-gray-300">
                    {backtest.result.trades.slice(-10).map((trade) => (
                      <tr key={trade.id} className="border-t border-gray-700">
                        <td className="py-3 pr-6">{new Date(trade.entryTimestamp).toLocaleDateString()}</td>
                        <td className="py-3 pr-6">{new Date(trade.exitTimestamp).toLocaleDateString()}</td>
                        <td className={`py-3 pr-6 ${trade.profitLoss >= 0 ? "text-teal-400" : "text-red-400"}`}>
                          {currency(trade.profitLoss)}
                        </td>
                        <td className="py-3 pr-6">{pct(trade.returnPct)}</td>
                        <td className="py-3 pr-6 capitalize">{trade.exitReason.replace("-", " ")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="rounded-md border border-dashed border-gray-700 p-6 text-center text-sm text-gray-500">
                This backtest completed, but the strategy did not open any trades in the selected date range.
              </div>
            )}
          </div>
        </section>
      )}

      <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-md border border-gray-700 bg-gray-800/70 p-5">
          <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-100">Live Paper Threads</h2>
              <p className="text-sm text-gray-500">
                {activePaperSessions.length} active, {pausedPaperSessions.length} paused.
              </p>
            </div>
            <Button asChild variant="outline" className="border-gray-600 bg-transparent text-gray-100">
              <Link href="/quant-history?section=paper-sessions#paper-sessions">Closed Threads</Link>
            </Button>
          </div>

          {livePaperSessions.length > 0 ? (
            <div className="max-h-[680px] space-y-3 overflow-y-auto pr-1">
              {livePaperSessions.map((session) => {
                const isSelected = selectedPaperSession?.sessionId === session.sessionId;
                const isLoading = loadingSessionId === session.sessionId;

                return (
                  <div
                    key={session.sessionId}
                    className={`rounded-md border p-4 transition-colors ${
                      isSelected ? "border-teal-400 bg-teal-400/10" : "border-gray-700 bg-gray-900/70"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-semibold text-gray-100">{getThreadLabel(session)}</h3>
                        <p className="mt-1 text-xs text-gray-500">Created {formatDateTime(session.createdAt)}</p>
                      </div>
                      <span
                        className={`rounded-md px-2 py-1 text-xs font-semibold uppercase tracking-wide ${
                          session.status === "active" ? "bg-teal-400/10 text-teal-400" : "bg-yellow-500/10 text-yellow-400"
                        }`}
                      >
                        {session.status}
                      </span>
                    </div>

                    <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
                      <div>
                        <p className="text-gray-500">Equity</p>
                        <p className="mt-1 font-semibold text-gray-100">{currency(getPaperSessionEquity(session))}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Realized P&L</p>
                        <p className="mt-1 font-semibold text-gray-100">{currency(getPaperSessionRealizedPnl(session))}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Trades</p>
                        <p className="mt-1 font-semibold text-gray-100">{getPaperSessionTradeCount(session)}</p>
                      </div>
                    </div>

                    <p className="mt-3 text-xs text-gray-500">Last evaluated {formatDateTime(getPaperSessionLastEvaluatedAt(session))}</p>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant={isSelected ? "secondary" : "outline"}
                        className={
                          isSelected
                            ? "bg-teal-400 text-gray-950 hover:bg-teal-400/90"
                            : "border-gray-600 bg-transparent text-gray-100"
                        }
                        onClick={() => setSelectedPaperSessionId(session.sessionId)}
                      >
                        View
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="border-gray-600 bg-transparent text-gray-100"
                        onClick={() => void refreshPaperTrading(session.sessionId)}
                        disabled={session.status !== "active" || isLoading}
                      >
                        <RefreshCw className="mr-2 h-4 w-4" />
                        {isLoading && session.status === "active" ? "Refreshing..." : "Refresh"}
                      </Button>
                      {session.status === "active" ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="border-yellow-500/40 bg-transparent text-yellow-400 hover:bg-yellow-500/10"
                          onClick={() => void updatePaperTradingStatus(session.sessionId, "paused")}
                          disabled={isLoading}
                        >
                          Pause
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="border-teal-400/40 bg-transparent text-teal-400 hover:bg-teal-400/10"
                          onClick={() => void updatePaperTradingStatus(session.sessionId, "active")}
                          disabled={isLoading}
                        >
                          Resume
                        </Button>
                      )}
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="border-red-500/40 bg-transparent text-red-400 hover:bg-red-500/10"
                        onClick={() => void updatePaperTradingStatus(session.sessionId, "closed")}
                        disabled={isLoading}
                      >
                        Stop
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-md border border-dashed border-gray-700 bg-gray-900/50 p-8 text-center">
              <p className="font-semibold text-gray-100">No live paper threads</p>
              <p className="mt-2 text-sm text-gray-500">
                Start a paper thread from the selected strategy. Active and paused threads will stay here.
              </p>
            </div>
          )}
        </div>

        <div className="rounded-md border border-gray-700 bg-gray-800/70 p-5">
          {selectedPaperSession ? (
            <div className="space-y-5">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-gray-100">Selected Thread Detail</h2>
                  <p className="mt-1 text-sm text-gray-500">{getThreadLabel(selectedPaperSession)}</p>
                </div>
                <span
                  className={`w-fit rounded-md px-3 py-1 text-xs font-semibold uppercase tracking-wide ${
                    selectedPaperSession.status === "active" ? "bg-teal-400/10 text-teal-400" : "bg-yellow-500/10 text-yellow-400"
                  }`}
                >
                  {selectedPaperSession.status}
                </span>
              </div>

              <div className="grid gap-4 md:grid-cols-4">
                <div className="rounded-md border border-gray-700 bg-gray-900/70 p-4">
                  <p className="text-sm text-gray-500">Equity</p>
                  <p className="mt-2 text-2xl font-semibold text-gray-100">{currency(getPaperSessionEquity(selectedPaperSession))}</p>
                </div>
                <div className="rounded-md border border-gray-700 bg-gray-900/70 p-4">
                  <p className="text-sm text-gray-500">Realized P&L</p>
                  <p className="mt-2 text-2xl font-semibold text-gray-100">{currency(getPaperSessionRealizedPnl(selectedPaperSession))}</p>
                </div>
                <div className="rounded-md border border-gray-700 bg-gray-900/70 p-4">
                  <p className="text-sm text-gray-500">Trades</p>
                  <p className="mt-2 text-2xl font-semibold text-gray-100">{getPaperSessionTradeCount(selectedPaperSession)}</p>
                </div>
                <div className="rounded-md border border-gray-700 bg-gray-900/70 p-4">
                  <p className="text-sm text-gray-500">Last Evaluation</p>
                  <p className="mt-2 text-sm font-semibold text-gray-100">
                    {formatDateTime(getPaperSessionLastEvaluatedAt(selectedPaperSession))}
                  </p>
                </div>
              </div>

              <EquityCurveChart points={selectedPaperSession.equityCurve} />

              <div className="rounded-md border border-gray-700 bg-gray-900/70 p-5">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-100">Thread Trade Log</h3>
                    <p className="text-sm text-gray-500">Persisted entries and exits for the selected paper thread.</p>
                  </div>
                  <p className="text-sm text-gray-400">{selectedPaperSession.trades.length} trades</p>
                </div>
                {selectedPaperSession.trades.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-left text-sm">
                      <thead className="text-gray-500">
                        <tr>
                          <th className="pb-3 pr-6">Entry</th>
                          <th className="pb-3 pr-6">Exit</th>
                          <th className="pb-3 pr-6">P&L</th>
                          <th className="pb-3 pr-6">Return</th>
                          <th className="pb-3 pr-6">Reason</th>
                        </tr>
                      </thead>
                      <tbody className="text-gray-300">
                        {selectedPaperSession.trades.slice(-10).map((trade) => (
                          <tr key={trade.id} className="border-t border-gray-700">
                            <td className="py-3 pr-6">{new Date(trade.entryTimestamp).toLocaleDateString()}</td>
                            <td className="py-3 pr-6">{new Date(trade.exitTimestamp).toLocaleDateString()}</td>
                            <td className={`py-3 pr-6 ${trade.profitLoss >= 0 ? "text-teal-400" : "text-red-400"}`}>
                              {currency(trade.profitLoss)}
                            </td>
                            <td className="py-3 pr-6">{pct(trade.returnPct)}</td>
                            <td className="py-3 pr-6 capitalize">{trade.exitReason.replace("-", " ")}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="rounded-md border border-dashed border-gray-700 p-6 text-center text-sm text-gray-500">
                    Trade log is empty for this thread.
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-semibold text-gray-100">Recent Work</h2>
                <p className="mt-1 text-sm text-gray-500">Latest real work appears here when no paper threads are live.</p>
              </div>

              {backtest ? (
                <div className="rounded-md border border-yellow-500/30 bg-yellow-500/10 p-5">
                  <p className="text-sm font-semibold uppercase tracking-wide text-yellow-400">Latest Backtest In This Session</p>
                  <h3 className="mt-2 text-2xl font-semibold text-gray-100">
                    {backtest.result.symbol} / {backtest.result.strategy.name}
                  </h3>
                  <div className="mt-5 grid gap-3 md:grid-cols-3">
                    <div className="rounded-md border border-yellow-500/20 bg-gray-950/30 p-3">
                      <p className="text-sm text-gray-500">Return</p>
                      <p className="mt-2 text-lg font-semibold text-gray-100">{pct(backtest.result.metrics.returnPct)}</p>
                    </div>
                    <div className="rounded-md border border-yellow-500/20 bg-gray-950/30 p-3">
                      <p className="text-sm text-gray-500">Ending Capital</p>
                      <p className="mt-2 text-lg font-semibold text-gray-100">{currency(backtest.result.metrics.endingCapital)}</p>
                    </div>
                    <div className="rounded-md border border-yellow-500/20 bg-gray-950/30 p-3">
                      <p className="text-sm text-gray-500">Trades</p>
                      <p className="mt-2 text-lg font-semibold text-gray-100">{backtest.result.metrics.numberOfTrades}</p>
                    </div>
                  </div>
                </div>
              ) : latestSavedBacktest ? (
                <div className="rounded-md border border-gray-700 bg-gray-900/70 p-5">
                  <p className="text-sm font-semibold uppercase tracking-wide text-yellow-400">Latest Saved Backtest</p>
                  <h3 className="mt-2 text-2xl font-semibold text-gray-100">
                    {latestSavedBacktest.symbol} / {latestSavedBacktest.strategyName}
                  </h3>
                  <div className="mt-5 grid gap-3 md:grid-cols-3">
                    <div>
                      <p className="text-sm text-gray-500">Return</p>
                      <p className="mt-2 text-lg font-semibold text-gray-100">{pct(latestSavedBacktest.metrics.returnPct)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">P&L</p>
                      <p className="mt-2 text-lg font-semibold text-gray-100">
                        {currency(latestSavedBacktest.metrics.totalProfitLoss)}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Trades</p>
                      <p className="mt-2 text-lg font-semibold text-gray-100">{latestSavedBacktest.metrics.numberOfTrades}</p>
                    </div>
                  </div>
                </div>
              ) : latestSavedStrategy ? (
                <div className="rounded-md border border-teal-400/20 bg-teal-400/5 p-5">
                  <p className="text-sm font-semibold uppercase tracking-wide text-teal-300">Latest Saved AI Strategy</p>
                  <h3 className="mt-2 text-2xl font-semibold text-gray-100">{latestSavedStrategy.name}</h3>
                  <p className="mt-2 text-sm text-gray-400">
                    {latestSavedStrategy.category} strategy saved {formatDateTime(latestSavedStrategy.updatedAt)}.
                  </p>
                </div>
              ) : (
                <div className="rounded-md border border-dashed border-gray-700 bg-gray-900/50 p-8 text-center">
                  <p className="font-semibold text-gray-100">No current work yet</p>
                  <p className="mt-2 text-sm text-gray-500">Logs are empty until you run real work in the lab.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default QuantLab;
