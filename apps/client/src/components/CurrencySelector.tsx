"use client";

import { useEffect, useState, useRef } from "react";
import {
  useCurrencyStore,
  SUPPORTED_CURRENCIES,
  type CurrencyConfig,
} from "@/stores/currencyStore";
import { ChevronDown, Check, Coins, RefreshCw } from "lucide-react";

export default function CurrencySelector() {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const {
    currentCurrency,
    setCurrency,
    loadRates,
    isLoadingRates,
    exchangeRates,
  } = useCurrencyStore();

  const currentConfig: CurrencyConfig =
    SUPPORTED_CURRENCIES[currentCurrency] || SUPPORTED_CURRENCIES.USD!;

  useEffect(() => {
    loadRates();
  }, [loadRates]);

  // Click outside listener
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 text-slate-300 hover:text-white px-2 py-1 rounded-md hover:bg-slate-800/60 transition text-xs font-medium cursor-pointer"
        aria-label="Select currency"
        aria-expanded={isOpen}
      >
        <span className="text-sm">{currentConfig.flag}</span>
        <span className="font-semibold">{currentConfig.code}</span>
        <span className="text-slate-400">({currentConfig.symbol.trim()})</span>
        <ChevronDown
          className={`w-3 h-3 text-slate-400 transition-transform duration-200 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-56 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl py-2 z-50 animate-in fade-in zoom-in-95 duration-150">
          <div className="px-3 py-1.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] font-semibold text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-1">
              <Coins className="w-3.5 h-3.5 text-indigo-500" />
              Regional Currency
            </span>
            {isLoadingRates && (
              <RefreshCw className="w-3 h-3 animate-spin text-slate-400" />
            )}
          </div>

          <div className="max-h-64 overflow-y-auto py-1">
            {Object.values(SUPPORTED_CURRENCIES).map((curr) => {
              const isSelected = curr.code === currentCurrency;
              const rate = exchangeRates[curr.code] ?? 1.0;

              return (
                <button
                  key={curr.code}
                  type="button"
                  onClick={() => {
                    setCurrency(curr.code);
                    setIsOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 flex items-center justify-between text-xs transition cursor-pointer ${
                    isSelected
                      ? "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 font-bold"
                      : "text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/60"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-base">{curr.flag}</span>
                    <div className="flex flex-col">
                      <span className="font-semibold leading-tight">
                        {curr.code}{" "}
                        <span className="text-slate-400 font-normal">
                          ({curr.symbol.trim()})
                        </span>
                      </span>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 leading-tight">
                        {curr.name}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {curr.code !== "USD" && (
                      <span className="text-[10px] text-slate-400 dark:text-slate-500">
                        {rate.toFixed(curr.decimals > 0 ? 2 : 0)}
                      </span>
                    )}
                    {isSelected && (
                      <Check className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="px-3 pt-2 pb-1 border-t border-slate-100 dark:border-slate-800 text-[10px] text-slate-400 dark:text-slate-500 flex items-center justify-between">
            <span>Powered by Pricing Service</span>
            <span className="text-emerald-500 font-medium">Live Rates</span>
          </div>
        </div>
      )}
    </div>
  );
}
