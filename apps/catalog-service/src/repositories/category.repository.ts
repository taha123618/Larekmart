import type { CatalogCategoryItemType } from "@repo/types";
import { mapCategoryItem } from "../utils/mappers.js";
import { getDatabaseClient } from "../utils/database-context.js";

export class CategoryRepository {
  async findCategoryTree(
    forcePrimary?: boolean,
  ): Promise<CatalogCategoryItemType[]> {
    const db = getDatabaseClient(forcePrimary);
    const categories = await db.catalogCategory.findMany({
      where: { isActive: true },
      orderBy: { position: "asc" },
      include: {
        _count: {
          select: {
            primaryProducts: { where: { isActive: true } },
          },
        },
      },
    });

    const categoryMap = new Map<string, CatalogCategoryItemType>();
    const roots: CatalogCategoryItemType[] = [];

    for (const cat of categories) {
      categoryMap.set(cat.id, mapCategoryItem(cat, []));
    }

    for (const cat of categories) {
      const item = categoryMap.get(cat.id)!;
      if (cat.parentId && categoryMap.has(cat.parentId)) {
        categoryMap.get(cat.parentId)!.children.push(item);
      } else {
        roots.push(item);
      }
    }

    return roots;
  }

  async findAllCategories(
    forcePrimary?: boolean,
  ): Promise<CatalogCategoryItemType[]> {
    const db = getDatabaseClient(forcePrimary);
    const categories = await db.catalogCategory.findMany({
      where: { isActive: true },
      orderBy: { position: "asc" },
      include: {
        _count: {
          select: {
            primaryProducts: { where: { isActive: true } },
          },
        },
      },
    });
    return categories.map((cat) => mapCategoryItem(cat));
  }

  async findCategoryByIdOrSlug(
    idOrSlug: string,
    forcePrimary?: boolean,
  ): Promise<CatalogCategoryItemType | null> {
    const db = getDatabaseClient(forcePrimary);
    const category = await db.catalogCategory.findFirst({
      where: {
        OR: [{ id: idOrSlug }, { slug: idOrSlug }],
        isActive: true,
      },
      include: {
        _count: {
          select: {
            primaryProducts: { where: { isActive: true } },
          },
        },
        children: {
          where: { isActive: true },
          orderBy: { position: "asc" },
          include: {
            _count: {
              select: {
                primaryProducts: { where: { isActive: true } },
              },
            },
          },
        },
      },
    });

    if (!category) return null;

    const children = (category.children || []).map((child) =>
      mapCategoryItem(child),
    );
    return mapCategoryItem(category, children);
  }
}

export const categoryRepository = new CategoryRepository();
