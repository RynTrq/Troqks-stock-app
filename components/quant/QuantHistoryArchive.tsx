"use client";

import Link from "next/link";
import { BrainCircuit, BookOpenText, ChevronRight, Gauge, Play, Search, Sparkles, TrendingUp } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  QuantHistoryPayload,
  QuantHistoryBacktestRecord,
  QuantHistoryPaperSessionRecord,
  QuantHistoryStrategyRecord,
} from "@/lib/quant/history";
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

type ArchiveSectionId = "prebuilt" | "backtests" | "paper-sessions" | "my-strategies";

const archiveSections: Array<{
  id: ArchiveSectionId;
  label: string;
  icon: typeof BookOpenText;
  description: string;
}> = [
  {
    id: "prebuilt",
    label: "Prebuilt Strategies",
    icon: BookOpenText,
    description: "Full strategy library available inside Quant Lab.",
  },
  {
    id: "backtests",
    label: "Backtests Logged",
    icon: Gauge,
    description: "Every stored simulation with dates, returns, and trade stats.",
  },
  {
    id: "paper-sessions",
    label: "Paper Sessions",
    icon: Play,
    description: "All persisted paper trading sessions and their latest snapshots.",
  },
  {
    id: "my-strategies",
    label: "My Strategies",
    icon: BrainCircuit,
    description: "Saved AI-built strategies with prompts and deployment context.",
  },
];

const currency = (value: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);

const pct = (value: number) => `${value.toFixed(2)}%`;

const compactPct = (value: number) => `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;

const formatDateTime = (value: string) =>
  new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

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

const getRequestedSection = (): ArchiveSectionId | null => {
  if (typeof window === "undefined") return null;

  const params = new URLSearchParams(window.location.search);
  const section = params.get("section") ?? window.location.hash.replace("#", "");

  return archiveSections.some((item) => item.id === section) ? (section as ArchiveSectionId) : null;
};

const buildSparkPath = (values: number[], width = 420, height = 160, padding = 16) => {
  if (values.length === 0) return "";

  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(max - min, 1);

  return values
    .map((value, index) => {
      const x = padding + (index / Math.max(values.length - 1, 1)) * (width - padding * 2);
      const y = height - padding - ((value - min) / span) * (height - padding * 2);
      return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
};

const categoryPalette = ["#0FEDBE", "#FDD458", "#FF8243", "#5862FF", "#D13BFF", "#FF495B"];

const QuantHistoryArchive = () => {
  const [history, setHistory] = useState<QuantHistoryPayload | null>(null);
  const [strategiesPayload, setStrategiesPayload] = useState<StrategiesPayload | null>(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requestedSection, setRequestedSection] = useState<ArchiveSectionId | null>(null);
  const sectionRefs = useRef<Record<ArchiveSectionId, HTMLElement | null>>({
    prebuilt: null,
    backtests: null,
    "paper-sessions": null,
    "my-strategies": null,
  });

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        const [historyResponse, strategiesResponse] = await Promise.all([
          fetch("/api/quant/history?scope=full"),
          fetch("/api/quant/strategies"),
        ]);

        const [historyJson, strategiesJson] = await Promise.all([
          readJson<QuantHistoryPayload>(historyResponse),
          readJson<StrategiesPayload>(strategiesResponse),
        ]);

        setHistory(historyJson);
        setStrategiesPayload(strategiesJson);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Unable to load Quant History.");
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  useEffect(() => {
    setRequestedSection(getRequestedSection());

    const handleLocationChange = () => {
      setRequestedSection(getRequestedSection());
    };

    window.addEventListener("hashchange", handleLocationChange);
    window.addEventListener("popstate", handleLocationChange);

    return () => {
      window.removeEventListener("hashchange", handleLocationChange);
      window.removeEventListener("popstate", handleLocationChange);
    };
  }, []);

  useEffect(() => {
    if (loading) return;

    if (!requestedSection) return;

    const target = sectionRefs.current[requestedSection];
    if (!target) return;

    const frame = window.requestAnimationFrame(() => {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [loading, requestedSection]);

  const normalizedQuery = query.trim().toLowerCase();

  const prebuiltStrategies = useMemo(
    () => strategiesPayload?.strategies.filter((strategy) => strategy.source !== "custom") ?? [],
    [strategiesPayload],
  );

  const customStrategies = useMemo(
    () => history?.strategies.filter((strategy) => strategy.prompt) ?? [],
    [history],
  );

  const filteredPrebuilt = useMemo(() => {
    if (!normalizedQuery) return prebuiltStrategies;

    return prebuiltStrategies.filter((strategy) =>
      [strategy.displayName, strategy.name, strategy.category, strategy.description]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(normalizedQuery)),
    );
  }, [normalizedQuery, prebuiltStrategies]);

  const filteredBacktests = useMemo(() => {
    if (!normalizedQuery) return history?.backtests ?? [];

    return (history?.backtests ?? []).filter((backtest) =>
      [backtest.symbol, backtest.strategyName, backtest.strategyId, backtest.benchmarkSymbol]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(normalizedQuery)),
    );
  }, [history, normalizedQuery]);

  const filteredPaperSessions = useMemo(() => {
    if (!normalizedQuery) return history?.paperSessions ?? [];

    return (history?.paperSessions ?? []).filter((session) =>
      [session.symbol, session.strategyName, session.strategyId, session.status, session.benchmarkSymbol]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(normalizedQuery)),
    );
  }, [history, normalizedQuery]);

  const filteredCustomStrategies = useMemo(() => {
    if (!normalizedQuery) return customStrategies;

    return customStrategies.filter((strategy) =>
      [strategy.name, strategy.llmName, strategy.category, strategy.prompt, ...(strategy.symbolUniverse ?? [])]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(normalizedQuery)),
    );
  }, [customStrategies, normalizedQuery]);

  const averageBacktestReturn = useMemo(() => {
    if (!history?.backtests.length) return 0;
    return history.backtests.reduce((sum, item) => sum + item.metrics.returnPct, 0) / history.backtests.length;
  }, [history]);

  const bestBacktest = useMemo(() => {
    if (!history?.backtests.length) return null;
    return [...history.backtests].sort((left, right) => right.metrics.returnPct - left.metrics.returnPct)[0] ?? null;
  }, [history]);

  const latestPaperEquity = useMemo(() => {
    if (!history?.paperSessions.length) return null;
    return history.paperSessions[0]?.snapshot?.equity ?? history.paperSessions[0]?.initialCapital ?? null;
  }, [history]);

  const backtestTrendValues = useMemo(
    () => (history?.backtests ?? []).slice(0, 8).map((item) => item.metrics.returnPct).reverse(),
    [history],
  );

  const sectionMix = useMemo(
    () =>
      [
        { label: "Prebuilt", value: prebuiltStrategies.length, color: "#FDD458" },
        { label: "Backtests", value: history?.counts.backtests ?? 0, color: "#0FEDBE" },
        { label: "Paper", value: history?.counts.paperSessions ?? 0, color: "#FF8243" },
        { label: "Custom", value: history?.counts.customStrategies ?? 0, color: "#5862FF" },
      ].filter((item) => item.value > 0),
    [history, prebuiltStrategies],
  );

  const totalMix = useMemo(() => sectionMix.reduce((sum, item) => sum + item.value, 0), [sectionMix]);

  const strategyCategoryMix = useMemo(() => {
    const bucket = new Map<string, number>();

    prebuiltStrategies.forEach((strategy) => {
      bucket.set(strategy.category, (bucket.get(strategy.category) ?? 0) + 1);
    });

    return [...bucket.entries()]
      .map(([label, value], index) => ({
        label,
        value,
        color: categoryPalette[index % categoryPalette.length],
      }))
      .sort((left, right) => right.value - left.value)
      .slice(0, 6);
  }, [prebuiltStrategies]);

  const statusMix = useMemo(() => {
    const bucket = new Map<string, number>();

    (history?.paperSessions ?? []).forEach((session) => {
      bucket.set(session.status, (bucket.get(session.status) ?? 0) + 1);
    });

    return [
      { label: "Active", value: bucket.get("active") ?? 0, color: "bg-teal-400" },
      { label: "Paused", value: bucket.get("paused") ?? 0, color: "bg-yellow-400" },
      { label: "Closed", value: bucket.get("closed") ?? 0, color: "bg-red-500" },
    ];
  }, [history]);

  const activityFeed = useMemo(() => {
    const items = [
      ...(history?.backtests ?? []).slice(0, 4).map((item) => ({
        id: `backtest-${item._id}`,
        title: `${item.symbol} backtest logged`,
        subtitle: item.strategyName,
        stamp: item.createdAt,
        accent: "bg-yellow-400",
      })),
      ...(history?.paperSessions ?? []).slice(0, 4).map((item) => ({
        id: `paper-${item._id}`,
        title: `${item.symbol} paper session ${item.status}`,
        subtitle: item.strategyName,
        stamp: item.updatedAt,
        accent: "bg-teal-400",
      })),
      ...(customStrategies ?? []).slice(0, 4).map((item) => ({
        id: `strategy-${item._id}`,
        title: `${item.name} saved`,
        subtitle: item.category,
        stamp: item.updatedAt,
        accent: "bg-blue-500",
      })),
    ];

    return items.sort((left, right) => new Date(right.stamp).getTime() - new Date(left.stamp).getTime()).slice(0, 6);
  }, [customStrategies, history]);

  const summaryCards = [
    {
      label: "Prebuilt Strategies",
      value: prebuiltStrategies.length,
      href: "/quant-history?section=prebuilt#prebuilt",
      icon: BookOpenText,
    },
    {
      label: "Backtests Logged",
      value: history?.counts.backtests ?? 0,
      href: "/quant-history?section=backtests#backtests",
      icon: Gauge,
    },
    {
      label: "Paper Sessions",
      value: history?.counts.paperSessions ?? 0,
      href: "/quant-history?section=paper-sessions#paper-sessions",
      icon: Play,
    },
    {
      label: "My Strategies",
      value: history?.counts.customStrategies ?? 0,
      href: "/quant-history?section=my-strategies#my-strategies",
      icon: BrainCircuit,
    },
  ];

  const renderBacktestCard = (item: QuantHistoryBacktestRecord) => (
    <article key={item._id} className="rounded-md border border-gray-700 bg-gray-800/70 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-yellow-400">{item.symbol}</p>
          <h3 className="mt-2 text-lg font-semibold text-gray-100">{item.strategyName}</h3>
          <p className="mt-1 text-sm text-gray-500">
            {item.startDate} to {item.endDate}
            {item.benchmarkSymbol ? ` vs ${item.benchmarkSymbol}` : ""}
          </p>
        </div>
        <div className="rounded-md border border-gray-700 bg-gray-900/70 px-3 py-2 text-right">
          <p className="text-xs uppercase tracking-wide text-gray-500">Logged</p>
          <p className="mt-1 text-sm font-medium text-gray-100">{formatDateTime(item.createdAt)}</p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {[
          { label: "Return", value: pct(item.metrics.returnPct), positive: item.metrics.returnPct >= 0 },
          { label: "P&L", value: currency(item.metrics.totalProfitLoss), positive: item.metrics.totalProfitLoss >= 0 },
          { label: "Max Drawdown", value: pct(item.metrics.maxDrawdownPct) },
          { label: "Trades", value: String(item.metrics.numberOfTrades) },
          { label: "Ending Capital", value: currency(item.metrics.endingCapital ?? item.initialCapital) },
        ].map((metric) => (
          <div key={metric.label} className="rounded-md border border-gray-700 bg-gray-900/70 p-3">
            <p className="text-xs uppercase tracking-wide text-gray-500">{metric.label}</p>
            <p
              className={`mt-2 text-lg font-semibold ${
                metric.positive === undefined ? "text-gray-100" : metric.positive ? "text-teal-400" : "text-red-400"
              }`}
            >
              {metric.value}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap gap-2 text-xs text-gray-400">
        <span className="rounded-md border border-gray-700 bg-gray-900/60 px-2 py-1">Capital {currency(item.initialCapital)}</span>
        <span className="rounded-md border border-gray-700 bg-gray-900/60 px-2 py-1">{item.strategyId}</span>
        <span className="rounded-md border border-gray-700 bg-gray-900/60 px-2 py-1">
          {Object.keys(item.parameters ?? {}).length} params
        </span>
      </div>
    </article>
  );

  const renderPaperSessionCard = (item: QuantHistoryPaperSessionRecord) => (
    <article key={item._id} className="rounded-md border border-gray-700 bg-gray-800/70 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-teal-400">{item.symbol}</p>
          <h3 className="mt-2 text-lg font-semibold text-gray-100">{item.strategyName}</h3>
          <p className="mt-1 text-sm text-gray-500">
            Started {formatDate(item.createdAt)}
            {item.benchmarkSymbol ? ` vs ${item.benchmarkSymbol}` : ""}
          </p>
        </div>
        <span
          className={`rounded-md px-3 py-1 text-xs font-semibold uppercase tracking-wide ${
            item.status === "active"
              ? "bg-teal-400/10 text-teal-400"
              : item.status === "paused"
                ? "bg-yellow-500/10 text-yellow-400"
                : "bg-red-500/10 text-red-400"
          }`}
        >
          {item.status}
        </span>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-md border border-gray-700 bg-gray-900/70 p-3">
          <p className="text-xs uppercase tracking-wide text-gray-500">Equity</p>
          <p className="mt-2 text-lg font-semibold text-gray-100">
            {currency(item.snapshot?.equity ?? item.initialCapital)}
          </p>
        </div>
        <div className="rounded-md border border-gray-700 bg-gray-900/70 p-3">
          <p className="text-xs uppercase tracking-wide text-gray-500">Realized P&L</p>
          <p
            className={`mt-2 text-lg font-semibold ${
              (item.snapshot?.realizedProfitLoss ?? 0) >= 0 ? "text-teal-400" : "text-red-400"
            }`}
          >
            {currency(item.snapshot?.realizedProfitLoss ?? 0)}
          </p>
        </div>
        <div className="rounded-md border border-gray-700 bg-gray-900/70 p-3">
          <p className="text-xs uppercase tracking-wide text-gray-500">Trades Logged</p>
          <p className="mt-2 text-lg font-semibold text-gray-100">{item.tradeCount}</p>
        </div>
        <div className="rounded-md border border-gray-700 bg-gray-900/70 p-3">
          <p className="text-xs uppercase tracking-wide text-gray-500">Last Evaluation</p>
          <p className="mt-2 text-sm font-semibold text-gray-100">
            {item.snapshot?.lastEvaluatedAt ? formatDateTime(item.snapshot.lastEvaluatedAt) : "Not available"}
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2 text-xs text-gray-400">
        <span className="rounded-md border border-gray-700 bg-gray-900/60 px-2 py-1">Capital {currency(item.initialCapital)}</span>
        <span className="rounded-md border border-gray-700 bg-gray-900/60 px-2 py-1">{item.strategyId}</span>
        <span className="rounded-md border border-gray-700 bg-gray-900/60 px-2 py-1">
          {Object.keys(item.parameters ?? {}).length} params
        </span>
      </div>
    </article>
  );

  const renderCustomStrategyCard = (item: QuantHistoryStrategyRecord) => (
    <article key={item._id} className="rounded-md border border-teal-400/20 bg-teal-400/5 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-teal-300">{item.category}</p>
          <h3 className="mt-2 text-lg font-semibold text-gray-100">{item.name}</h3>
          {item.llmName && item.llmName !== item.name && <p className="mt-1 text-sm text-gray-500">LLM draft: {item.llmName}</p>}
        </div>
        <div className="rounded-md border border-teal-400/30 bg-teal-400/10 px-3 py-2 text-right">
          <p className="text-xs uppercase tracking-wide text-teal-300">Updated</p>
          <p className="mt-1 text-sm font-medium text-gray-100">{formatDateTime(item.updatedAt)}</p>
        </div>
      </div>

      <p className="mt-4 text-sm leading-6 text-gray-300">{item.prompt ?? "No prompt captured for this strategy."}</p>

      <div className="mt-4 flex flex-wrap gap-2 text-xs text-gray-400">
        <span className="rounded-md border border-teal-400/20 bg-gray-900/60 px-2 py-1">{item.strategyId}</span>
        <span className="rounded-md border border-teal-400/20 bg-gray-900/60 px-2 py-1">
          Universe {(item.symbolUniverse ?? []).length > 0 ? item.symbolUniverse?.join(", ") : "Flexible"}
        </span>
        {item.benchmarkSymbol && (
          <span className="rounded-md border border-teal-400/20 bg-gray-900/60 px-2 py-1">Benchmark {item.benchmarkSymbol}</span>
        )}
      </div>
    </article>
  );

  return (
    <div className="space-y-10 pb-14">
      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-4">
          <p className="text-sm font-semibold uppercase tracking-wide text-teal-400">Quant History</p>
          <h1 className="text-4xl font-bold text-gray-100">Full archive for every strategy, backtest, and paper session in Quant Lab</h1>
          <p className="max-w-4xl text-base leading-7 text-gray-400">
            This workspace keeps the long-form ledger that the main lab only previews. Jump straight into strategy inventory,
            backtest history, active and closed paper sessions, or every saved AI strategy.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button asChild className="yellow-btn">
              <Link href="/quant">Back To Quant Lab</Link>
            </Button>
            <Button asChild variant="outline" className="border-gray-600 bg-transparent text-gray-100">
              <Link href="/quant-history?section=backtests#backtests">Open Latest Research Log</Link>
            </Button>
          </div>
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

      <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-md border border-gray-700 bg-[linear-gradient(135deg,rgba(15,237,190,0.14),rgba(20,20,20,0.96)_42%,rgba(88,98,255,0.18))] p-6">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-xl">
              <p className="text-sm font-semibold uppercase tracking-wide text-teal-300">Archive Pulse</p>
              <h2 className="mt-2 text-3xl font-semibold text-gray-100">A calmer read on what your lab has been doing lately</h2>
              <p className="mt-3 text-sm leading-7 text-gray-300">
                You can skim the shape of performance here before dropping into the detailed logs below.
              </p>
            </div>
            <div className="grid min-w-0 gap-3 sm:grid-cols-3">
              <div className="rounded-md border border-white/10 bg-black/20 p-4 backdrop-blur-sm">
                <p className="text-xs uppercase tracking-wide text-gray-400">Average Backtest Return</p>
                <p className={`mt-3 text-2xl font-semibold ${averageBacktestReturn >= 0 ? "text-teal-300" : "text-red-300"}`}>
                  {compactPct(averageBacktestReturn)}
                </p>
              </div>
              <div className="rounded-md border border-white/10 bg-black/20 p-4 backdrop-blur-sm">
                <p className="text-xs uppercase tracking-wide text-gray-400">Best Logged Run</p>
                <p className="mt-3 text-2xl font-semibold text-gray-100">
                  {bestBacktest ? compactPct(bestBacktest.metrics.returnPct) : "--"}
                </p>
                <p className="mt-1 text-xs text-gray-400">{bestBacktest ? `${bestBacktest.symbol} · ${bestBacktest.strategyName}` : "No runs yet"}</p>
              </div>
              <div className="rounded-md border border-white/10 bg-black/20 p-4 backdrop-blur-sm">
                <p className="text-xs uppercase tracking-wide text-gray-400">Latest Paper Equity</p>
                <p className="mt-3 text-2xl font-semibold text-gray-100">{latestPaperEquity ? currency(latestPaperEquity) : "--"}</p>
              </div>
            </div>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded-md border border-white/10 bg-black/20 p-4 backdrop-blur-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-gray-100">Recent Backtest Trend</p>
                  <p className="text-sm text-gray-400">Last eight returns, read left to right.</p>
                </div>
                <TrendingUp className="h-4 w-4 text-teal-300" />
              </div>
              <div className="mt-4">
                {backtestTrendValues.length > 0 ? (
                  <svg viewBox="0 0 420 160" className="h-40 w-full">
                    <defs>
                      <linearGradient id="archiveTrendFill" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor="#0FEDBE" stopOpacity="0.3" />
                        <stop offset="100%" stopColor="#0FEDBE" stopOpacity="0.04" />
                      </linearGradient>
                    </defs>
                    <rect x="0" y="0" width="420" height="160" rx="8" fill="#101215" />
                    <path d={buildSparkPath(backtestTrendValues)} fill="none" stroke="#0FEDBE" strokeWidth="3" strokeLinecap="round" />
                    {backtestTrendValues.map((value, index) => {
                      const min = Math.min(...backtestTrendValues);
                      const max = Math.max(...backtestTrendValues);
                      const span = Math.max(max - min, 1);
                      const x = 16 + (index / Math.max(backtestTrendValues.length - 1, 1)) * (420 - 32);
                      const y = 160 - 16 - ((value - min) / span) * (160 - 32);

                      return <circle key={`${index}-${value}`} cx={x} cy={y} r="4" fill={value >= 0 ? "#0FEDBE" : "#FF495B"} />;
                    })}
                  </svg>
                ) : (
                  <div className="flex h-40 items-center justify-center rounded-md bg-[#101215] text-sm text-gray-500">
                    Backtest trend will appear as soon as runs are logged.
                  </div>
                )}
              </div>
            </div>

            <div className="grid gap-4">
              <div className="rounded-md border border-white/10 bg-black/20 p-4 backdrop-blur-sm">
                <p className="text-sm font-semibold text-gray-100">Workspace Mix</p>
                <div className="mt-4 h-3 overflow-hidden rounded-full bg-gray-900">
                  <div className="flex h-full w-full">
                    {sectionMix.map((item) => (
                      <div
                        key={item.label}
                        className="h-full"
                        style={{
                          width: `${totalMix > 0 ? (item.value / totalMix) * 100 : 0}%`,
                          backgroundColor: item.color,
                        }}
                      />
                    ))}
                  </div>
                </div>
                <div className="mt-4 grid gap-2">
                  {sectionMix.map((item) => (
                    <div key={item.label} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2 text-gray-300">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                        {item.label}
                      </div>
                      <span className="font-medium text-gray-100">{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-md border border-white/10 bg-black/20 p-4 backdrop-blur-sm">
                <p className="text-sm font-semibold text-gray-100">Paper Session Status</p>
                <div className="mt-4 space-y-3">
                  {statusMix.map((item) => {
                    const total = Math.max(history?.counts.paperSessions ?? 0, 1);
                    return (
                      <div key={item.label}>
                        <div className="mb-1 flex items-center justify-between text-sm">
                          <span className="text-gray-300">{item.label}</span>
                          <span className="text-gray-100">{item.value}</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-gray-900">
                          <div className={`${item.color} h-full rounded-full`} style={{ width: `${(item.value / total) * 100}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-4">
          <div className="rounded-md border border-gray-700 bg-gray-800/70 p-5">
            <p className="text-sm font-semibold uppercase tracking-wide text-yellow-400">Strategy Spread</p>
            <h3 className="mt-2 text-xl font-semibold text-gray-100">What your prebuilt library leans toward</h3>
            <div className="mt-5 space-y-3">
              {strategyCategoryMix.map((item) => {
                const maxValue = strategyCategoryMix[0]?.value ?? 1;
                return (
                  <div key={item.label}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="text-gray-300">{item.label}</span>
                      <span className="text-gray-100">{item.value}</span>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-gray-900">
                      <div className="h-full rounded-full" style={{ width: `${(item.value / maxValue) * 100}%`, backgroundColor: item.color }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-md border border-gray-700 bg-gray-800/70 p-5">
            <p className="text-sm font-semibold uppercase tracking-wide text-teal-400">Recent Activity</p>
            <h3 className="mt-2 text-xl font-semibold text-gray-100">Fresh movement across the lab</h3>
            <div className="mt-5 space-y-4">
              {activityFeed.length > 0 ? (
                activityFeed.map((item, index) => (
                  <div key={item.id} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <span className={`mt-1 h-2.5 w-2.5 rounded-full ${item.accent}`} />
                      {index < activityFeed.length - 1 && <span className="mt-2 h-full w-px bg-gray-700" />}
                    </div>
                    <div className="pb-2">
                      <p className="font-medium text-gray-100">{item.title}</p>
                      <p className="text-sm text-gray-500">{item.subtitle}</p>
                      <p className="mt-1 text-xs text-gray-500">{formatDateTime(item.stamp)}</p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-500">Recent activity will land here once the archive has a little more motion.</p>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-md border border-gray-700 bg-gray-800/70 p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-yellow-400">Archive Navigation</p>
            <h2 className="mt-2 text-2xl font-semibold text-gray-100">Move through the ledger by section or search term</h2>
          </div>
          <label className="relative block w-full max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search symbol, strategy, prompt, or status"
              className="form-input pl-10"
            />
          </label>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {archiveSections.map((section) => (
            <a
              key={section.id}
              href={`#${section.id}`}
            className="rounded-md border border-gray-700 bg-gray-900/70 p-4 transition-colors hover:border-teal-400/40 hover:bg-gray-900 hover:text-gray-100"
            >
              <div className="flex items-center justify-between">
                <section.icon className="h-4 w-4 text-teal-400" />
                <ChevronRight className="h-4 w-4 text-gray-500" />
              </div>
              <p className="mt-4 font-semibold text-gray-100">{section.label}</p>
              <p className="mt-2 text-sm leading-6 text-gray-500">{section.description}</p>
            </a>
          ))}
        </div>
      </section>

      {loading ? (
        <div className="rounded-md border border-dashed border-gray-700 p-10 text-center text-gray-500">
          Loading the Quant History archive...
        </div>
      ) : error ? (
        <div className="rounded-md border border-red-500/30 bg-red-500/10 p-6 text-sm text-red-200">{error}</div>
      ) : (
        <div className="space-y-8">
          <section
            id="prebuilt"
            ref={(element) => {
              sectionRefs.current.prebuilt = element;
            }}
            className="scroll-mt-24 space-y-5"
          >
            <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide text-yellow-400">Prebuilt Strategies</p>
                <h2 className="text-2xl font-semibold text-gray-100">Full Quant Lab strategy catalog</h2>
              </div>
              <p className="text-sm text-gray-500">{filteredPrebuilt.length} strategies matched</p>
            </div>

            {filteredPrebuilt.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {filteredPrebuilt.map((strategy) => (
                  <article key={strategy.id} className="rounded-md border border-gray-700 bg-[linear-gradient(180deg,rgba(20,20,20,0.94),rgba(20,20,20,0.82))] p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-yellow-400">{strategy.category}</p>
                        <h3 className="mt-2 text-lg font-semibold text-gray-100">{strategy.displayName ?? strategy.name}</h3>
                      </div>
                      <Sparkles className="h-4 w-4 text-teal-400" />
                    </div>
                    <p className="mt-4 text-sm leading-6 text-gray-400">{strategy.description}</p>
                    <div className="mt-4 flex flex-wrap gap-2 text-xs text-gray-400">
                      <span className="rounded-md border border-gray-700 bg-gray-900/60 px-2 py-1">{strategy.id}</span>
                      <span className="rounded-md border border-gray-700 bg-gray-900/60 px-2 py-1">
                        {strategy.parameters.length} params
                      </span>
                      {strategy.benchmarkSymbol && (
                        <span className="rounded-md border border-gray-700 bg-gray-900/60 px-2 py-1">
                          Benchmark {strategy.benchmarkSymbol}
                        </span>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="rounded-md border border-dashed border-gray-700 p-8 text-center text-sm text-gray-500">
                No prebuilt strategies matched that search.
              </div>
            )}
          </section>

          <section
            id="backtests"
            ref={(element) => {
              sectionRefs.current.backtests = element;
            }}
            className="scroll-mt-24 space-y-5"
          >
            <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide text-yellow-400">Backtests Logged</p>
                <h2 className="text-2xl font-semibold text-gray-100">Historical simulation archive</h2>
              </div>
              <p className="text-sm text-gray-500">{filteredBacktests.length} runs matched</p>
            </div>

            {filteredBacktests.length > 0 ? (
              <div className="grid gap-4">{filteredBacktests.map(renderBacktestCard)}</div>
            ) : (
              <div className="rounded-md border border-dashed border-gray-700 p-8 text-center text-sm text-gray-500">
                No backtests matched that search yet.
              </div>
            )}
          </section>

          <section
            id="paper-sessions"
            ref={(element) => {
              sectionRefs.current["paper-sessions"] = element;
            }}
            className="scroll-mt-24 space-y-5"
          >
            <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide text-teal-400">Paper Sessions</p>
                <h2 className="text-2xl font-semibold text-gray-100">Paper trading ledger</h2>
              </div>
              <p className="text-sm text-gray-500">{filteredPaperSessions.length} sessions matched</p>
            </div>

            {filteredPaperSessions.length > 0 ? (
              <div className="grid gap-4">{filteredPaperSessions.map(renderPaperSessionCard)}</div>
            ) : (
              <div className="rounded-md border border-dashed border-gray-700 p-8 text-center text-sm text-gray-500">
                No paper sessions matched that search yet.
              </div>
            )}
          </section>

          <section
            id="my-strategies"
            ref={(element) => {
              sectionRefs.current["my-strategies"] = element;
            }}
            className="scroll-mt-24 space-y-5"
          >
            <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide text-teal-400">My Strategies</p>
                <h2 className="text-2xl font-semibold text-gray-100">Saved AI strategy history</h2>
              </div>
              <p className="text-sm text-gray-500">{filteredCustomStrategies.length} strategies matched</p>
            </div>

            {filteredCustomStrategies.length > 0 ? (
              <div className="grid gap-4 xl:grid-cols-2">{filteredCustomStrategies.map(renderCustomStrategyCard)}</div>
            ) : (
              <div className="rounded-md border border-dashed border-gray-700 p-8 text-center text-sm text-gray-500">
                No saved strategies matched that search yet.
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
};

export default QuantHistoryArchive;
