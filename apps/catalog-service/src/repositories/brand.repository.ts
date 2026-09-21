import { prisma } from "@repo/catalog-db";
import type { CatalogBrandType } from "@repo/types";
import { mapBrand } from "../utils/mappers.js";

export class BrandRepository {
  async findAllBrands(): Promise<CatalogBrandType[]> {
    const brands = await prisma.catalogBrand.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
    });
    return brands.map(mapBrand);
  }

  async findBrandByIdOrSlug(idOrSlug: string): Promise<CatalogBrandType | null> {
    const brand = await prisma.catalogBrand.findFirst({
      where: {
        OR: [{ id: idOrSlug }, { slug: idOrSlug }],
        isActive: true,
      },
    });
    return brand ? mapBrand(brand) : null;
  }
}

export const brandRepository = new BrandRepository();
