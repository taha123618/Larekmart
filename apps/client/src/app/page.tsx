import ProductList from "@/components/ProductList";
import RecommendationSection from "@/components/RecommendationSection";
import Image from "next/image";

const Homepage = async ({
  searchParams,
}: {
  searchParams: Promise<{ category: string }>;
}) => {
  const category = (await searchParams).category;
  return (
    <div className="">
      <div className="relative aspect-[3/1] mb-12">
        <Image src="/featured.png" alt="Featured Product" fill />
      </div>
      <RecommendationSection
        title="Trending Styles"
        subtitle="Most popular items loved by customers this week"
        type="trending"
        limit={4}
      />
      <ProductList category={category} params="homepage" />
      <RecommendationSection
        title="Recommended For You"
        subtitle="Personalized picks based on your recent interactions and preferences"
        type="personalized"
        limit={4}
      />
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
