"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import type { SearchFacets } from "@repo/types";

const PRICE_KEYS = ["min_price", "max_price"] as const;
const MULTI_KEYS = ["color", "size"] as const;

/**
 * Parses a comma-separated multi-select URL param into its values.
 *
 * Color and size are multi-select (OR within the facet), so the `color`/`size`
 * params carry the selected values comma-separated; the search API accepts the
 * same comma-separated form.
 */
const parseList = (value: string | null): string[] =>
  value
    ? value
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean)
    : [];

/**
 * Sort + facet filters for the products page.
 *
 * Color/size/price options come from the OpenSearch aggregations returned with
 * the current result set (`facets`); selections are pushed into the URL and
 * forwarded to `GET /products/search` by `ProductList`. Colour and size are
 * multi-select — each selected value is OR'd within its facet.
 */
const Filter = ({ facets }: { facets?: SearchFacets }) => {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const activeColors = parseList(searchParams.get("color"));
  const activeSizes = parseList(searchParams.get("size"));
  const activeMinPrice = searchParams.get("min_price") ?? "";
  const activeMaxPrice = searchParams.get("max_price") ?? "";

  const [minPriceInput, setMinPriceInput] = useState(activeMinPrice);
  const [maxPriceInput, setMaxPriceInput] = useState(activeMaxPrice);

  // Keep the price inputs in sync when the URL changes (e.g. "Clear filters").
  useEffect(() => {
    setMinPriceInput(activeMinPrice);
    setMaxPriceInput(activeMaxPrice);
  }, [activeMinPrice, activeMaxPrice]);

  const pushParams = (params: URLSearchParams) => {
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const setParam = (key: string, value: string | null) => {
    const params = new URLSearchParams(searchParams);
    if (value) params.set(key, value);
    else params.delete(key);
    pushParams(params);
  };

  const toggleFacet = (key: "color" | "size", value: string) => {
    const current = parseList(searchParams.get(key));
    const next = current.includes(value)
      ? current.filter((entry) => entry !== value)
      : [...current, value];

    // Sorted so the same selection always produces the same canonical URL.
    setParam(key, next.length > 0 ? [...next].sort().join(",") : null);
  };

  const applyPrice = (key: "min_price" | "max_price", raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) {
      setParam(key, null);
      return;
    }

    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed) || parsed < 0) {
      setMinPriceInput(activeMinPrice);
      setMaxPriceInput(activeMaxPrice);
      return;
    }
    setParam(key, String(Math.round(parsed)));
  };

  const clearFilters = () => {
    const params = new URLSearchParams(searchParams);
    for (const key of [...MULTI_KEYS, ...PRICE_KEYS]) params.delete(key);
    pushParams(params);
  };

  const colors = facets?.colors ?? [];
  const sizes = facets?.sizes ?? [];
  const priceStats = facets?.price_stats;
  const hasActiveFilters = Boolean(
    activeColors.length > 0 ||
      activeSizes.length > 0 ||
      activeMinPrice ||
      activeMaxPrice,
  );

  return (
    <div className="my-6 flex flex-col gap-4 rounded-3xl bg-white/95 dark:bg-slate-900/70 dark:backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 p-5 sm:p-6 text-sm text-slate-700 dark:text-slate-300 shadow-xs dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)]">
      {/* SORT */}
      <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Sort by:
          </span>
          <select
            name="sort"
            id="sort"
            value={searchParams.get("sort") ?? "newest"}
            className="border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 shadow-xs px-3 py-1.5 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 outline-hidden hover:border-slate-300 dark:hover:border-slate-600 transition"
            onChange={(event) => setParam("sort", event.target.value)}
          >
            <option value="newest">Newest Arrivals</option>
            <option value="oldest">Oldest</option>
            <option value="asc">Price: Low to High</option>
            <option value="desc">Price: High to Low</option>
          </select>
        </div>
        {hasActiveFilters && (
          <button
            type="button"
            onClick={clearFilters}
            className="text-xs font-bold text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 transition px-2.5 py-1 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
          >
            Clear all filters
          </button>
        )}
      </div>

      {/* COLOR FACETS */}
      {colors.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Color:
          </span>
          {colors.map(({ key, doc_count }) => {
            const value = String(key);
            const isActive = activeColors.includes(value);
            return (
              <button
                key={value}
                type="button"
                aria-pressed={isActive}
                title={`${value} (${doc_count})`}
                onClick={() => toggleFacet("color", value)}
                className={`flex items-center gap-1.5 rounded-full border px-2 py-1 capitalize transition-colors cursor-pointer ${
                  isActive
                    ? "border-indigo-600 dark:border-indigo-500 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-900 dark:text-indigo-200 font-bold shadow-xs"
                    : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 bg-slate-50/50 dark:bg-slate-800/50 hover:bg-white dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
                }`}
              >
                <span
                  className="h-3 w-3 rounded-full border border-slate-300 dark:border-slate-600 shrink-0"
                  style={{ backgroundColor: value }}
                />
                <span className="capitalize">{value}</span>
                <span className="text-[10px] text-slate-400 dark:text-slate-500 font-normal">
                  ({doc_count})
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* SIZE FACETS */}
      {sizes.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Size:
          </span>
          {sizes.map(({ key, doc_count }) => {
            const value = String(key);
            const isActive = activeSizes.includes(value);
            return (
              <button
                key={value}
                type="button"
                aria-pressed={isActive}
                onClick={() => toggleFacet("size", value)}
                className={`rounded-xl border px-3 py-1 uppercase text-xs transition cursor-pointer ${
                  isActive
                    ? "border-indigo-600 dark:border-indigo-500 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-900 dark:text-indigo-200 font-bold shadow-xs"
                    : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 bg-slate-50/50 dark:bg-slate-800/50 hover:bg-white dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
                }`}
              >
                <span>{value}</span>
                <span className="ml-1 text-[10px] text-slate-400 dark:text-slate-500 font-normal">
                  ({doc_count})
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* PRICE FACET */}
      {priceStats && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Price:
          </span>
          <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 px-2 py-1 rounded-xl border border-slate-200 dark:border-slate-700">
            <span className="text-xs text-slate-400 dark:text-slate-500">
              $
            </span>
            <input
              inputMode="numeric"
              aria-label="Minimum price"
              value={minPriceInput}
              placeholder={`Min ${priceStats.min}`}
              onChange={(event) => setMinPriceInput(event.target.value)}
              onBlur={() => applyPrice("min_price", minPriceInput)}
              onKeyDown={(event) => {
                if (event.key === "Enter")
                  applyPrice("min_price", minPriceInput);
              }}
              className="w-16 bg-transparent text-xs font-semibold text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-hidden"
            />
            <span className="text-slate-300 dark:text-slate-600">–</span>
            <span className="text-xs text-slate-400 dark:text-slate-500">
              $
            </span>
            <input
              inputMode="numeric"
              aria-label="Maximum price"
              value={maxPriceInput}
              placeholder={`Max ${priceStats.max}`}
              onChange={(event) => setMaxPriceInput(event.target.value)}
              onBlur={() => applyPrice("max_price", maxPriceInput)}
              onKeyDown={(event) => {
                if (event.key === "Enter")
                  applyPrice("max_price", maxPriceInput);
              }}
              className="w-16 bg-transparent text-xs font-semibold text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-hidden"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default Filter;
