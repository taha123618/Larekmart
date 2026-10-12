/**
 * FeaturedSection.tsx — Server Component
 *
 * Renders a horizontal product carousel for "Featured", "New Arrivals",
 * or "Best Sellers" by pulling from catalog-service's pre-computed read models
 * with graceful fallback to curated items.
 */
import Link from "next/link";
import MediaImage from "@/components/MediaImage";
import { Star, ArrowRight, Sparkles, TrendingUp, Flame } from "lucide-react";
import {
  fetchFeaturedProducts,
  fetchNewArrivals,
  fetchBestSellers,
  type CatalogProductCard,
} from "@/services/catalog.service";

// ─── Fallback Curated Products ───────────────────────────────────────────────

const FALLBACK_PRODUCTS: Record<
  "featured" | "new-arrivals" | "best-sellers",
  CatalogProductCard[]
> = {
  featured: [
    {
      id: "feat-1",
      productId: "1",
      name: "Urban Velocity Waterproof Jacket",
      slug: "urban-velocity-waterproof-jacket",
      thumbnailUrl:
        "https://images.unsplash.com/photo-1551028719-00167b16eac5?auto=format&fit=crop&q=80&w=600",
      price: 129.99,
      compareAtPrice: 179.99,
      discountPercentage: 28,
      rating: 4.9,
      reviewCount: 342,
      availabilityStatus: "in_stock",
      brand: { id: "b1", name: "Apex Tech", slug: "apex-tech", isActive: true },
      badges: ["FEATURED", "STAFF PICK"],
      isFeatured: true,
      isNew: false,
      isActive: true,
    },
    {
      id: "feat-2",
      productId: "2",
      name: "CloudGlide Carbon Running Shoes",
      slug: "cloudglide-carbon-running-shoes",
      thumbnailUrl:
        "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&q=80&w=600",
      price: 159.0,
      compareAtPrice: 199.0,
      discountPercentage: 20,
      rating: 4.8,
      reviewCount: 512,
      availabilityStatus: "in_stock",
      brand: { id: "b2", name: "AeroStep", slug: "aerostep", isActive: true },
      badges: ["TOP RATED"],
      isFeatured: true,
      isNew: false,
      isActive: true,
    },
    {
      id: "feat-3",
      productId: "3",
      name: "Chronograph Titanium Minimalist Watch",
      slug: "chronograph-titanium-minimalist-watch",
      thumbnailUrl:
        "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&q=80&w=600",
      price: 249.5,
      compareAtPrice: 320.0,
      discountPercentage: 22,
      rating: 5.0,
      reviewCount: 188,
      availabilityStatus: "in_stock",
      brand: {
        id: "b3",
        name: "Nordic Time",
        slug: "nordic-time",
        isActive: true,
      },
      badges: ["LUXURY"],
      isFeatured: true,
      isNew: false,
      isActive: true,
    },
    {
      id: "feat-4",
      productId: "4",
      name: "Spatial Sound ANC Wireless Headphones",
      slug: "spatial-sound-anc-wireless-headphones",
      thumbnailUrl:
        "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&q=80&w=600",
      price: 189.99,
      compareAtPrice: 249.99,
      discountPercentage: 24,
      rating: 4.9,
      reviewCount: 624,
      availabilityStatus: "in_stock",
      brand: { id: "b4", name: "SonicPro", slug: "sonicpro", isActive: true },
      badges: ["FEATURED"],
      isFeatured: true,
      isNew: false,
      isActive: true,
    },
  ],
  "new-arrivals": [
    {
      id: "new-1",
      productId: "5",
      name: "Commuter Roll-Top Waterproof Backpack",
      slug: "commuter-roll-top-waterproof-backpack",
      thumbnailUrl:
        "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&q=80&w=600",
      price: 89.0,
      compareAtPrice: 110.0,
      discountPercentage: 19,
      rating: 4.8,
      reviewCount: 94,
      availabilityStatus: "in_stock",
      brand: {
        id: "b5",
        name: "Nomad Carry",
        slug: "nomad-carry",
        isActive: true,
      },
      badges: ["JUST IN"],
      isFeatured: false,
      isNew: true,
      isActive: true,
    },
    {
      id: "new-2",
      productId: "6",
      name: "Polarized Bio-Acetate Sunglasses",
      slug: "polarized-bio-acetate-sunglasses",
      thumbnailUrl:
        "https://images.unsplash.com/photo-1511499767150-a48a237f0083?auto=format&fit=crop&q=80&w=600",
      price: 74.5,
      compareAtPrice: 95.0,
      discountPercentage: 21,
      rating: 4.7,
      reviewCount: 63,
      availabilityStatus: "in_stock",
      brand: {
        id: "b6",
        name: "Solara Optics",
        slug: "solara-optics",
        isActive: true,
      },
      badges: ["NEW DROP"],
      isFeatured: false,
      isNew: true,
      isActive: true,
    },
    {
      id: "new-3",
      productId: "7",
      name: "Heavyweight Boxy Graphic Tee",
      slug: "heavyweight-boxy-graphic-tee",
      thumbnailUrl:
        "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&q=80&w=600",
      price: 42.0,
      compareAtPrice: 55.0,
      discountPercentage: 23,
      rating: 4.9,
      reviewCount: 142,
      availabilityStatus: "in_stock",
      brand: {
        id: "b7",
        name: "Kuro Studio",
        slug: "kuro-studio",
        isActive: true,
      },
      badges: ["HOT DROP"],
      isFeatured: false,
      isNew: true,
      isActive: true,
    },
    {
      id: "new-4",
      productId: "8",
      name: "Smart MagSafe Stand & Fast Charger",
      slug: "smart-magsafe-stand-fast-charger",
      thumbnailUrl:
        "https://images.unsplash.com/photo-1586953208448-b95a79798f07?auto=format&fit=crop&q=80&w=600",
      price: 58.0,
      compareAtPrice: 75.0,
      discountPercentage: 22,
      rating: 4.8,
      reviewCount: 88,
      availabilityStatus: "in_stock",
      brand: {
        id: "b8",
        name: "VoltCharge",
        slug: "voltcharge",
        isActive: true,
      },
      badges: ["TRENDING"],
      isFeatured: false,
      isNew: true,
      isActive: true,
    },
  ],
  "best-sellers": [
    {
      id: "best-1",
      productId: "9",
      name: "Everyday Stretch Cargo Joggers",
      slug: "everyday-stretch-cargo-joggers",
      thumbnailUrl:
        "https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?auto=format&fit=crop&q=80&w=600",
      price: 68.0,
      compareAtPrice: 85.0,
      discountPercentage: 20,
      rating: 4.9,
      reviewCount: 1240,
      availabilityStatus: "in_stock",
      brand: { id: "b1", name: "Apex Tech", slug: "apex-tech", isActive: true },
      badges: ["BEST SELLER", "#1 IN PANTS"],
      isFeatured: false,
      isNew: false,
      isActive: true,
    },
    {
      id: "best-2",
      productId: "10",
      name: "Merino Wool Thermal Crewneck",
      slug: "merino-wool-thermal-crewneck",
      thumbnailUrl:
        "https://images.unsplash.com/photo-1618354691373-d851c5c3a990?auto=format&fit=crop&q=80&w=600",
      price: 94.0,
      compareAtPrice: 120.0,
      discountPercentage: 21,
      rating: 5.0,
      reviewCount: 880,
      availabilityStatus: "in_stock",
      brand: {
        id: "b9",
        name: "Nordic Wool",
        slug: "nordic-wool",
        isActive: true,
      },
      badges: ["TOP CHOICE"],
      isFeatured: false,
      isNew: false,
      isActive: true,
    },
    {
      id: "best-3",
      productId: "11",
      name: "Retro Heritage Leather Sneakers",
      slug: "retro-heritage-leather-sneakers",
      thumbnailUrl:
        "https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?auto=format&fit=crop&q=80&w=600",
      price: 135.0,
      compareAtPrice: 165.0,
      discountPercentage: 18,
      rating: 4.9,
      reviewCount: 2100,
      availabilityStatus: "in_stock",
      brand: { id: "b2", name: "AeroStep", slug: "aerostep", isActive: true },
      badges: ["POPULAR"],
      isFeatured: false,
      isNew: false,
      isActive: true,
    },
    {
      id: "best-4",
      productId: "12",
      name: "Insulated Double-Wall Steel Flask",
      slug: "insulated-double-wall-steel-flask",
      thumbnailUrl:
        "https://images.unsplash.com/photo-1602143407151-7111542de6e8?auto=format&fit=crop&q=80&w=600",
      price: 36.0,
      compareAtPrice: 48.0,
      discountPercentage: 25,
      rating: 4.8,
      reviewCount: 1560,
      availabilityStatus: "in_stock",
      brand: {
        id: "b10",
        name: "HydroVault",
        slug: "hydrovault",
        isActive: true,
      },
      badges: ["OVER 1K SOLD"],
      isFeatured: false,
      isNew: false,
      isActive: true,
    },
  ],
};

const fetchers = {
  featured: fetchFeaturedProducts,
  "new-arrivals": fetchNewArrivals,
  "best-sellers": fetchBestSellers,
} as const;

// ─── Product Card for Catalog Carousel ────────────────────────────────────────

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
      className="group min-w-[240px] max-w-[240px] sm:min-w-[260px] sm:max-w-[260px] flex flex-col bg-white dark:bg-slate-900/70 dark:backdrop-blur-md rounded-2xl p-3 border border-slate-200/80 dark:border-slate-800/80 hover:border-indigo-500/50 dark:hover:border-indigo-400/50 shadow-xs hover:shadow-lg dark:hover:shadow-[0_8px_30px_rgb(0,0,0,0.5)] transition-all duration-300"
    >
      <div className="relative aspect-[4/5] rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800/60 mb-3">
        {imageSrc ? (
          <MediaImage
            src={imageSrc}
            alt={product.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-400 text-xs">
            No image
          </div>
        )}

        {/* Badges */}
        {product.badges && product.badges.length > 0 && (
          <span className="absolute top-2 left-2 bg-slate-950/85 backdrop-blur-md text-white text-[10px] font-bold px-2 py-0.5 rounded-md shadow-sm">
            {product.badges[0]}
          </span>
        )}

        {product.discountPercentage > 0 && (
          <span className="absolute top-2 right-2 bg-rose-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-md shadow-sm">
            -{product.discountPercentage}%
          </span>
        )}
      </div>

      <div className="flex flex-col flex-1 justify-between gap-2">
        <div>
          {product.brand && (
            <p className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
              {product.brand.name}
            </p>
          )}

          <h3 className="font-bold text-sm text-slate-900 dark:text-white line-clamp-1 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
            {product.name}
          </h3>

          {/* Rating */}
          <div className="flex items-center gap-1.5 mt-1">
            <div className="flex items-center text-amber-400">
              <Star className="w-3.5 h-3.5 fill-amber-400" />
            </div>
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
              {product.rating?.toFixed(1) || "4.9"}
            </span>
            <span className="text-[11px] text-slate-400">
              ({product.reviewCount || 120})
            </span>
          </div>
        </div>

        <div className="flex items-baseline justify-between pt-2 border-t border-slate-100 dark:border-slate-800/80">
          <div className="flex items-baseline gap-2">
            <span className="font-extrabold text-base text-slate-900 dark:text-white">
              ${product.price.toFixed(2)}
            </span>
            {product.compareAtPrice &&
              product.compareAtPrice > product.price && (
                <span className="line-through text-xs text-slate-400">
                  ${product.compareAtPrice.toFixed(2)}
                </span>
              )}
          </div>

          <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 group-hover:translate-x-0.5 transition-transform">
            View &rarr;
          </span>
        </div>
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
  const fetchedProducts = await fetchers[type](limit);
  const products =
    fetchedProducts && fetchedProducts.length > 0
      ? fetchedProducts
      : FALLBACK_PRODUCTS[type];

  const getSectionIcon = () => {
    if (type === "best-sellers")
      return <Flame className="w-5 h-5 text-rose-500" />;
    if (type === "new-arrivals")
      return <Sparkles className="w-5 h-5 text-purple-500" />;
    return <TrendingUp className="w-5 h-5 text-indigo-500" />;
  };

  const getSortParam = () => {
    if (type === "new-arrivals") return "newest";
    if (type === "best-sellers") return "popular";
    return "desc";
  };

  return (
    <section className="my-12">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-6">
        <div>
          <div className="flex items-center gap-2">
            {getSectionIcon()}
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              {title}
            </h2>
          </div>
          {subtitle && (
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
              {subtitle}
            </p>
          )}
        </div>

        <Link
          href={`/products?sort=${getSortParam()}`}
          className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 transition-colors group self-start sm:self-auto"
        >
          <span>See all in collection</span>
          <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
        </Link>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800 -mx-4 px-4 sm:mx-0 sm:px-0">
        {products.map((product) => (
          <CatalogCard key={product.id} product={product} />
        ))}
      </div>
    </section>
  );
};

export default FeaturedSection;
