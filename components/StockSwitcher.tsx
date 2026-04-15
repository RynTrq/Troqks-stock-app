'use client';

import { startTransition, useDeferredValue, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { useRouter } from "next/navigation";

import { POPULAR_STOCKS } from "@/lib/constants";
import { Input } from "@/components/ui/input";
import { normalizeSymbol } from "@/lib/validation";

type StockSwitcherProps = {
  currentSymbol: string;
  className?: string;
  compact?: boolean;
};

const StockSwitcher = ({ currentSymbol, className, compact = false }: StockSwitcherProps) => {
  const router = useRouter();
  const [query, setQuery] = useState(currentSymbol);
  const deferredQuery = useDeferredValue(query);

  const suggestions = useMemo(() => {
    const normalized = normalizeSymbol(deferredQuery);
    const lower = deferredQuery.trim().toLowerCase();

    if (!normalized && !lower) return POPULAR_STOCKS.slice(0, compact ? 5 : 6);

    return POPULAR_STOCKS.filter((stock) => {
      return (
        stock.symbol.includes(normalized) ||
        stock.company.toLowerCase().includes(lower) ||
        stock.exchange.toLowerCase().includes(lower)
      );
    }).slice(0, compact ? 5 : 6);
  }, [compact, deferredQuery]);

  const commitSymbol = (rawSymbol: string) => {
    const nextSymbol = normalizeSymbol(rawSymbol);

    if (!nextSymbol || nextSymbol === currentSymbol) return;

    startTransition(() => {
      router.replace(`/?symbol=${nextSymbol}`, { scroll: false });
    });
  };

  return (
    <div className={className}>
      <div className="relative">
        <Search
          className={`pointer-events-none absolute top-1/2 -translate-y-1/2 text-gray-500 ${
            compact ? "left-6 h-5 w-5" : "left-5 h-4 w-4"
          }`}
        />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              commitSymbol(query);
            }
          }}
          placeholder={compact ? "" : "Change symbol across the whole page"}
          className={`form-input ${
            compact
              ? "h-[94px] rounded-md border-gray-700 bg-[#111111] pl-24 text-[32px] font-light tracking-tight text-gray-100"
              : "h-12 pl-[3.75rem]"
          }`}
          style={compact ? { paddingLeft: "5.75rem" } : { paddingLeft: "3.75rem" }}
          aria-label="Change stock symbol"
        />
      </div>

      <div className={`mt-3 flex flex-wrap gap-2 ${compact ? "" : "max-w-3xl"}`}>
        {suggestions.map((stock) => (
          <button
            key={stock.symbol}
            type="button"
            onClick={() => {
              setQuery(stock.symbol);
              commitSymbol(stock.symbol);
            }}
            className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
              compact
                ? stock.symbol === currentSymbol
                  ? "border-yellow-500 bg-transparent px-6 py-4 text-2xl font-light text-yellow-400"
                  : "border-gray-600 bg-gray-800 px-6 py-4 text-2xl font-light text-gray-300 hover:border-yellow-500 hover:text-yellow-400"
                : stock.symbol === currentSymbol
                  ? "border-yellow-500 bg-yellow-500/10 text-yellow-400"
                  : "border-gray-600 bg-gray-800 text-gray-300 hover:border-yellow-500 hover:text-yellow-400"
            }`}
          >
            {stock.symbol}
          </button>
        ))}
      </div>
    </div>
  );
};

export default StockSwitcher;
