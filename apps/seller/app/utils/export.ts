/**
 * RFC 4180 compliant CSV & JSON export utilities for client-side reporting.
 */

export interface CsvColumn<T> {
  key: keyof T | string;
  label: string;
  formatter?: (value: unknown, row: T) => string | number;
}

/**
 * Format a single value according to RFC 4180 specification.
 */
export function formatCsvValue(val: unknown): string {
  if (val === null || val === undefined) {
    return "";
  }

  const str = String(val);
  // If string contains quotes, commas, or newlines, quote it and escape internal quotes
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Converts an array of objects to an RFC 4180 formatted CSV string.
 */
export function convertToCsv<T extends Record<string, unknown>>(
  columns: CsvColumn<T>[],
  rows: T[],
): string {
  const headerLine = columns.map((c) => formatCsvValue(c.label)).join(",");
  const dataLines = rows.map((row) => {
    return columns
      .map((col) => {
        const rawValue = row[col.key as string];
        const formatted = col.formatter ? col.formatter(rawValue, row) : rawValue;
        return formatCsvValue(formatted);
      })
      .join(",");
  });

  return [headerLine, ...dataLines].join("\r\n");
}

/**
 * Triggers a browser download of the given content.
 */
export function triggerFileDownload(
  content: string,
  filename: string,
  mimeType: string,
): void {
  if (typeof window === "undefined" || !window.document) {
    return;
  }

  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(url), 100);
}

/**
 * Export tabular data as an RFC 4180 compliant CSV file with UTF-8 BOM.
 */
export function exportToCsv<T extends Record<string, unknown>>(
  filename: string,
  columns: CsvColumn<T>[],
  rows: T[],
): void {
  const csvBody = convertToCsv(columns, rows);
  // Add UTF-8 BOM so Excel opens special characters correctly
  const bom = "\uFEFF";
  triggerFileDownload(bom + csvBody, filename.endsWith(".csv") ? filename : `${filename}.csv`, "text/csv;charset=utf-8;");
}

/**
 * Export arbitrary data as a formatted JSON file.
 */
export function exportToJson(filename: string, data: unknown): void {
  const jsonString = JSON.stringify(data, null, 2);
  triggerFileDownload(
    jsonString,
    filename.endsWith(".json") ? filename : `${filename}.json`,
    "application/json;charset=utf-8;",
  );
}
