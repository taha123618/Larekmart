import ProductList from "@/components/ProductList";
import RecommendationSection from "@/components/RecommendationSection";

type ProductsSearchParams = {
  category?: string;
  sort?: string;
  search?: string;
  color?: string;
  size?: string;
  min_price?: string;
  max_price?: string;
};

const ProductsPage = async ({
  searchParams,
}: {
  searchParams: Promise<ProductsSearchParams>;
}) => {
  const { category, sort, search, color, size, min_price, max_price } =
    await searchParams;

  return (
    <div className="flex flex-col gap-12">
      <ProductList
        category={category}
        sort={sort}
        search={search}
        color={color}
        size={size}
        min_price={min_price}
        max_price={max_price}
        params="products"
      />

      <div className="border-t border-gray-100 pt-8">
        <RecommendationSection
          title={
            category
              ? `Trending in ${category.charAt(0).toUpperCase() + category.slice(1)}`
              : "Trending Styles You May Love"
          }
          subtitle="Real-time popular styles calculated with velocity decay"
          type="trending"
          categorySlug={category}
          limit={4}
        />
      </div>
    </div>
  );
};

export default ProductsPage;
