import ProductList from "@/components/ProductList";
import RecommendationSection from "@/components/RecommendationSection";
import FeaturedSection from "@/components/FeaturedSection";
import Image from "next/image";

const Homepage = async ({
  searchParams,
}: {
  searchParams: Promise<{ category: string }>;
}) => {
  const category = (await searchParams).category;
  return (
    <div className="">
      {/* HERO BANNER */}
      <div className="relative aspect-[3/1] mb-12">
        <Image src="/featured.png" alt="Featured Product" fill />
      </div>

      {/* TRENDING — AI-powered from recommendation-service */}
      <RecommendationSection
        title="Trending Styles"
        subtitle="Most popular items loved by customers this week"
        type="trending"
        limit={4}
      />

      {/* NEW ARRIVALS — catalog-service read model */}
      <FeaturedSection
        type="new-arrivals"
        title="New Arrivals"
        subtitle="Fresh styles just landed"
        limit={8}
      />

      {/* PRODUCT GRID — filtered listing (search-service → catalog-service fallback) */}
      <ProductList category={category} params="homepage" />

      {/* FEATURED — catalog-service read model */}
      <FeaturedSection
        type="featured"
        title="Featured Picks"
        subtitle="Hand-picked by our team"
        limit={8}
      />

      {/* PERSONALIZED — AI-powered from recommendation-service */}
      <RecommendationSection
        title="Recommended For You"
        subtitle="Personalized picks based on your recent interactions and preferences"
        type="personalized"
        limit={4}
      />

      {/* BEST SELLERS — catalog-service read model */}
      <FeaturedSection
        type="best-sellers"
        title="Best Sellers"
        subtitle="Most loved by our customers"
        limit={8}
      />

      {/* RECENTLY VIEWED — AI-powered from recommendation-service */}
      <RecommendationSection
        title="Recently Viewed"
        subtitle="Pick up where you left off"
        type="recently_viewed"
        limit={4}
      />
    </div>
  );
};

export default Homepage;
