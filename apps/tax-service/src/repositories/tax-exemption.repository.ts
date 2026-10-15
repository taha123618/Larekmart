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

  public async create(data: NewTaxExemption): Promise<TaxExemption> {
    const db = getDb();
    await db.insert(taxExemptions).values(data);
    const rows = await db
      .select()
      .from(taxExemptions)
      .where(eq(taxExemptions.id, data.id))
      .limit(1);
    if (!rows[0]) {
      throw new Error("Failed to retrieve created tax exemption");
    }
    return rows[0];
  }
}

export const taxExemptionRepository = new TaxExemptionRepository();
