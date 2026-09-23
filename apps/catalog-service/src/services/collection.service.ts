import type { CatalogCollectionType } from "@repo/types";
import {
  CatalogCacheKeys,
  getCached,
  setCached,
} from "../cache/catalog-cache.js";
import { collectionRepository } from "../repositories/collection.repository.js";

export class CollectionService {
  async getAllCollections(): Promise<CatalogCollectionType[]> {
    return collectionRepository.findAllCollections();
  }

  async getCollectionBySlugOrId(
    slugOrId: string,
  ): Promise<CatalogCollectionType | null> {
    const cacheKey = CatalogCacheKeys.collection(slugOrId);
    const cached = await getCached<CatalogCollectionType>(cacheKey);
    if (cached) return cached;

    let collection = await collectionRepository.findCollectionBySlug(slugOrId);
    if (!collection) {
      collection = await collectionRepository.findCollectionById(slugOrId);
    }

    if (collection) {
      await setCached(cacheKey, collection);
    }
    return collection;
  }
}

export const collectionService = new CollectionService();
