import { eq, and } from "drizzle-orm";
import { getDb } from "../db/connection.js";
import {
  taxJurisdictions,
  type TaxJurisdiction,
  type NewTaxJurisdiction,
} from "../db/schema.js";

const DEFAULT_JURISDICTIONS: TaxJurisdiction[] = [
  {
    id: "jur_us_fed",
    countryCode: "US",
    regionCode: null,
    municipality: null,
    jurisdictionCode: "US",
    name: "United States Federal",
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: "jur_us_ca",
    countryCode: "US",
    regionCode: "CA",
    municipality: null,
    jurisdictionCode: "US-CA",
    name: "California State",
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: "jur_us_ca_la",
    countryCode: "US",
    regionCode: "CA",
    municipality: "Los Angeles",
    jurisdictionCode: "US-CA-LA",
    name: "Los Angeles County / City",
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: "jur_us_ny",
    countryCode: "US",
    regionCode: "NY",
    municipality: null,
    jurisdictionCode: "US-NY",
    name: "New York State",
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: "jur_gb",
    countryCode: "GB",
    regionCode: null,
    municipality: null,
    jurisdictionCode: "GB",
    name: "United Kingdom HMRC",
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

export class JurisdictionRepository {
  private inMemoryJurisdictions: Map<string, TaxJurisdiction> = new Map(
    DEFAULT_JURISDICTIONS.map((j) => [j.id, j]),
  );

  public async findAll(filter?: {
    countryCode?: string;
    regionCode?: string;
    isActive?: boolean;
  }): Promise<TaxJurisdiction[]> {
    try {
      const db = getDb();
      const conditions = [];

      if (filter?.countryCode) {
        conditions.push(
          eq(taxJurisdictions.countryCode, filter.countryCode.toUpperCase()),
        );
      }
      if (filter?.regionCode) {
        conditions.push(
          eq(taxJurisdictions.regionCode, filter.regionCode.toUpperCase()),
        );
      }
      if (filter?.isActive !== undefined) {
        conditions.push(eq(taxJurisdictions.isActive, filter.isActive));
      }

      if (conditions.length > 0) {
        return await db
          .select()
          .from(taxJurisdictions)
          .where(and(...conditions));
      }

      return await db.select().from(taxJurisdictions);
    } catch {
      let results = Array.from(this.inMemoryJurisdictions.values());
      if (filter?.countryCode) {
        results = results.filter(
          (j) => j.countryCode === filter.countryCode?.toUpperCase(),
        );
      }
      if (filter?.regionCode) {
        results = results.filter(
          (j) => j.regionCode === filter.regionCode?.toUpperCase(),
        );
      }
      if (filter?.isActive !== undefined) {
        results = results.filter((j) => j.isActive === filter.isActive);
      }
      return results;
    }
  }

  public async findById(id: string): Promise<TaxJurisdiction | undefined> {
    try {
      const db = getDb();
      const rows = await db
        .select()
        .from(taxJurisdictions)
        .where(eq(taxJurisdictions.id, id))
        .limit(1);
      return rows[0];
    } catch {
      return this.inMemoryJurisdictions.get(id);
    }
  }

  public async findByCode(code: string): Promise<TaxJurisdiction | undefined> {
    try {
      const db = getDb();
      const rows = await db
        .select()
        .from(taxJurisdictions)
        .where(eq(taxJurisdictions.jurisdictionCode, code))
        .limit(1);
      return rows[0];
    } catch {
      return Array.from(this.inMemoryJurisdictions.values()).find(
        (j) => j.jurisdictionCode === code,
      );
    }
  }

  public async create(data: NewTaxJurisdiction): Promise<TaxJurisdiction> {
    const record: TaxJurisdiction = {
      id: data.id,
      countryCode: data.countryCode,
      regionCode: data.regionCode ?? null,
      municipality: data.municipality ?? null,
      jurisdictionCode: data.jurisdictionCode,
      name: data.name,
      isActive: data.isActive ?? true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    try {
      const db = getDb();
      await db.insert(taxJurisdictions).values(data);
      const created = await this.findById(data.id);
      if (created) return created;
    } catch {
      // Fallback
    }

    this.inMemoryJurisdictions.set(record.id, record);
    return record;
  }

  public async findMatchingJurisdictions(
    country: string,
    region?: string,
    municipality?: string,
  ): Promise<TaxJurisdiction[]> {
    let all: TaxJurisdiction[] = [];

    try {
      const db = getDb();
      all = await db
        .select()
        .from(taxJurisdictions)
        .where(
          and(
            eq(taxJurisdictions.countryCode, country.toUpperCase()),
            eq(taxJurisdictions.isActive, true),
          ),
        );
    } catch {
      all = Array.from(this.inMemoryJurisdictions.values()).filter(
        (j) => j.countryCode === country.toUpperCase() && j.isActive,
      );
    }

    return all.filter((j) => {
      if (!j.regionCode && !j.municipality) return true;
      if (
        region &&
        j.regionCode &&
        j.regionCode.toUpperCase() === region.toUpperCase() &&
        !j.municipality
      ) {
        return true;
      }
      if (
        region &&
        municipality &&
        j.regionCode &&
        j.municipality &&
        j.regionCode.toUpperCase() === region.toUpperCase() &&
        j.municipality.toLowerCase() === municipality.toLowerCase()
      ) {
        return true;
      }
      return false;
    });
  }
}

export const jurisdictionRepository = new JurisdictionRepository();
