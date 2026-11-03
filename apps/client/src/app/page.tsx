import type React from "react";
import ProductList from "@/components/ProductList";
import RecommendationSection from "@/components/RecommendationSection";
import FeaturedSection from "@/components/FeaturedSection";
import HeroBanner from "@/components/HeroBanner";
import FlashDeals from "@/components/FlashDeals";
import MarketplaceCategories from "@/components/MarketplaceCategories";
import TrustBadges from "@/components/TrustBadges";
import ShopCTA from "@/components/ShopCTA";
import Testimonials from "@/components/Testimonials";
import {
  fetchFeaturedProducts,
  normalizeCatalogProduct,
} from "@/services/catalog.service";
import { fetchMarketplaceTrustMetrics } from "@/services/analytics.service";

const Homepage = async ({
  searchParams,
}: {
  searchParams: Promise<{ category: string }>;
}): Promise<React.JSX.Element> => {
  const category = (await searchParams).category;
  const [featured, trustMetrics] = await Promise.all([
    fetchFeaturedProducts(4),
    fetchMarketplaceTrustMetrics(),
  ]);
  const flashProducts = featured.map(normalizeCatalogProduct);

  return (
    <div className="w-full pb-16">
      {/* 1. ANIMATED HERO CAROUSEL WITH PROMO PANELS & CTAs */}
      <HeroBanner />

      {/* 2. MARKETPLACE TRUST GUARANTEES & CONFIDENCE INDICATORS */}
      <TrustBadges metrics={trustMetrics} />

      {/* 3. VISUAL CATEGORY HIGHLIGHTS GRID */}
      <MarketplaceCategories />

      {/* 4. FLASH DEALS SECTION WITH COUNTDOWN TICKER */}
      <FlashDeals products={flashProducts} />

      {/* 5. FEATURED PRODUCTS — Curated Editor's Picks */}
      <div id="featured">
        <FeaturedSection
          type="featured"
          title="Editor's Featured Picks"
          subtitle="Hand-picked premium selections recommended by our stylists"
          limit={8}
        />
      </div>

      {/* 6. BEST SELLERS — High-velocity top rated items */}
      <div id="best-sellers">
        <FeaturedSection
          type="best-sellers"
          title="All-Time Best Sellers"
          subtitle="Consistently top-rated and reordered by thousands of customers"
          limit={8}
        />
      </div>

      {/* 7. HIGH-CONVERTING MID-PAGE CALL TO ACTION & COUPON BANNER */}
      <ShopCTA />

      {/* 8. RECENT PRODUCTS — Fresh seasonal arrivals */}
      <div id="new-arrivals">
        <FeaturedSection
          type="new-arrivals"
          title="Fresh New Arrivals"
          subtitle="Latest styles, seasonal drops, and tech accessories just landed"
          limit={8}
        />
      </div>

      {/* 9. ALL MARKETPLACE PRODUCTS CATALOG GRID */}
      <div className="my-12">
        <div className="mb-6">
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            Explore Marketplace Catalog
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Filter by category, size, color, brand, or search query with live
            facet counts
          </p>
        </div>
        <ProductList category={category} params="homepage" />
      </div>

      {/* 10. SOCIAL PROOF & VERIFIED CUSTOMER REVIEWS */}
      <Testimonials />

      {/* 11. TRENDING & PERSONALIZED RECOMMENDATIONS */}
      <div id="trending">
        <RecommendationSection
          title="Trending Styles & Viral Picks"
          subtitle="Top rated by shoppers this week with verified buyer badges"
          type="trending"
          limit={4}
        />
      </div>

      {/* 12. RECENTLY VIEWED PRODUCTS */}
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
