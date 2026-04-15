import TradingViewWidget from "@/components/TradingViewWidget";
import StockSwitcher from "@/components/StockSwitcher";
import {
  COMPANY_FINANCIALS_WIDGET_CONFIG,
  DASHBOARD_ADVANCED_CHART_CONFIG,
  POPULAR_STOCKS,
  SYMBOL_INFO_WIDGET_CONFIG,
  SYMBOL_PROFILE_WIDGET_CONFIG,
  TECHNICAL_ANALYSIS_WIDGET_CONFIG,
} from "@/lib/constants";
import { normalizeSymbol } from "@/lib/validation";

type HomePageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const toTradingViewSymbol = (symbol: string, exchange?: string) => `${exchange ?? "NASDAQ"}:${symbol}`;

const Home = async ({ searchParams }: HomePageProps) => {
  const params = (await searchParams) ?? {};
  const requestedSymbol = Array.isArray(params.symbol) ? params.symbol[0] : params.symbol;
  const normalizedSymbol = normalizeSymbol(requestedSymbol ?? "") || "AAPL";
  const selectedStock =
    POPULAR_STOCKS.find((stock) => stock.symbol === normalizedSymbol) ??
    ({ symbol: normalizedSymbol, company: `${normalizedSymbol} overview`, exchange: "NASDAQ" } as const);
  const tradingViewSymbol = toTradingViewSymbol(selectedStock.symbol, selectedStock.exchange);
  const scriptURL = "https://s3.tradingview.com/external-embedding/embed-widget-";

  return (
    <div className="flex min-h-screen home-wrapper">
      <section className="w-full space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
            <p className="text-sm font-semibold uppercase tracking-wide text-teal-400">Live Market Workspace</p>
            <h1 className="text-4xl font-bold text-gray-100">{selectedStock.symbol}</h1>
            <p className="max-w-3xl text-base leading-7 text-gray-400">
              {selectedStock.company} on {selectedStock.exchange}. Search another ticker and this workspace updates in place with
              the new chart stack, company context, and technical readout.
            </p>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
          <div className="flex min-h-[430px] flex-col">
            <TradingViewWidget
              title="Symbol Snapshot"
              scriptUrl={`${scriptURL}symbol-info.js`}
              config={SYMBOL_INFO_WIDGET_CONFIG(tradingViewSymbol)}
              height={200}
              className="custom-chart"
            />
            <StockSwitcher currentSymbol={selectedStock.symbol} compact className="mt-auto w-full" />
          </div>
          <div>
            <TradingViewWidget
              title="Technical Outlook"
              scriptUrl={`${scriptURL}technical-analysis.js`}
              config={TECHNICAL_ANALYSIS_WIDGET_CONFIG(tradingViewSymbol)}
              height={430}
              className="custom-chart"
            />
          </div>
        </div>
      </section>
      <section className="w-full space-y-4">
        <TradingViewWidget
          title={undefined}
          scriptUrl={`${scriptURL}advanced-chart.js`}
          config={DASHBOARD_ADVANCED_CHART_CONFIG(tradingViewSymbol)}
          height={760}
          className="dashboard-hero-chart"
        />
      </section>

      <section className="grid w-full gap-8 xl:grid-cols-[0.9fr_1.1fr]">
        <div>
          <TradingViewWidget
            title="Company Profile"
            scriptUrl={`${scriptURL}symbol-profile.js`}
            config={SYMBOL_PROFILE_WIDGET_CONFIG(tradingViewSymbol)}
            height={460}
            className="custom-chart"
          />
        </div>
        <div>
          <TradingViewWidget
            title="Financials"
            scriptUrl={`${scriptURL}financials.js`}
            config={COMPANY_FINANCIALS_WIDGET_CONFIG(tradingViewSymbol)}
            height={480}
            className="custom-chart"
          />
        </div>
      </section>
    </div>
  );
};

export default Home;
