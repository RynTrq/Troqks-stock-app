'use client';

import {useMemo, useState} from "react";
import Link from "next/link";
import {Search} from "lucide-react";
import {Input} from "@/components/ui/input";
import {POPULAR_STOCKS} from "@/lib/constants";
import {normalizeSymbol} from "@/lib/validation";

const SearchPage = () => {
    const [query, setQuery] = useState("");

    const filteredStocks = useMemo(() => {
        const normalizedQuery = normalizeSymbol(query);
        const lowerQuery = query.trim().toLowerCase();

        if (!normalizedQuery && !lowerQuery) return POPULAR_STOCKS;

        return POPULAR_STOCKS.filter((stock) => {
            return (
                stock.symbol.includes(normalizedQuery) ||
                stock.company.toLowerCase().includes(lowerQuery) ||
                stock.exchange.toLowerCase().includes(lowerQuery)
            );
        });
    }, [query]);

    return (
        <section className="space-y-8">
            <div className="max-w-3xl space-y-3">
                <p className="text-sm font-semibold uppercase text-yellow-500">Stock search</p>
                <h1 className="text-4xl font-bold text-gray-100">Find a market to follow</h1>
                <p className="text-gray-500">
                    Search popular symbols, compare exchanges, and load the full dashboard for the one you want to study.
                </p>
            </div>

            <div className="relative max-w-2xl">
                <Search className="absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-500" />
                <Input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search by symbol, company, or exchange"
                    className="form-input h-14 pl-16"
                    style={{ paddingLeft: "4rem" }}
                    aria-label="Search stocks"
                />
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {filteredStocks.map((stock) => (
                    <article key={stock.symbol} className="rounded-md border border-gray-700 bg-gray-800 p-5">
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <h2 className="text-2xl font-semibold text-gray-100">{stock.symbol}</h2>
                                <p className="mt-1 text-gray-400">{stock.company}</p>
                            </div>
                            <span className="rounded-md bg-gray-700 px-2 py-1 text-sm font-medium text-yellow-400">
                                {stock.exchange}
                            </span>
                        </div>

                        <Link
                            href={`/?symbol=${stock.symbol}`}
                            className="mt-5 inline-flex rounded-md bg-yellow-500 px-4 py-2 font-medium text-gray-900 transition-colors hover:bg-yellow-400"
                        >
                            Open in dashboard
                        </Link>
                    </article>
                ))}
            </div>

            {filteredStocks.length === 0 && (
                <div className="rounded-md border border-gray-700 bg-gray-800 p-8 text-center">
                    <p className="text-lg font-semibold text-gray-100">No matching symbols</p>
                    <p className="mt-2 text-gray-500">Try a company name, ticker, or exchange like NASDAQ.</p>
                </div>
            )}
        </section>
    );
};

export default SearchPage;
