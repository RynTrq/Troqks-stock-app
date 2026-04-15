"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { BrainCircuit, Gauge, Play, RefreshCw, Rocket, TestTubeDiagonal } from "lucide-react";
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
    equityCurve: Array<{ timestamp: string; equity: number }>;
    trades: Array<{
      id: string;
      entryTimestamp: string;
      exitTimestamp: string;
      profitLoss: number;
      returnPct: number;
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
  snapshot: {
    equity: number;
    realizedProfitLoss: number;
    lastEvaluatedAt: string;
  };
  trades: Array<{
    id: string;
    entryTimestamp: string;
    exitTimestamp: string;
    profitLoss: number;
    returnPct: number;
    exitReason: string;
  }>;
  equityCurve: Array<{ timestamp: string; equity: number }>;
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
  const [paperSession, setPaperSession] = useState<PaperSessionPayload | null>(null);
  const [generatedStrategy, setGeneratedStrategy] = useState<GeneratedPayload | null>(null);
  const [aiMode, setAiMode] = useState<AiMode>("edit");
  const [customStrategyName, setCustomStrategyName] = useState("Momentum Volume Breakout");
  const [aiPrompt, setAiPrompt] = useState(
    "Make entries stricter by requiring RSI confirmation and add a tighter trailing stop.",
  );
  const [status, setStatus] = useState<string | null>(null);
  const [loadingState, setLoadingState] = useState<"" | "backtest" | "ai" | "paper" | "refresh">("");
  const backtestResultsRef = useRef<HTMLElement | null>(null);

  const loadPaperSessions = async (targetSessionId?: string) => {
    const response = await fetch("/api/quant/paper-sessions");
    const payload = await readJson<{ sessions: PaperSessionPayload[] }>(response);

    if (payload.sessions.length === 0) {
      setPaperSession(null);
      return;
    }

    const targetSession =
      (targetSessionId
        ? payload.sessions.find((session) => session.sessionId === targetSessionId)
        : null) ?? payload.sessions[0];

    setPaperSession(targetSession);
  };

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
          fetch("/api/quant/paper-sessions"),
        ]);

        const [strategiesJson, historyJson, paperSessionsJson] = await Promise.all([
          readJson<StrategiesPayload>(strategiesResponse),
          readJson<QuantHistoryPayload>(historyResponse),
          readJson<{ sessions: PaperSessionPayload[] }>(paperSessionsResponse),
        ]);

        setStrategiesPayload(strategiesJson);
        setHistory(historyJson);
        if (paperSessionsJson.sessions.length > 0) {
          setPaperSession(paperSessionsJson.sessions[0]);
        }
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
      setPaperSession(await readJson<PaperSessionPayload>(response));
      setStatus("Paper trading session started.");
      void loadHistory();
      void loadPaperSessions();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to start paper trading.");
    } finally {
      setLoadingState("");
    }
  };

  const refreshPaperTrading = async () => {
    if (!paperSession) return;
    setLoadingState("refresh");
    const response = await fetch(`/api/quant/paper-sessions/${paperSession.sessionId}/refresh`, {
      method: "POST",
    });

    try {
      setPaperSession(await readJson<PaperSessionPayload>(response));
      setStatus("Paper trading session refreshed against the latest available market data.");
      void loadHistory();
      void loadPaperSessions();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to refresh paper trading session.");
    } finally {
      setLoadingState("");
    }
  };

  const updatePaperTradingStatus = async (nextStatus: "paused" | "closed" | "active") => {
    if (!paperSession) return;
    setLoadingState("refresh");
    setStatus(null);

    const response = await fetch(`/api/quant/paper-sessions/${paperSession.sessionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStatus }),
    });

    try {
      setPaperSession(await readJson<PaperSessionPayload>(response));
      setStatus(
        nextStatus === "closed"
          ? "Paper trading session stopped."
          : nextStatus === "paused"
            ? "Paper trading session paused."
            : "Paper trading session resumed.",
      );
      void loadHistory();
      void loadPaperSessions();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to update paper trading session.");
    } finally {
      setLoadingState("");
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
                disabled={loadingState !== "" || paperSession?.status === "active"}
              >
                {loadingState === "paper" ? "Starting..." : paperSession?.status === "active" ? "Paper Trading Active" : "Start Paper Trading"}
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
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-gray-100">Paper Trading</h2>
                <p className="text-sm text-gray-500">Track a live simulation snapshot using the latest available market data.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  className="border-gray-600 bg-transparent text-gray-100"
                  onClick={refreshPaperTrading}
                  disabled={!paperSession || paperSession.status !== "active"}
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  {loadingState === "refresh" ? "Refreshing..." : "Refresh"}
                </Button>
                {paperSession?.status === "active" && (
                  <Button
                    variant="outline"
                    className="border-yellow-500/40 bg-transparent text-yellow-400 hover:bg-yellow-500/10"
                    onClick={() => updatePaperTradingStatus("paused")}
                    disabled={loadingState !== ""}
                  >
                    Pause
                  </Button>
                )}
                {paperSession?.status === "paused" && (
                  <Button
                    variant="outline"
                    className="border-teal-400/40 bg-transparent text-teal-400 hover:bg-teal-400/10"
                    onClick={() => updatePaperTradingStatus("active")}
                    disabled={loadingState !== ""}
                  >
                    Resume
                  </Button>
                )}
                {paperSession && paperSession.status !== "closed" && (
                  <Button
                    variant="outline"
                    className="border-red-500/40 bg-transparent text-red-400 hover:bg-red-500/10"
                    onClick={() => updatePaperTradingStatus("closed")}
                    disabled={loadingState !== ""}
                  >
                    Stop
                  </Button>
                )}
              </div>
            </div>

          {paperSession ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-md border border-gray-700 bg-gray-900/70 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-gray-100">Session Status</p>
                  <p className="text-sm text-gray-500">
                    {paperSession.status === "active"
                      ? "The simulator can refresh against the latest market data."
                      : paperSession.status === "paused"
                        ? "The simulator is paused and will not refresh until resumed."
                        : "The simulator has been stopped and kept for history."}
                  </p>
                </div>
                <span
                  className={`rounded-md px-3 py-1 text-xs font-semibold uppercase tracking-wide ${
                    paperSession.status === "active"
                      ? "bg-teal-400/10 text-teal-400"
                      : paperSession.status === "paused"
                        ? "bg-yellow-500/10 text-yellow-400"
                        : "bg-red-500/10 text-red-400"
                  }`}
                >
                  {paperSession.status ?? "active"}
                </span>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-md border border-gray-700 bg-gray-900/70 p-4">
                  <p className="text-sm text-gray-500">Equity</p>
                  <p className="mt-2 text-2xl font-semibold text-gray-100">{currency(paperSession.snapshot.equity)}</p>
                </div>
                <div className="rounded-md border border-gray-700 bg-gray-900/70 p-4">
                  <p className="text-sm text-gray-500">Realized P&L</p>
                  <p className="mt-2 text-2xl font-semibold text-gray-100">{currency(paperSession.snapshot.realizedProfitLoss)}</p>
                </div>
                <div className="rounded-md border border-gray-700 bg-gray-900/70 p-4">
                  <p className="text-sm text-gray-500">Last Evaluation</p>
                  <p className="mt-2 text-base font-semibold text-gray-100">
                    {new Date(paperSession.snapshot.lastEvaluatedAt).toLocaleString()}
                  </p>
                </div>
              </div>
              <EquityCurveChart points={paperSession.equityCurve} />
              <div className="rounded-md border border-gray-700 bg-gray-900/70 p-5">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-100">Paper Trade Log</h3>
                    <p className="text-sm text-gray-500">Persisted trades for the current paper session.</p>
                  </div>
                  <p className="text-sm text-gray-400">{paperSession.trades.length} trades</p>
                </div>
                {paperSession.trades.length > 0 ? (
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
                        {paperSession.trades.slice(-10).map((trade) => (
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
                    No paper trades have been recorded for this session yet.
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="rounded-md border border-dashed border-gray-700 p-8 text-center text-gray-500">
              Start a paper trading session to persist a live simulation ledger.
            </div>
          )}
        </div>

        <div className="rounded-md border border-gray-700 bg-gray-800/70 p-5">
          <div className="mb-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <h2 className="text-xl font-semibold text-gray-100">Experiment History</h2>
                <p className="text-sm text-gray-500">Saved AI strategies, backtests, and paper sessions ready for comparison.</p>
              </div>
              <Button asChild variant="outline" className="border-gray-600 bg-transparent text-gray-100">
                <Link href="/quant-history">Open Full Quant History</Link>
              </Button>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-3">
              <p className="text-sm font-semibold uppercase tracking-wide text-teal-400">My Own Strategies</p>
              {history?.strategies.filter((item) => item.prompt).slice(0, 6).map((item) => (
                <div key={item._id} className="rounded-md border border-teal-400/20 bg-teal-400/5 p-4 shadow-[0_0_0_1px_rgba(45,212,191,0.04)]">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-gray-100">{item.name}</p>
                      <p className="mt-1 text-xs uppercase tracking-wide text-teal-300">{item.category}</p>
                    </div>
                    <span className="rounded-md border border-teal-400/30 bg-teal-400/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-teal-300">
                      Custom
                    </span>
                  </div>
                </div>
              ))}
              {history && history.strategies.filter((item) => item.prompt).length === 0 && (
                <div className="rounded-md border border-dashed border-gray-700 bg-gray-900/50 p-4 text-sm text-gray-500">
                  Your named custom strategies will show up here after you generate and save them.
                </div>
              )}
            </div>
            <div className="space-y-3">
              <p className="text-sm font-semibold uppercase tracking-wide text-yellow-400">Backtests</p>
              {history?.backtests.slice(0, 6).map((item) => (
                <div key={item._id} className="rounded-md border border-gray-700 bg-gray-900/70 p-3">
                  <p className="font-medium text-gray-100">{item.symbol}</p>
                  <p className="mt-1 text-sm text-gray-400">{item.strategyName}</p>
                  <p className="mt-2 text-xs text-teal-400">{pct(item.metrics.returnPct)}</p>
                </div>
              ))}
            </div>
            <div className="space-y-3">
              <p className="text-sm font-semibold uppercase tracking-wide text-yellow-400">Paper Sessions</p>
              {history?.paperSessions.slice(0, 6).map((item) => (
                <button
                  key={item._id}
                  type="button"
                  onClick={() => void loadPaperSessions(item._id)}
                  className="w-full rounded-md border border-gray-700 bg-gray-900/70 p-3 text-left"
                >
                  <p className="font-medium text-gray-100">{item.symbol}</p>
                  <p className="mt-1 text-sm text-gray-400">{item.strategyName}</p>
                  <p className="mt-2 text-xs uppercase tracking-wide text-teal-400">{item.status}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default QuantLab;
