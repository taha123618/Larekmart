/**
 * RFC 4180 Compliant CSV Parser with Schema Validation & Error Tracking.
 */

export interface ParseResult<T> {
  data: T[];
  errors: Array<{ row: number; field: string; message: string; rawValue?: string }>;
  totalRows: number;
  validRows: number;
}

export interface ValidationRule<T> {
  field: keyof T | string;
  required?: boolean;
  validate?: (value: string, row: Record<string, string>) => string | null; // returns error message or null if valid
  transform?: (value: string) => unknown;
}

/**
 * Parses raw RFC 4180 CSV text into an array of string arrays (rows of cells).
 */
export function parseCsvText(text: string): string[][] {
  const cleanText = text.replace(/^\uFEFF/, "").trim(); // strip UTF-8 BOM
  if (!cleanText) return [];

  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = "";
  let inQuotes = false;

  for (let i = 0; i < cleanText.length; i++) {
    const char = cleanText[i];
    const nextChar = cleanText[i + 1];

    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        currentCell += '"';
        i++; // skip escaped quote
      } else if (char === '"') {
        inQuotes = false;
      } else {
        currentCell += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ",") {
        currentRow.push(currentCell.trim());
        currentCell = "";
      } else if (char === "\r" || char === "\n") {
        if (char === "\r" && nextChar === "\n") {
          i++; // skip \n of \r\n
        }
        currentRow.push(currentCell.trim());
        if (currentRow.some((c) => c.length > 0)) {
          rows.push(currentRow);
        }
        currentRow = [];
        currentCell = "";
      } else {
        currentCell += char;
      }
    }
  }

  // Push final cell and row
  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(currentCell.trim());
    if (currentRow.some((c) => c.length > 0)) {
      rows.push(currentRow);
    }
  }

  return rows;
}

/**
 * Parses CSV text against schema validation rules and outputs typed data & granular row errors.
 */
export function parseAndValidateCsv<T extends Record<string, unknown>>(
  csvText: string,
  rules: ValidationRule<T>[],
): ParseResult<T> {
  const rows = parseCsvText(csvText);
  const firstRow = rows[0];
  if (!firstRow || rows.length < 2) {
    return { data: [], errors: [{ row: 1, field: "header", message: "CSV file must contain a header and at least one data row" }], totalRows: 0, validRows: 0 };
  }

  const headerRow = firstRow.map((h) => h.toLowerCase().trim());
  const headerMap: Record<string, number> = {};
  headerRow.forEach((name, index) => {
    headerMap[name] = index;
  });

  const errors: ParseResult<T>["errors"] = [];
  const validData: T[] = [];

  // Check required headers
  for (const rule of rules) {
    const fieldKey = String(rule.field).toLowerCase();
    if (rule.required && headerMap[fieldKey] === undefined) {
      errors.push({
        row: 1,
        field: String(rule.field),
        message: `Missing required column header: "${String(rule.field)}"`,
      });
    }
  }

  if (errors.length > 0) {
    return { data: [], errors, totalRows: rows.length - 1, validRows: 0 };
  }

  for (let r = 1; r < rows.length; r++) {
    const rowCells = rows[r];
    if (!rowCells) continue;

    const rowObj: Record<string, unknown> = {};
    const rawObj: Record<string, string> = {};
    let rowHasError = false;

    // Collect raw values
    for (const rule of rules) {
      const fieldKey = String(rule.field).toLowerCase();
      const colIdx = headerMap[fieldKey];
      const val = colIdx !== undefined && colIdx < rowCells.length ? (rowCells[colIdx] ?? "") : "";
      rawObj[String(rule.field)] = val;
    }

    // Validate rules
    for (const rule of rules) {
      const val = rawObj[String(rule.field)] ?? "";

      if (rule.required && (!val || val.trim().length === 0)) {
        errors.push({
          row: r + 1,
          field: String(rule.field),
          message: `Field "${String(rule.field)}" is required and cannot be empty.`,
          rawValue: val,
        });
        rowHasError = true;
        continue;
      }

      if (rule.validate && val.length > 0) {
        const errorMsg = rule.validate(val, rawObj);
        if (errorMsg) {
          errors.push({
            row: r + 1,
            field: String(rule.field),
            message: errorMsg,
            rawValue: val,
          });
          rowHasError = true;
          continue;
        }
      }

      // Transform value if valid
      if (rule.transform) {
        try {
          rowObj[String(rule.field)] = rule.transform(val);
        } catch (tErr: unknown) {
          const errMsg = tErr instanceof Error ? tErr.message : "transformation failed";
          errors.push({
            row: r + 1,
            field: String(rule.field),
            message: `Invalid format: ${errMsg}`,
            rawValue: val,
          });
          rowHasError = true;
        }
      } else {
        rowObj[String(rule.field)] = val;
      }
    }

    if (!rowHasError) {
      validData.push(rowObj as T);
    }
  }

  return {
    data: validData,
    errors,
    totalRows: rows.length - 1,
    validRows: validData.length,
  };
}
