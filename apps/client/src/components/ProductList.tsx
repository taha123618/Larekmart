import { ProductType, type SearchResponse, type SearchFacets } from "@repo/types";
import Categories from "./Categories";
import ProductCard from "./ProductCard";
import Link from "next/link";
import Filter from "./Filter";
import ActiveFilters from "./ActiveFilters";

// TEMPORARY
// const products: ProductsType = [
//   {
//     id: 1,
//     name: "Adidas CoreFit T-Shirt",
//     shortDescription:
//       "Lorem ipsum dolor sit amet consect adipisicing elit lorem ipsum dolor sit.",
//     description:
//       "Lorem ipsum dolor sit amet consect adipisicing elit lorem ipsum dolor sit. Lorem ipsum dolor sit amet consect adipisicing elit lorem ipsum dolor sit. Lorem ipsum dolor sit amet consect adipisicing elit lorem ipsum dolor sit.",
//     price: 39.9,
//     sizes: ["s", "m", "l", "xl", "xxl"],
//     colors: ["gray", "purple", "green"],
//     images: {
//       gray: "/products/1g.png",
//       purple: "/products/1p.png",
//       green: "/products/1gr.png",
//     },
//     categorySlug: "test",
//     createdAt: new Date(),
//     updatedAt: new Date(),
//   },
//   {
//     id: 2,
//     name: "Puma Ultra Warm Zip",
//     shortDescription:
//       "Lorem ipsum dolor sit amet consect adipisicing elit lorem ipsum dolor sit.",
//     description:
//       "Lorem ipsum dolor sit amet consect adipisicing elit lorem ipsum dolor sit. Lorem ipsum dolor sit amet consect adipisicing elit lorem ipsum dolor sit. Lorem ipsum dolor sit amet consect adipisicing elit lorem ipsum dolor sit.",
//     price: 59.9,
//     sizes: ["s", "m", "l", "xl"],
//     colors: ["gray", "green"],
//     images: { gray: "/products/2g.png", green: "/products/2gr.png" },
//     categorySlug: "test",
//     createdAt: new Date(),
//     updatedAt: new Date(),
//   },
//   {
//     id: 3,
//     name: "Nike Air Essentials Pullover",
//     shortDescription:
//       "Lorem ipsum dolor sit amet consect adipisicing elit lorem ipsum dolor sit.",
//     description:
//       "Lorem ipsum dolor sit amet consect adipisicing elit lorem ipsum dolor sit. Lorem ipsum dolor sit amet consect adipisicing elit lorem ipsum dolor sit. Lorem ipsum dolor sit amet consect adipisicing elit lorem ipsum dolor sit.",
//     price: 69.9,
//     sizes: ["s", "m", "l"],
//     colors: ["green", "blue", "black"],
//     images: {
//       green: "/products/3gr.png",
//       blue: "/products/3b.png",
//       black: "/products/3bl.png",
//     },
//     categorySlug: "test",
//     createdAt: new Date(),
//     updatedAt: new Date(),
//   },
//   {
//     id: 123,
//     name: "Nike Dri Flex T-Shirt",
//     shortDescription:
//       "Lorem ipsum dolor sit amet consect adipisicing elit lorem ipsum dolor sit.",
//     description:
//       "Lorem ipsum dolor sit amet consect adipisicing elit lorem ipsum dolor sit. Lorem ipsum dolor sit amet consect adipisicing elit lorem ipsum dolor sit. Lorem ipsum dolor sit amet consect adipisicing elit lorem ipsum dolor sit.",
//     price: 29.9,
//     sizes: ["s", "m", "l"],
//     colors: ["white", "pink"],
//     images: { white: "/products/4w.png", pink: "/products/4p.png" },
//     categorySlug: "test",
//     createdAt: new Date(),
//     updatedAt: new Date(),
//   },
//   {
//     id: 5,
//     name: "Under Armour StormFleece",
//     shortDescription:
//       "Lorem ipsum dolor sit amet consect adipisicing elit lorem ipsum dolor sit.",
//     description:
//       "Lorem ipsum dolor sit amet consect adipisicing elit lorem ipsum dolor sit. Lorem ipsum dolor sit amet consect adipisicing elit lorem ipsum dolor sit. Lorem ipsum dolor sit amet consect adipisicing elit lorem ipsum dolor sit.",
//     price: 49.9,
//     sizes: ["s", "m", "l"],
//     colors: ["red", "orange", "black"],
//     images: {
//       red: "/products/5r.png",
//       orange: "/products/5o.png",
//       black: "/products/5bl.png",
//     },
//     categorySlug: "test",
//     createdAt: new Date(),
//     updatedAt: new Date(),
//   },
//   {
//     id: 6,
//   name: "Nike Air Max 270",
//   shortDescription:
//     "Lorem ipsum dolor sit amet consect adipisicing elit lorem ipsum dolor sit.",
//   description:
//     "Lorem ipsum dolor sit amet consect adipisicing elit lorem ipsum dolor sit. Lorem ipsum dolor sit amet consect adipisicing elit lorem ipsum dolor sit. Lorem ipsum dolor sit amet consect adipisicing elit lorem ipsum dolor sit.",
//   price: 59.9,
//   sizes: ["40", "42", "43", "44"],
//   colors: ["gray", "white"],
//   images: { gray: "/products/6g.png", white: "/products/6w.png" },
//   categorySlug: "test",
//   createdAt: new Date(),
//   updatedAt: new Date(),
// },
//   {
//     id: 7,
//     name: "Nike Ultraboost Pulse ",
//     shortDescription:
//       "Lorem ipsum dolor sit amet consect adipisicing elit lorem ipsum dolor sit.",
//     description:
//       "Lorem ipsum dolor sit amet consect adipisicing elit lorem ipsum dolor sit. Lorem ipsum dolor sit amet consect adipisicing elit lorem ipsum dolor sit. Lorem ipsum dolor sit amet consect adipisicing elit lorem ipsum dolor sit.",
//     price: 69.9,
//     sizes: ["40", "42", "43"],
//     colors: ["gray", "pink"],
//     images: { gray: "/products/7g.png", pink: "/products/7p.png" },
//     categorySlug: "test",
//     createdAt: new Date(),
//     updatedAt: new Date(),
//   },
//   {
//     id: 8,
//     name: "Levi’s Classic Denim",
//     shortDescription:
//       "Lorem ipsum dolor sit amet consect adipisicing elit lorem ipsum dolor sit.",
//     description:
//       "Lorem ipsum dolor sit amet consect adipisicing elit lorem ipsum dolor sit. Lorem ipsum dolor sit amet consect adipisicing elit lorem ipsum dolor sit. Lorem ipsum dolor sit amet consect adipisicing elit lorem ipsum dolor sit.",
//     price: 59.9,
//     sizes: ["s", "m", "l"],
//     colors: ["blue", "green"],
//     images: { blue: "/products/8b.png", green: "/products/8gr.png" },
//     categorySlug: "test",
//     createdAt: new Date(),
//     updatedAt: new Date(),
//   },
// ];

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

/** Reads the catalog straight from product-service's PostgreSQL listing. */
const fetchCatalog = async ({
  category,
  sort,
  search,
  params,
}: ProductListParams): Promise<ProductSearchData> => {
  const query = new URLSearchParams();
  if (category && category !== "all") query.set("category", category);
  if (search) query.set("search", search);
  query.set("sort", sort || "newest");
  if (params === "homepage") query.set("limit", "8");

  const res = await fetch(
    `${process.env.NEXT_PUBLIC_PRODUCT_SERVICE_URL}/products?${query.toString()}`,
  );
  const data = await res.json();
  return {
    products: Array.isArray(data) ? (data as ProductType[]) : [],
    // The catalog listing has no facet aggregations.
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

  const res = await fetch(
    `${process.env.NEXT_PUBLIC_PRODUCT_SERVICE_URL}/products/search?${query.toString()}`,
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
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-12">
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
