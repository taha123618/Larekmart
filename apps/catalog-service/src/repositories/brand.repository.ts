import type { CatalogBrandType } from "@repo/types";
import { mapBrand } from "../utils/mappers.js";
import { getDatabaseClient } from "../utils/database-context.js";

export class BrandRepository {
  async findAllBrands(forcePrimary?: boolean): Promise<CatalogBrandType[]> {
    const db = getDatabaseClient(forcePrimary);
    const brands = await db.catalogBrand.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
    });
    return brands.map(mapBrand);
  }

  async findBrandByIdOrSlug(
    idOrSlug: string,
    forcePrimary?: boolean,
  ): Promise<CatalogBrandType | null> {
    const db = getDatabaseClient(forcePrimary);
    const brand = await db.catalogBrand.findFirst({
      where: {
        OR: [{ id: idOrSlug }, { slug: idOrSlug }],
        isActive: true,
      },
    });
    return brand ? mapBrand(brand) : null;
  }
}

export const brandRepository = new BrandRepository();
