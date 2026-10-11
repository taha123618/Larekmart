import type React from "react";
import ProductList from "@/components/ProductList";
import RecommendationSection from "@/components/RecommendationSection";
import FeaturedSection from "@/components/FeaturedSection";
import HeroBanner from "@/components/HeroBanner";
import FlashDeals from "@/components/FlashDeals";
import MarketplaceCategories from "@/components/MarketplaceCategories";
import TrustBadges from "@/components/TrustBadges";
import {
  fetchFeaturedProducts,
  normalizeCatalogProduct,
} from "@/services/catalog.service";

const Homepage = async ({
  searchParams,
}: {
  searchParams: Promise<{ category: string }>;
}): Promise<React.JSX.Element> => {
  const category = (await searchParams).category;
  const featured = await fetchFeaturedProducts(4);
  const flashProducts = featured.map(normalizeCatalogProduct);

  return (
    <div className="w-full pb-16">
      {/* 1. ANIMATED HERO CAROUSEL WITH GSAP & PROMO CARDS */}
      <HeroBanner />

      {/* 2. MARKETPLACE TRUST GUARANTEES STRIP */}
      <TrustBadges />

      {/* 3. FLASH DEALS SECTION WITH COUNTDOWN TICKER */}
      <FlashDeals products={flashProducts} />

      {/* 4. POPULAR MARKETPLACE CATEGORIES GRID */}
      <MarketplaceCategories />

      {/* 5. TRENDING — AI-powered recommendations */}
      <div id="trending">
        <RecommendationSection
          title="Trending Styles & Viral Picks"
          subtitle="Top rated by shoppers this week with verified reviews"
          type="trending"
          limit={4}
        />
      </div>

      {/* 6. NEW ARRIVALS — catalog-service read model */}
      <div id="new-arrivals">
        <FeaturedSection
          type="new-arrivals"
          title="Fresh New Arrivals"
          subtitle="Latest styles and seasonal collection just landed"
          limit={8}
        />
      </div>

      {/* 7. ALL MARKETPLACE PRODUCTS GRID */}
      <div className="my-12">
        <div className="mb-6">
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Explore Marketplace Catalog
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Filter by size, color, brand, or search query with live facet counts
          </p>
        </div>
        <ProductList category={category} params="homepage" />
      </div>

      {/* 8. FEATURED PICKS — catalog-service read model */}
      <FeaturedSection
        type="featured"
        title="Editor's Featured Picks"
        subtitle="Hand-picked premium selections recommended by our stylists"
        limit={8}
      />

      {/* 9. PERSONALIZED PICKS — AI-powered */}
      <RecommendationSection
        title="Recommended Just For You"
        subtitle="Curated using your browsing patterns and interaction preferences"
        type="personalized"
        limit={4}
      />

      {/* 10. BEST SELLERS */}
      <FeaturedSection
        type="best-sellers"
        title="All-Time Best Sellers"
        subtitle="Consistently top-rated and reordered by thousands of customers"
        limit={8}
      />

      {/* 11. RECENTLY VIEWED */}
      <RecommendationSection
        title="Recently Viewed Products"
        subtitle="Pick up right where you left off"
        type="recently_viewed"
        limit={4}
      />
    </div>
  );
};

export default Homepage;
