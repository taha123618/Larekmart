"use client";

import { useEffect, useState } from "react";
import { ProductType, RecommendationItemType } from "@repo/types";
import { useAuth } from "@clerk/nextjs";
import {
  getCartRecommendations,
  getCategoryRecommendations,
  getFrequentlyBoughtTogether,
  getPersonalizedRecommendations,
  getRecentlyViewedRecommendations,
  getSimilarProducts,
  getTrendingRecommendations,
  sendAnalyticsEvent,
} from "@/services/recommendation.service";
import ProductCard from "./ProductCard";
import { Sparkles, TrendingUp, Flame, ShoppingBag, Clock } from "lucide-react";

interface RecommendationSectionProps {
  title: string;
  subtitle?: string;
  type:
    | "trending"
    | "personalized"
    | "similar"
    | "frequently_bought_together"
    | "cart"
    | "category"
    | "recently_viewed";
  productId?: number | string;
  productIds?: number[];
  categorySlug?: string;
  userId?: string;
  limit?: number;
}

export default function RecommendationSection({
  title,
  subtitle,
  type,
  productId,
  productIds,
  categorySlug,
  userId,
  limit = 4,
}: RecommendationSectionProps) {
  const { userId: authUserId } = useAuth();
  const effectiveUserId = userId || authUserId || "user_demo";

  const [products, setProducts] = useState<
    Array<{ product: ProductType; item: RecommendationItemType }>
  >([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function loadRecommendations() {
      setIsLoading(true);
      try {
        let recResponse = null;

        if (type === "cart" && productIds && productIds.length > 0) {
          recResponse = await getCartRecommendations(productIds, limit);
        } else if (type === "trending") {
          recResponse = await getTrendingRecommendations(limit, categorySlug);
        } else if (type === "personalized") {
          recResponse = await getPersonalizedRecommendations(effectiveUserId, limit);
        } else if (type === "similar" && productId) {
          recResponse = await getSimilarProducts(productId, limit);
        } else if (type === "frequently_bought_together" && productId) {
          recResponse = await getFrequentlyBoughtTogether(productId, limit);
        } else if (type === "category" && categorySlug) {
          recResponse = await getCategoryRecommendations(categorySlug, limit);
        } else if (type === "recently_viewed") {
          recResponse = await getRecentlyViewedRecommendations(effectiveUserId, limit);
        }

        if (
          !recResponse ||
          !recResponse.items ||
          recResponse.items.length === 0
        ) {
          if (isMounted) setIsLoading(false);
          return;
        }

        // Fetch product details for the recommended IDs
        const productUrl =
          process.env.NEXT_PUBLIC_PRODUCT_SERVICE_URL ||
          "http://localhost:8000";

        const fetched = await Promise.all(
          recResponse.items.map(async (item) => {
            try {
              const res = await fetch(
                `${productUrl}/products/${item.productId}`,
              );
              if (!res.ok) return null;
              const prod: ProductType = await res.json();
              return { product: prod, item };
            } catch {
              return null;
            }
          }),
        );

        if (isMounted) {
          const valid = fetched.filter(
            (p): p is { product: ProductType; item: RecommendationItemType } =>
              p !== null,
          );
          setProducts(valid);

          // Report impressions for telemetry
          valid.forEach(({ item }) => {
            sendAnalyticsEvent(
              effectiveUserId,
              item.productId,
              "IMPRESSION",
              item.strategy || type,
            );
          });
        }
      } catch {
        // Fallback silently if offline
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadRecommendations();

    return () => {
      isMounted = false;
    };
  }, [type, productId, productIds, categorySlug, effectiveUserId, limit]);

  if (isLoading || products.length === 0) {
    return null;
  }

  const getIcon = () => {
    if (type === "trending")
      return <Flame className="w-5 h-5 text-orange-500" />;
    if (type === "personalized")
      return <Sparkles className="w-5 h-5 text-purple-500" />;
    if (type === "cart")
      return <ShoppingBag className="w-5 h-5 text-emerald-500" />;
    if (type === "category")
      return <Sparkles className="w-5 h-5 text-indigo-500" />;
    if (type === "recently_viewed")
      return <Clock className="w-5 h-5 text-amber-500" />;
    return <TrendingUp className="w-5 h-5 text-blue-500" />;
  };

  return (
    <section className="my-12">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2">
            {getIcon()}
            <h2 className="text-xl md:text-2xl font-semibold tracking-tight text-gray-900">
              {title}
            </h2>
          </div>
          {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {products.map(({ product, item }) => (
          <div key={product.id} className="relative group">
            {item.reason && (
              <div className="absolute top-2 left-2 z-10 bg-black/75 backdrop-blur-md text-white text-[11px] font-medium px-2 py-0.5 rounded-full shadow-sm">
                {Math.round(item.score * 100)}% Match
              </div>
            )}
            <div
              onClick={() => {
                sendAnalyticsEvent(
                  effectiveUserId,
                  item.productId,
                  "CLICK",
                  item.strategy || type,
                );
              }}
            >
              <ProductCard product={product} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
