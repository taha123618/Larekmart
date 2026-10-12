"use client";

import type React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { X } from "lucide-react";

/**
 * Parses a comma-separated multi-select URL param into its values.
 *
 * Mirrors `Filter`: color and size are multi-select, so their params carry the
 * selected values comma-separated.
 */
const parseList = (value: string | null): string[] =>
  value
    ? value
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean)
    : [];

/** One removable pill in the active-filter row. */
type ActiveFilter = {
  id: string;
  label: string;
  /** Hex/name swatch shown before the label (colors only). */
  swatch?: string;
  /** "Remove <this> filter" text for screen readers. */
  ariaLabel: string;
  remove: () => void;
};

const colorLabel = (value: string) =>
  value.charAt(0).toUpperCase() + value.slice(1);

/**
 * Removable pills for every active color, size, and price filter, shown above
 * the product grid so the current selection is visible without scrolling back
 * into the filter panel. Each pill removes only its own value; bulk clearing
 * stays with the filter panel.
 */
const ActiveFilters = (): React.JSX.Element | null => {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const pushParams = (params: URLSearchParams) => {
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  /** Drops one value from a multi-select param, deleting it when empty. */
  const removeValue = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams);
    const next = parseList(params.get(key)).filter((entry) => entry !== value);

    if (next.length > 0) params.set(key, next.join(","));
    else params.delete(key);

    pushParams(params);
  };

  const removeParam = (key: string) => {
    const params = new URLSearchParams(searchParams);
    params.delete(key);
    pushParams(params);
  };

  const minPrice = searchParams.get("min_price");
  const maxPrice = searchParams.get("max_price");

  const filters: ActiveFilter[] = [
    ...parseList(searchParams.get("color")).map((value) => ({
      id: `color-${value}`,
      label: colorLabel(value),
      swatch: value,
      ariaLabel: value,
      remove: () => removeValue("color", value),
    })),
    ...parseList(searchParams.get("size")).map((value) => ({
      id: `size-${value}`,
      label: value.toUpperCase(),
      ariaLabel: value,
      remove: () => removeValue("size", value),
    })),
    ...(minPrice
      ? [
          {
            id: "min_price",
            label: `Min $${minPrice}`,
            ariaLabel: "minimum price",
            remove: () => removeParam("min_price"),
          },
        ]
      : []),
    ...(maxPrice
      ? [
          {
            id: "max_price",
            label: `Max $${maxPrice}`,
            ariaLabel: "maximum price",
            remove: () => removeParam("max_price"),
          },
        ]
      : []),
  ];

  if (filters.length === 0) return null;

  return (
    <div className="mb-6 flex flex-wrap items-center gap-2 text-xs">
      <span className="font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[11px]">
        Active Filters:
      </span>
      {filters.map((filter) => (
        <button
          key={filter.id}
          type="button"
          onClick={filter.remove}
          aria-label={`Remove ${filter.ariaLabel} filter`}
          className="flex items-center gap-1.5 rounded-xl border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/70 dark:bg-indigo-950/60 text-indigo-900 dark:text-indigo-200 font-semibold px-2.5 py-1 transition hover:bg-rose-50 dark:hover:bg-rose-950/50 hover:border-rose-200 dark:hover:border-rose-900 hover:text-rose-700 dark:hover:text-rose-300 shadow-xs cursor-pointer group"
        >
          {filter.swatch && (
            <span
              className="h-2.5 w-2.5 rounded-full border border-slate-300 dark:border-slate-600 shrink-0"
              style={{ backgroundColor: filter.swatch }}
            />
          )}
          <span>{filter.label}</span>
          <X className="h-3 w-3 text-indigo-400 dark:text-indigo-300 group-hover:text-rose-600 dark:group-hover:text-rose-400 transition" />
        </button>
      ))}
    </div>
  );
};

export default ActiveFilters;
