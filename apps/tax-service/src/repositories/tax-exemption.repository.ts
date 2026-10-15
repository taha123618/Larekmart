import { eq, and, or, lte, gte, isNull } from "drizzle-orm";
import { getDb } from "../db/connection.js";
import {
  taxExemptions,
  type TaxExemption,
  type NewTaxExemption,
} from "../db/schema.js";

export class TaxExemptionRepository {
  public async findActiveExemption(
    customerId?: string,
    certificate?: string,
    jurisdictionId?: string,
    targetDate: Date = new Date(),
  ): Promise<TaxExemption | undefined> {
    if (!customerId && !certificate) {
      return undefined;
    }

    const db = getDb();
    const identifierConditions = [];
    if (customerId) {
      identifierConditions.push(eq(taxExemptions.customerId, customerId));
    }
    if (certificate) {
      identifierConditions.push(
        eq(taxExemptions.exemptionCertificate, certificate),
      );
    }

    const rows = await db
      .select()
      .from(taxExemptions)
      .where(
        and(
          eq(taxExemptions.isActive, true),
          or(...identifierConditions),
          lte(taxExemptions.validFrom, targetDate),
          or(
            isNull(taxExemptions.validTo),
            gte(taxExemptions.validTo, targetDate),
          ),
        ),
      );

    if (rows.length === 0) {
      return undefined;
    }

    // If jurisdiction is specified, match jurisdiction or nationwide (null jurisdictionId)
    if (jurisdictionId) {
      const match = rows.find(
        (r) => r.jurisdictionId === jurisdictionId || r.jurisdictionId === null,
      );
      return match || rows[0];
    }

    return rows[0];
  }

  public async findAll(): Promise<TaxExemption[]> {
    try {
      const db = getDb();
      return await db.select().from(taxExemptions);
    } catch {
      return Array.from(this.inMemoryExemptions.values());
    }
  }

  private inMemoryExemptions: Map<string, TaxExemption> = new Map([
    [
      "ex_gov_01",
      {
        id: "ex_gov_01",
        customerId: "cust_gov_state",
        exemptionCertificate: "CERT-GOV-9999",
        exemptionType: "government",
        jurisdictionId: null,
        validFrom: new Date("2026-01-01"),
        validTo: new Date("2030-01-01"),
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ],
  ]);

  public async create(data: NewTaxExemption): Promise<TaxExemption> {
    const record: TaxExemption = {
      id: data.id,
      customerId: data.customerId ?? null,
      exemptionCertificate: data.exemptionCertificate,
      exemptionType: data.exemptionType,
      jurisdictionId: data.jurisdictionId ?? null,
      validFrom: data.validFrom,
      validTo: data.validTo ?? null,
      isActive: data.isActive ?? true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    try {
      const db = getDb();
      await db.insert(taxExemptions).values(record);
      const rows = await db
        .select()
        .from(taxExemptions)
        .where(eq(taxExemptions.id, data.id))
        .limit(1);
      if (rows[0]) return rows[0];
    } catch {
      // In-memory fallback
    }

    this.inMemoryExemptions.set(record.id, record);
    return record;
  }
}

export const taxExemptionRepository = new TaxExemptionRepository();
