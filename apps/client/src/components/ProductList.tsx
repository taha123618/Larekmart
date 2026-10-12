import {
  ProductType,
  type SearchResponse,
  type SearchFacets,
} from "@repo/types";
import Categories from "./Categories";
import ProductCard from "./ProductCard";
import Link from "next/link";
import Filter from "./Filter";
import ActiveFilters from "./ActiveFilters";
import {
  fetchCatalogProducts,
  normalizeCatalogProduct,
} from "@/services/catalog.service";

type ProductListParams = {
  category?: string;
  sort?: string;
  search?: string;
  color?: string;
  size?: string;
  min_price?: string;
  max_price?: string;
  params: "homepage" | "products";
};

/** Products plus the facet buckets OpenSearch returns for the current query. */
type ProductSearchData = {
  products: ProductType[];
  facets?: SearchFacets;
};

/**
 * The UI sort vocabulary (Filter dropdown) mapped to the values accepted by the
 * OpenSearch-backed `GET /products/search` endpoint.
 */
const SEARCH_SORT: Record<string, string> = {
  newest: "newest",
  oldest: "oldest",
  asc: "price_asc",
  desc: "price_desc",
};

/**
 * Reads from the catalog-service read-model (Redis-cached, pre-computed).
 * Used as the primary fallback when search-service is unavailable.
 */
const fetchCatalog = async ({
  category,
  sort,
  min_price,
  max_price,
  params,
}: ProductListParams): Promise<ProductSearchData> => {
  const sortMap: Record<
    string,
    "newest" | "price_asc" | "price_desc" | "rating"
  > = {
    newest: "newest",
    asc: "price_asc",
    desc: "price_desc",
  };
  const result = await fetchCatalogProducts({
    category: category !== "all" ? category : undefined,
    sort: sortMap[sort ?? "newest"] ?? "newest",
    minPrice: min_price ? parseFloat(min_price) : undefined,
    maxPrice: max_price ? parseFloat(max_price) : undefined,
    limit: params === "homepage" ? 8 : 24,
  });
  return {
    products: result.data.map(normalizeCatalogProduct),
    facets: undefined,
  };
};

/**
 * Reads the denormalized product index through product-service's
 * OpenSearch-backed search endpoint. Returns `null` when the index is
 * unavailable so the caller can degrade to the catalog listing.
 */
const fetchSearch = async ({
  category,
  sort,
  search,
  color,
  size,
  min_price,
  max_price,
}: ProductListParams): Promise<ProductSearchData | null> => {
  const query = new URLSearchParams();
  if (search) query.set("q", search);
  if (category && category !== "all") query.set("categorySlug", category);
  if (color) query.set("color", color);
  if (size) query.set("size", size);
  if (min_price) query.set("min_price", min_price);
  if (max_price) query.set("max_price", max_price);
  query.set("sort", SEARCH_SORT[sort ?? "newest"] ?? "relevance");

  const productServiceUrl =
    process.env.NEXT_PUBLIC_PRODUCT_SERVICE_URL ||
    process.env.NEXT_PUBLIC_API_GATEWAY_URL ||
    "http://localhost:8090";
  const res = await fetch(
    `${productServiceUrl}/products/search?${query.toString()}`,
  );
  if (!res.ok) return null;

  const body = (await res.json()) as SearchResponse;
  if (!Array.isArray(body.data)) return null;

  // The search document carries every field ProductCard renders; ProductType is
  // the shared card/cart contract, so normalize to it at the boundary.
  return {
    products: body.data as unknown as ProductType[],
    facets: body.facets,
  };
};

const fetchData = async (
  options: ProductListParams,
): Promise<ProductSearchData> => {
  if (options.params === "products") {
    const results = await fetchSearch(options);
    if (results) return results;
    // OpenSearch unavailable — degrade to the catalog database listing.
  }
  return fetchCatalog(options);
};
const ProductList = async ({
  category,
  sort,
  search,
  color,
  size,
  min_price,
  max_price,
  params,
}: {
  category?: string;
  sort?: string;
  search?: string;
  color?: string;
  size?: string;
  min_price?: string;
  max_price?: string;
  params: "homepage" | "products";
}) => {
  const { products, facets } = await fetchData({
    category,
    sort,
    search,
    color,
    size,
    min_price,
    max_price,
    params,
  });
  return (
    <div className="w-full">
      <Categories />
      {params === "products" && <Filter facets={facets} />}
      {params === "products" && <ActiveFilters />}
      {products.length === 0 ? (
        <p className="py-12 text-center text-sm text-gray-500">
          No products match your filters.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6 lg:gap-8">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
      <Link
        href={category ? `/products/?category=${category}` : "/products"}
        className="flex justify-end mt-4 underline text-sm text-gray-500"
      >
        View all products
      </Link>
    </div>
  );
};

export default ProductList;
