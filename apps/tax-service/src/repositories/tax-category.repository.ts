import { eq } from "drizzle-orm";
import { getDb } from "../db/connection.js";
import {
  taxCategories,
  type TaxCategory,
  type NewTaxCategory,
} from "../db/schema.js";

const DEFAULT_CATEGORIES: TaxCategory[] = [
  {
    id: "cat_standard",
    code: "standard",
    name: "Standard Merchandise",
    description: "General taxable retail items",
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: "cat_clothing",
    code: "clothing",
    name: "Apparel & Clothing",
    description: "Clothing and footwear",
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: "cat_groceries",
    code: "groceries",
    name: "Food & Groceries",
    description: "Essential food and non-prepared groceries",
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: "cat_digital",
    code: "digital_goods",
    name: "Digital Products",
    description: "Software downloads and digital media",
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: "cat_exempt",
    code: "exempt",
    name: "Exempt Merchandise",
    description: "Legally non-taxable products",
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

export class TaxCategoryRepository {
  private inMemoryCategories: Map<string, TaxCategory> = new Map(
    DEFAULT_CATEGORIES.map((c) => [c.code, c]),
  );

  public async findAll(activeOnly = true): Promise<TaxCategory[]> {
    try {
      const db = getDb();
      if (activeOnly) {
        return await db
          .select()
          .from(taxCategories)
          .where(eq(taxCategories.isActive, true));
      }
      return await db.select().from(taxCategories);
    } catch {
      let results = Array.from(this.inMemoryCategories.values());
      if (activeOnly) {
        results = results.filter((c) => c.isActive);
      }
      return results;
    }
  }

  public async findById(id: string): Promise<TaxCategory | undefined> {
    try {
      const db = getDb();
      const rows = await db
        .select()
        .from(taxCategories)
        .where(eq(taxCategories.id, id))
        .limit(1);
      return rows[0];
    } catch {
      return Array.from(this.inMemoryCategories.values()).find(
        (c) => c.id === id,
      );
    }
  }

  public async findByCode(code: string): Promise<TaxCategory | undefined> {
    const normalized = code.toLowerCase();
    try {
      const db = getDb();
      const rows = await db
        .select()
        .from(taxCategories)
        .where(eq(taxCategories.code, normalized))
        .limit(1);
      return rows[0];
    } catch {
      return this.inMemoryCategories.get(normalized);
    }
  }

  public async create(data: NewTaxCategory): Promise<TaxCategory> {
    const record: TaxCategory = {
      id: data.id,
      code: data.code.toLowerCase(),
      name: data.name,
      description: data.description ?? null,
      isActive: data.isActive ?? true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    try {
      const db = getDb();
      await db.insert(taxCategories).values(record);
      const created = await this.findById(data.id);
      if (created) return created;
    } catch {
      // Fallback
    }

    this.inMemoryCategories.set(record.code, record);
    return record;
  }
}

export const taxCategoryRepository = new TaxCategoryRepository();
