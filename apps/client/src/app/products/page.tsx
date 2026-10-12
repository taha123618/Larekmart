import type React from "react";
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
}): Promise<React.JSX.Element> => {
  const { category, sort, search, color, size, min_price, max_price } =
    await searchParams;

  return (
    <div className="flex flex-col gap-10 pb-16 pt-4">
      {/* Page Header */}
      <div className="flex flex-col gap-1.5 border-b border-slate-100 dark:border-slate-800/80 pb-4">
        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
          {category
            ? `${category.charAt(0).toUpperCase() + category.slice(1).replace(/-/g, " ")} Collection`
            : search
              ? `Search Results for "${search}"`
              : "Explore Marketplace Catalog"}
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
          Discover verified merchandise with real-time stock availability, live
          facet filters, and buyer protection.
        </p>
      </div>

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

      <div className="border-t border-gray-100 dark:border-slate-800 pt-8">
        <RecommendationSection
          title={
            category
              ? `Recommended in ${category.charAt(0).toUpperCase() + category.slice(1)}`
              : "Trending Styles You May Love"
          }
          subtitle={
            category
              ? "AI-ranked top picks in this category"
              : "Real-time popular styles calculated with velocity decay"
          }
          type={category ? "category" : "trending"}
          categorySlug={category}
          limit={4}
        />
      </div>
    </div>
  );
};

export default ProductsPage;
