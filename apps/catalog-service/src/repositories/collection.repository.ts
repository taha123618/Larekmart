import { prisma } from "@repo/catalog-db";
import type { CatalogCollectionType } from "@repo/types";
import { mapCollection } from "../utils/mappers.js";

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
  async findAllCollections(): Promise<CatalogCollectionType[]> {
    const collections = await prisma.catalogCollection.findMany({
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

  async findCollectionBySlug(slug: string): Promise<CatalogCollectionType | null> {
    const collection = await prisma.catalogCollection.findFirst({
      where: {
        slug,
        status: "ACTIVE",
      },
      include: collectionInclude,
    });

    return collection ? mapCollection(collection as any) : null;
  }

  async findCollectionById(id: string): Promise<CatalogCollectionType | null> {
    const collection = await prisma.catalogCollection.findFirst({
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
