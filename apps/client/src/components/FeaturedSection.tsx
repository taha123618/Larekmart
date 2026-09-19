/**
 * FeaturedSection.tsx — Server Component
 *
 * Renders a horizontal product carousel for "Featured", "New Arrivals",
 * or "Best Sellers" by pulling from catalog-service's pre-computed read models.
 *
 * Usage:
 *   <FeaturedSection type="featured" title="Trending Now" />
 *   <FeaturedSection type="new-arrivals" title="New Arrivals" />
 *   <FeaturedSection type="best-sellers" title="Best Sellers" />
 */
import Image from "next/image";
import Link from "next/link";
import {
  fetchFeaturedProducts,
  fetchNewArrivals,
  fetchBestSellers,
  type CatalogProductCard,
} from "@/services/catalog.service";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fetchers = {
  featured: fetchFeaturedProducts,
  "new-arrivals": fetchNewArrivals,
  "best-sellers": fetchBestSellers,
} as const;

// ─── Product card for catalog items ──────────────────────────────────────────

const CatalogCard = ({ product }: { product: CatalogProductCard }) => {
  const imageSrc =
    product.thumbnailUrl ||
    (product.images
      ? Object.values(product.images as Record<string, string>)[0]
      : null) ||
    "";

  return (
    <Link
      href={`/products/${product.productId || product.id}`}
      className="group min-w-[220px] max-w-[220px] flex flex-col gap-2"
    >
      <div className="relative aspect-[2/3] rounded-xl overflow-hidden">
        {imageSrc ? (
          <Image
            src={imageSrc}
            alt={product.name}
            fill
            className="object-cover group-hover:scale-105 transition-all duration-300"
          />
        ) : (
          <div className="w-full h-full bg-gray-100 flex items-center justify-center text-gray-400 text-xs">
            No image
          </div>
        )}
        {product.badges && product.badges.length > 0 && (
          <span className="absolute top-2 left-2 bg-black text-white text-xs px-2 py-0.5 rounded-md">
            {product.badges[0]}
          </span>
        )}
        {product.discountPercentage > 0 && (
          <span className="absolute top-2 right-2 bg-red-500 text-white text-xs px-2 py-0.5 rounded-md">
            -{product.discountPercentage}%
          </span>
        )}
      </div>
      <div className="flex flex-col gap-1">
        <p className="font-medium text-sm line-clamp-1">{product.name}</p>
        {product.brand && (
          <p className="text-xs text-gray-400">{product.brand.name}</p>
        )}
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm">${product.price.toFixed(2)}</span>
          {product.compareAtPrice && product.compareAtPrice > product.price && (
            <span className="line-through text-xs text-gray-400">
              ${product.compareAtPrice.toFixed(2)}
            </span>
          )}
        </div>
        {product.availabilityStatus === "out_of_stock" && (
          <span className="text-xs text-red-500">Out of stock</span>
        )}
        {product.availabilityStatus === "low_stock" && (
          <span className="text-xs text-amber-500">Low stock</span>
        )}
      </div>
    </Link>
  );
};

// ─── Section ──────────────────────────────────────────────────────────────────

interface FeaturedSectionProps {
  type: keyof typeof fetchers;
  title: string;
  subtitle?: string;
  limit?: number;
}

const FeaturedSection = async ({
  type,
  title,
  subtitle,
  limit = 8,
}: FeaturedSectionProps) => {
  const products = await fetchers[type](limit);

  if (!products || products.length === 0) return null;

  return (
    <div className="flex flex-col gap-4 mb-12">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-xl font-semibold">{title}</h2>
          {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
        </div>
        <Link
          href={`/products${type !== "featured" ? `?sort=${type === "new-arrivals" ? "newest" : "popular"}` : ""}`}
          className="text-sm text-gray-500 underline hover:text-black transition-colors"
        >
          View all
        </Link>
      </div>
      <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-gray-200">
        {products.map((product) => (
          <CatalogCard key={product.id} product={product} />
        ))}
      </div>
    </div>
  );
};

export default FeaturedSection;
