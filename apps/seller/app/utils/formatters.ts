/**
 * Financial, Date, and Metric Formatting Utilities for LarekMart Seller Dashboard
 */

export function formatCurrency(
  amount: number,
  currency = "USD",
  locale = "en-US",
): string {
  if (isNaN(amount)) return "$0.00";
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatCompactNumber(num: number): string {
  if (isNaN(num)) return "0";
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    compactDisplay: "short",
  }).format(num);
}

export function formatDate(
  dateStr: string | Date | null | undefined,
  includeTime = false,
): string {
  if (!dateStr) return "N/A";
  const date = typeof dateStr === "string" ? new Date(dateStr) : dateStr;
  if (isNaN(date.getTime())) return "N/A";

  const options: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "short",
    day: "numeric",
    ...(includeTime
      ? { hour: "2-digit", minute: "2-digit", hour12: true }
      : {}),
  };

  return new Intl.DateTimeFormat("en-US", options).format(date);
}

export function formatRelativeTime(
  dateStr: string | Date | null | undefined,
): string {
  if (!dateStr) return "";
  const date = typeof dateStr === "string" ? new Date(dateStr) : dateStr;
  if (isNaN(date.getTime())) return "";

  const now = Date.now();
  const diffSecs = Math.floor((now - date.getTime()) / 1000);

  if (diffSecs < 60) return "Just now";
  if (diffSecs < 3600) return `${Math.floor(diffSecs / 60)}m ago`;
  if (diffSecs < 86400) return `${Math.floor(diffSecs / 3600)}h ago`;
  if (diffSecs < 604800) return `${Math.floor(diffSecs / 86400)}d ago`;

  return formatDate(date);
}

export function formatPercentage(val: number, decimals = 1): string {
  if (isNaN(val)) return "0.0%";
  return `${val.toFixed(decimals)}%`;
}
