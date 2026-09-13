"use client";

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
const ActiveFilters = () => {
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
    <div className="mb-6 flex flex-wrap items-center gap-2 text-sm text-gray-600">
      <span className="text-gray-500">Filters:</span>
      {filters.map((filter) => (
        <button
          key={filter.id}
          type="button"
          onClick={filter.remove}
          aria-label={`Remove ${filter.ariaLabel} filter`}
          className="flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-2 py-1 transition-colors hover:border-gray-400"
        >
          {filter.swatch && (
            <span
              className="h-3 w-3 rounded-full border border-gray-300"
              style={{ backgroundColor: filter.swatch }}
            />
          )}
          {filter.label}
          <X className="h-3 w-3 text-gray-400" />
        </button>
      ))}
    </div>
  );
};

export default ActiveFilters;
