import type { CatalogCollectionType } from "@repo/types";
import {
  CatalogCacheKeys,
  getCached,
  setCached,
} from "../cache/catalog-cache.js";
import { collectionRepository } from "../repositories/collection.repository.js";
import { databaseContext } from "../utils/database-context.js";

export interface CollectionQueryOptions {
  forcePrimary?: boolean;
}

export class CollectionService {
  async getAllCollections(
    options?: CollectionQueryOptions,
  ): Promise<CatalogCollectionType[]> {
    const forcePrimary =
      options?.forcePrimary ??
      databaseContext.getStore()?.forcePrimary ??
      false;
    return collectionRepository.findAllCollections(forcePrimary);
  }

  async getCollectionBySlugOrId(
    slugOrId: string,
    options?: CollectionQueryOptions,
  ): Promise<CatalogCollectionType | null> {
    const forcePrimary =
      options?.forcePrimary ??
      databaseContext.getStore()?.forcePrimary ??
      false;
    const cacheKey = CatalogCacheKeys.collection(slugOrId);

    if (!forcePrimary) {
      const cached = await getCached<CatalogCollectionType>(cacheKey);
      if (cached) return cached;
    }

    let collection = await collectionRepository.findCollectionBySlug(
      slugOrId,
      forcePrimary,
    );
    if (!collection) {
      collection = await collectionRepository.findCollectionById(
        slugOrId,
        forcePrimary,
      );
    }

    if (collection) {
      await setCached(cacheKey, collection);
    }
    return collection;
  }
}

export const collectionService = new CollectionService();
