import "server-only";

import { MarketBar, MarketSeries } from "@/lib/quant/types";

const marketCache = new Map<string, { expiresAt: number; series: MarketSeries }>();

type YahooChartResponse = {
  chart?: {
    result?: Array<{
      timestamp?: number[];
      indicators?: {
        quote?: Array<{
          open?: Array<number | null>;
          high?: Array<number | null>;
          low?: Array<number | null>;
          close?: Array<number | null>;
          volume?: Array<number | null>;
        }>;
      };
    }>;
    error?: {
      description?: string;
    } | null;
  };
};

const createCacheKey = (symbol: string, startDate?: string, endDate?: string) =>
  [symbol.toUpperCase(), startDate ?? "full", endDate ?? "full"].join(":");

const normalizeSymbol = (symbol: string) => symbol.trim().toUpperCase();

const toUnixTimestamp = (date: string, boundary: "start" | "end") => {
  const normalized = boundary === "start" ? `${date}T00:00:00.000Z` : `${date}T23:59:59.999Z`;
  const timestamp = Math.floor(new Date(normalized).getTime() / 1000);

  if (!Number.isFinite(timestamp) || Number.isNaN(timestamp)) {
    throw new Error(`Invalid ${boundary} date: ${date}`);
  }

  return timestamp;
};

const buildYahooUrl = (symbol: string, startDate?: string, endDate?: string) => {
  const url = new URL(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}`);
  url.searchParams.set("interval", "1d");
  url.searchParams.set("includePrePost", "false");
  url.searchParams.set("events", "div,splits,capitalGains");

  if (startDate || endDate) {
    url.searchParams.set("period1", String(startDate ? toUnixTimestamp(startDate, "start") : 0));
    url.searchParams.set(
      "period2",
      String(endDate ? toUnixTimestamp(endDate, "end") : Math.floor(Date.now() / 1000)),
    );
  } else {
    url.searchParams.set("range", "10y");
  }

  return url.toString();
};

const parseYahooBars = (payload: YahooChartResponse, symbol: string) => {
  const result = payload.chart?.result?.[0];
  const quote = result?.indicators?.quote?.[0];

  if (!result?.timestamp || !quote) {
    const providerMessage = payload.chart?.error?.description;
    throw new Error(
      providerMessage
        ? `Market data provider rejected ${symbol}: ${providerMessage}`
        : `Market data provider returned malformed data for ${symbol}.`,
    );
  }

  const bars: MarketBar[] = result.timestamp
    .map((timestamp, index) => {
      const open = quote.open?.[index];
      const high = quote.high?.[index];
      const low = quote.low?.[index];
      const close = quote.close?.[index];
      const volume = quote.volume?.[index];

      if (
        open === null ||
        high === null ||
        low === null ||
        close === null ||
        volume === null ||
        open === undefined ||
        high === undefined ||
        low === undefined ||
        close === undefined ||
        volume === undefined
      ) {
        return null;
      }

      return {
        timestamp: new Date(timestamp * 1000).toISOString(),
        open,
        high,
        low,
        close,
        volume,
      };
    })
    .filter((bar): bar is MarketBar => bar !== null)
    .sort((left, right) => new Date(left.timestamp).getTime() - new Date(right.timestamp).getTime());

  if (bars.length === 0) {
    throw new Error(`No market data returned for ${symbol} in the selected range.`);
  }

  return bars;
};

export const fetchHistoricalMarketData = async (
  symbol: string,
  startDate?: string,
  endDate?: string,
): Promise<MarketSeries> => {
  const normalizedSymbol = normalizeSymbol(symbol);
  const cacheKey = createCacheKey(normalizedSymbol, startDate, endDate);
  const cached = marketCache.get(cacheKey);

  if (cached && cached.expiresAt > Date.now()) {
    return cached.series;
  }

  const response = await fetch(buildYahooUrl(normalizedSymbol, startDate, endDate), {
    next: { revalidate: 60 * 5 },
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Unable to load market data for ${normalizedSymbol}.`);
  }

  const payload = (await response.json()) as YahooChartResponse;
  const bars = parseYahooBars(payload, normalizedSymbol);
  const series = { symbol: normalizedSymbol, bars };
  marketCache.set(cacheKey, { expiresAt: Date.now() + 60_000, series });

  return series;
};

export const fetchLatestMarketWindow = async (symbol: string, bars = 260) => {
  const series = await fetchHistoricalMarketData(symbol);

  return {
    symbol: series.symbol,
    bars: series.bars.slice(-bars),
  };
};
