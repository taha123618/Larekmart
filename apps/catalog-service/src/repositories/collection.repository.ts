import type { CatalogCollectionType } from "@repo/types";
import { mapCollection } from "../utils/mappers.js";
import { getDatabaseClient } from "../utils/database-context.js";

const collectionInclude = {
  _count: {
    select: { collectionProducts: true },
  },
  collectionProducts: {
    orderBy: { position: "asc" as const },
    include: {
      product: {
        include: {
          brand: true,
          primaryCategory: true,
          variants: true,
        },
      },
    },
  },
};

export class CollectionRepository {
  async findAllCollections(
    forcePrimary?: boolean,
  ): Promise<CatalogCollectionType[]> {
    const db = getDatabaseClient(forcePrimary);
    const collections = await db.catalogCollection.findMany({
      where: { status: "ACTIVE" },
      orderBy: { sortOrder: "asc" },
      include: {
        _count: {
          select: { collectionProducts: true },
        },
      },
    });

    return collections.map((col) => mapCollection(col as any));
  }

  async findCollectionBySlug(
    slug: string,
    forcePrimary?: boolean,
  ): Promise<CatalogCollectionType | null> {
    const db = getDatabaseClient(forcePrimary);
    const collection = await db.catalogCollection.findFirst({
      where: {
        slug,
        status: "ACTIVE",
      },
      include: collectionInclude,
    });

    return collection ? mapCollection(collection as any) : null;
  }

  async findCollectionById(
    id: string,
    forcePrimary?: boolean,
  ): Promise<CatalogCollectionType | null> {
    const db = getDatabaseClient(forcePrimary);
    const collection = await db.catalogCollection.findFirst({
      where: {
        id,
        status: "ACTIVE",
      },
      include: collectionInclude,
    });

    return collection ? mapCollection(collection as any) : null;
  }
}

export const collectionRepository = new CollectionRepository();
