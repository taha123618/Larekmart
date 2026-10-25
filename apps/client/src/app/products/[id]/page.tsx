import type React from "react";
import ProductInteraction from "@/components/ProductInteraction";
import RecommendationSection from "@/components/RecommendationSection";
import ProductGallery from "@/components/ProductGallery";
import ProductTabs from "@/components/ProductTabs";
import { ProductType } from "@repo/types";
import { SellerBadge } from "@/components/seller/SellerBadge";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

const fetchProduct = async (id: string): Promise<ProductType | null> => {
  try {
    const productServiceUrl =
      process.env.NEXT_PUBLIC_PRODUCT_SERVICE_URL ||
      process.env.NEXT_PUBLIC_API_GATEWAY_URL ||
      "http://localhost:8090";
    const res = await fetch(`${productServiceUrl}/products/${id}`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data || typeof data !== "object" || !("id" in data)) return null;
    return data as ProductType;
  } catch {
    return null;
  }
};

export const generateMetadata = async ({
  params,
}: {
  params: Promise<{ id: string }>;
}) => {
  const { id } = await params;

  const product = await fetchProduct(id);
  if (!product) {
    return {
      title: "Product Not Found",
      description: "The requested product does not exist.",
    };
  }

  return {
    title: product.name,
    description: product.description,
  };
};

const ProductPage = async ({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ color?: string; size?: string }>;
}): Promise<React.JSX.Element> => {
  const { size, color } = await searchParams;
  const { id } = await params;

  const product = await fetchProduct(id);

  if (!product) {
    notFound();
  }

  const selectedSize =
    size ||
    (Array.isArray(product.sizes) && product.sizes[0]
      ? (product.sizes[0] as string)
      : "m");
  const selectedColor =
    color ||
    (Array.isArray(product.colors) && product.colors[0]
      ? (product.colors[0] as string)
      : "black");

  return (
    <div className="py-8">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mb-6">
        <Link
          href="/"
          className="hover:text-indigo-600 dark:hover:text-indigo-400 transition"
        >
          Home
        </Link>
        <span>/</span>
        <Link
          href={`/products?category=${product.categorySlug}`}
          className="hover:text-indigo-600 dark:hover:text-indigo-400 transition uppercase"
        >
          {product.categorySlug || "Marketplace"}
        </Link>
        <span>/</span>
        <span className="text-slate-900 dark:text-white font-semibold truncate max-w-xs">
          {product.name}
        </span>
      </nav>

      <div className="bg-white/95 dark:bg-slate-900/70 dark:backdrop-blur-xl rounded-3xl border border-slate-200/80 dark:border-slate-800/80 dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)] p-6 sm:p-10 shadow-xs flex flex-col lg:flex-row gap-8 lg:gap-14">
        {/* IMAGE GALLERY */}

        <div className="w-full lg:w-5/12">
          <ProductGallery
            images={product.images as Record<string, string>}
            productName={product.name}
            selectedColor={selectedColor}
          />
        </div>

        {/* DETAILS */}
        <div className="w-full lg:w-7/12 flex flex-col justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-900/60 text-xs font-bold uppercase tracking-wider">
                {product.categorySlug || "Marketplace"}
              </span>
              <span className="text-xs text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200/80 dark:border-emerald-900/60 px-2.5 py-1 rounded-full flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Verified Seller
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight leading-tight">
              {product.name}
            </h1>

            {/* Price & Discount */}
            <div className="mt-4 flex items-baseline gap-3">
              <span className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white">
                $
                {typeof product.price === "number"
                  ? product.price.toFixed(2)
                  : "0.00"}
              </span>
              <span className="text-base text-slate-400 dark:text-slate-500 line-through">
                $
                {typeof product.price === "number"
                  ? (product.price * 1.3).toFixed(2)
                  : "0.00"}
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-gradient-to-r from-rose-600 to-pink-600 text-white text-xs font-black uppercase tracking-wider shadow-sm shadow-rose-950/30">
                Save 23%
              </span>
            </div>

            <p className="text-sm text-slate-600 dark:text-slate-300 mt-4 leading-relaxed">
              {product.description || product.shortDescription}
            </p>

            {/* Verified Merchant Badge */}
            <div className="mt-4">
              <SellerBadge
                storeName={product.sellerName || "Larekmart Official Store"}
                storeSlug={
                  product.sellerName
                    ? product.sellerName
                        .toLowerCase()
                        .replace(/[^a-z0-9]+/g, "-")
                        .replace(/(^-|-$)/g, "")
                    : "larekmart-official"
                }
                rating={4.9}
                isVerified={true}
              />
            </div>

            {/* Micro-guarantee strip */}
            <div className="grid grid-cols-2 gap-3 my-6 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800/80 text-xs">
              <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300 font-semibold">
                <span className="w-4 h-4 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-[10px]">
                  ✓
                </span>
                <span>Free 3-5 day delivery</span>
              </div>
              <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300 font-semibold">
                <span className="w-4 h-4 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-[10px]">
                  ✓
                </span>
                <span>30-Day Hassle-free Returns</span>
              </div>
            </div>

            <ProductInteraction
              product={product}
              selectedSize={selectedSize}
              selectedColor={selectedColor}
            />
          </div>

          {/* PAYMENT TRUST */}
          <div className="pt-6 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2 mb-2">
              <Image
                src="/klarna.png"
                alt="klarna"
                width={40}
                height={20}
                className="rounded-md"
              />
              <Image
                src="/cards.png"
                alt="cards"
                width={40}
                height={20}
                className="rounded-md"
              />
              <Image
                src="/stripe.png"
                alt="stripe"
                width={40}
                height={20}
                className="rounded-md"
              />
            </div>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 leading-normal">
              Safe & encrypted checkout. Prices include all applicable taxes.
              Covered by Larekmart 100% Buyer Protection Guarantee.
            </p>
          </div>
        </div>
      </div>

      {/* SPECIFICATIONS, REVIEWS & SHIPPING TABS */}
      <ProductTabs product={product} />

      {/* RECOMMENDATIONS */}
      <div className="mt-16 flex flex-col gap-12 border-t border-slate-200 dark:border-slate-800 pt-12">
        <RecommendationSection
          title="Frequently Bought Together"
          subtitle="Customers who purchased this item also loved"
          type="frequently_bought_together"
          productId={product.id}
          limit={4}
        />
        <RecommendationSection
          title="Similar Styles You May Like"
          subtitle="AI-powered visual and semantic similarity recommendations"
          type="similar"
          productId={product.id}
          categorySlug={product.categorySlug}
          limit={4}
        />
      </div>
    </div>
  );
};

export default ProductPage;
