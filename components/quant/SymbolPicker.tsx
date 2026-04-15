"use client";

import { Check, ChevronDown } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { POPULAR_STOCKS } from "@/lib/constants";
import { normalizeSymbol } from "@/lib/validation";

type SymbolPickerProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
};

type StockOption = (typeof POPULAR_STOCKS)[number];

const SymbolPicker = ({ label, value, onChange, placeholder = "Search symbol or company" }: SymbolPickerProps) => {
  const [open, setOpen] = useState(false);

  const selectedStock = useMemo(
    () => POPULAR_STOCKS.find((stock) => stock.symbol === normalizeSymbol(value)) ?? null,
    [value],
  );

  const groupedStocks = useMemo(() => {
    const groups = new Map<string, StockOption[]>();

    POPULAR_STOCKS.forEach((stock) => {
      const current = groups.get(stock.exchange) ?? [];
      groups.set(stock.exchange, [...current, stock]);
    });

    return [...groups.entries()];
  }, []);

  const displaySymbol = selectedStock?.symbol || value || "Select symbol";

  return (
    <label className="space-y-2">
      <span className="form-label">{label}</span>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className="form-input h-12 w-full justify-between border-gray-600 bg-gray-800 text-left text-white hover:bg-gray-800 hover:text-white"
          >
            <div className="min-w-0">
              <p className="truncate text-base font-medium text-gray-100">{displaySymbol}</p>
              <p className="truncate text-xs text-gray-500">{selectedStock ? `${selectedStock.company} · ${selectedStock.exchange}` : placeholder}</p>
            </div>
            <ChevronDown className="h-4 w-4 shrink-0 text-gray-500" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] border-gray-700 bg-gray-800 p-0">
          <Command className="bg-gray-800">
            <div className="border-b border-gray-700">
              <CommandInput
                placeholder={placeholder}
                className="text-white placeholder:text-gray-500"
              />
            </div>
            <CommandList className="max-h-72 bg-gray-800">
              <CommandEmpty className="py-6 text-center text-sm text-gray-500">No valid symbols found.</CommandEmpty>
              {groupedStocks.map(([exchange, stocks]) => (
                <CommandGroup key={exchange} heading={exchange} className="text-gray-400">
                  {stocks.map((stock) => (
                    <CommandItem
                      key={stock.symbol}
                      value={`${stock.symbol} ${stock.company} ${stock.exchange}`}
                      onSelect={() => {
                        onChange(stock.symbol);
                        setOpen(false);
                      }}
                      className="cursor-pointer rounded-none px-3 py-3 text-gray-200 data-[selected=true]:bg-gray-700 data-[selected=true]:text-white"
                    >
                      <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-medium text-white">{stock.symbol}</p>
                          <p className="truncate text-xs text-gray-500">{stock.company}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs uppercase tracking-wide text-gray-500">{stock.exchange}</span>
                          <Check className={`h-4 w-4 ${value === stock.symbol ? "text-teal-400" : "text-transparent"}`} />
                        </div>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              ))}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </label>
  );
};

export default SymbolPicker;
