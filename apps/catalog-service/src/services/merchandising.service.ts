import { catalogService } from "./catalog.service.js";
import { collectionService } from "./collection.service.js";
import { categoryService } from "./category.service.js";
import { databaseContext } from "../utils/database-context.js";

export interface MerchandisingQueryOptions {
  forcePrimary?: boolean;
}

export class MerchandisingService {
  async getStorefrontOverview(options?: MerchandisingQueryOptions) {
    const forcePrimary =
      options?.forcePrimary ??
      databaseContext.getStore()?.forcePrimary ??
      false;

    const [featured, newArrivals, bestSellers, collections, categories] =
      await Promise.all([
        catalogService.getFeaturedProducts(8, { forcePrimary }),
        catalogService.getNewArrivals(8, { forcePrimary }),
        catalogService.getBestSellers(8, { forcePrimary }),
        collectionService.getAllCollections({ forcePrimary }),
        categoryService.getCategoryTree({ forcePrimary }),
      ]);

    return {
      heroCollections: collections.slice(0, 3),
      sections: [
        {
          id: "featured",
          title: "Featured Products",
          subtitle: "Handpicked styles for you",
          products: featured,
        },
        {
          id: "new-arrivals",
          title: "New Arrivals",
          subtitle: "Just dropped in the catalog",
          products: newArrivals,
        },
        {
          id: "best-sellers",
          title: "Best Sellers",
          subtitle: "Top rated by our community",
          products: bestSellers,
        },
      ],
      categories: categories.slice(0, 6),
    };
  }
}

export const merchandisingService = new MerchandisingService();
