import { eq } from "drizzle-orm";
import { getDb } from "../db/connection.js";
import {
  taxCalculations,
  taxCalculationLines,
  type TaxCalculationRecord,
  type NewTaxCalculationRecord,
  type NewTaxCalculationLineRecord,
} from "../db/schema.js";
import type {
  TaxCalculationResponse,
  TaxCalculationLineOutput,
} from "@repo/types";

export class TaxCalculationRepository {
  private inMemoryCalculations: Map<
    string,
    { calc: NewTaxCalculationRecord; lines: NewTaxCalculationLineRecord[] }
  > = new Map();

  public async saveCalculation(
    calculation: NewTaxCalculationRecord,
    lines: NewTaxCalculationLineRecord[],
  ): Promise<void> {
    try {
      const db = getDb();
      await db.insert(taxCalculations).values(calculation);
      if (lines.length > 0) {
        await db.insert(taxCalculationLines).values(lines);
      }
    } catch {
      // In-memory fallback
      this.inMemoryCalculations.set(calculation.id, {
        calc: calculation,
        lines,
      });
    }
  }

  public async findById(
    id: string,
  ): Promise<TaxCalculationResponse | undefined> {
    try {
      const db = getDb();
      const calcRows = await db
        .select()
        .from(taxCalculations)
        .where(eq(taxCalculations.id, id))
        .limit(1);

      if (calcRows.length === 0 || !calcRows[0]) {
        return this.findInMemoryById(id);
      }
      const calc = calcRows[0];

      const lineRows = await db
        .select()
        .from(taxCalculationLines)
        .where(eq(taxCalculationLines.calculationId, id));

      const lines: TaxCalculationLineOutput[] = lineRows.map((line) => {
        let parsedBreakdown = [];
        if (line.breakdown) {
          try {
            parsedBreakdown = JSON.parse(line.breakdown);
          } catch {
            parsedBreakdown = [];
          }
        }

        return {
          lineId: line.lineId,
          taxableAmount: line.taxableAmount,
          taxAmount: line.taxAmount,
          rate: line.rate,
          jurisdictionCode: line.jurisdictionCode,
          isInclusive: line.isInclusive,
          breakdown: parsedBreakdown,
        };
      });

      return {
        calculationId: calc.id,
        referenceId: calc.referenceId ?? undefined,
        referenceType:
          (calc.referenceType as "quote" | "order" | "invoice" | "return") ||
          "quote",
        currency: calc.currency,
        subtotal: calc.subtotal,
        taxTotal: calc.taxTotal,
        total: calc.total,
        lines,
        ruleVersion: calc.ruleVersion,
        provider: calc.provider,
        isExempt: false,
        calculatedAt: calc.createdAt.toISOString(),
      };
    } catch {
      return this.findInMemoryById(id);
    }
  }

  private findInMemoryById(id: string): TaxCalculationResponse | undefined {
    const entry = this.inMemoryCalculations.get(id);
    if (!entry) return undefined;
    const { calc, lines } = entry;

    return {
      calculationId: calc.id,
      referenceId: calc.referenceId ?? undefined,
      referenceType:
        (calc.referenceType as "quote" | "order" | "invoice" | "return") ||
        "quote",
      currency: calc.currency ?? "USD",
      subtotal: calc.subtotal,
      taxTotal: calc.taxTotal,
      total: calc.total,
      lines: lines.map((l) => ({
        lineId: l.lineId,
        taxableAmount: l.taxableAmount,
        taxAmount: l.taxAmount,
        rate: l.rate,
        jurisdictionCode: l.jurisdictionCode,
        isInclusive: l.isInclusive ?? false,
        breakdown: l.breakdown ? JSON.parse(l.breakdown) : [],
      })),
      ruleVersion: calc.ruleVersion,
      provider: calc.provider ?? "standard",
      isExempt: false,
      calculatedAt: (calc.createdAt ?? new Date()).toISOString(),
    };
  }

  public async findByReferenceId(
    referenceId: string,
  ): Promise<TaxCalculationRecord | undefined> {
    try {
      const db = getDb();
      const rows = await db
        .select()
        .from(taxCalculations)
        .where(eq(taxCalculations.referenceId, referenceId))
        .limit(1);
      return rows[0];
    } catch {
      for (const entry of this.inMemoryCalculations.values()) {
        if (entry.calc.referenceId === referenceId) {
          return {
            id: entry.calc.id,
            referenceType: entry.calc.referenceType ?? "quote",
            referenceId: entry.calc.referenceId ?? null,
            currency: entry.calc.currency ?? "USD",
            subtotal: entry.calc.subtotal,
            taxTotal: entry.calc.taxTotal,
            total: entry.calc.total,
            ruleVersion: entry.calc.ruleVersion,
            provider: entry.calc.provider ?? "standard",
            inputSnapshot: entry.calc.inputSnapshot,
            createdAt: entry.calc.createdAt ?? new Date(),
          };
        }
      }
      return undefined;
    }
  }

  public async findAll(limit = 50): Promise<TaxCalculationRecord[]> {
    try {
      const db = getDb();
      return await db.select().from(taxCalculations).limit(limit);
    } catch {
      return Array.from(this.inMemoryCalculations.values()).map((e) => ({
        id: e.calc.id,
        referenceType: e.calc.referenceType ?? "quote",
        referenceId: e.calc.referenceId ?? null,
        currency: e.calc.currency ?? "USD",
        subtotal: e.calc.subtotal,
        taxTotal: e.calc.taxTotal,
        total: e.calc.total,
        ruleVersion: e.calc.ruleVersion,
        provider: e.calc.provider ?? "standard",
        inputSnapshot: e.calc.inputSnapshot,
        createdAt: e.calc.createdAt ?? new Date(),
      }));
    }
  }
}

export const taxCalculationRepository = new TaxCalculationRepository();
