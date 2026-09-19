import { catalogService } from "./catalog.service.js";
import { collectionService } from "./collection.service.js";
import { categoryService } from "./category.service.js";

export class MerchandisingService {
  async getStorefrontOverview() {
    const [featured, newArrivals, bestSellers, collections, categories] = await Promise.all([
      catalogService.getFeaturedProducts(8),
      catalogService.getNewArrivals(8),
      catalogService.getBestSellers(8),
      collectionService.getAllCollections(),
      categoryService.getCategoryTree(),
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
