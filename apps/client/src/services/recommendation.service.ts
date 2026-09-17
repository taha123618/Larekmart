import type {
  RecommendationResponseType,
  InteractionCreateType,
} from "@repo/types";

const RECOMMENDATION_SERVICE_URL =
  process.env.NEXT_PUBLIC_RECOMMENDATION_SERVICE_URL || "http://localhost:8008";

export async function getTrendingRecommendations(
  limit: number = 8,
  categorySlug?: string,
): Promise<RecommendationResponseType | null> {
  try {
    const url = new URL(
      `${RECOMMENDATION_SERVICE_URL}/api/v1/recommendations/trending`,
    );
    url.searchParams.set("limit", limit.toString());
    if (categorySlug) {
      url.searchParams.set("categorySlug", categorySlug);
    }

    const res = await fetch(url.toString(), {
      next: { revalidate: 120 },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function getPersonalizedRecommendations(
  userId: string,
  limit: number = 8,
): Promise<RecommendationResponseType | null> {
  try {
    const url = new URL(
      `${RECOMMENDATION_SERVICE_URL}/api/v1/recommendations/personalized`,
    );
    url.searchParams.set("userId", userId);
    url.searchParams.set("limit", limit.toString());

    const res = await fetch(url.toString(), {
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function getSimilarProducts(
  productId: number | string,
  limit: number = 6,
): Promise<RecommendationResponseType | null> {
  try {
    const res = await fetch(
      `${RECOMMENDATION_SERVICE_URL}/api/v1/recommendations/similar/${productId}?limit=${limit}`,
      { next: { revalidate: 300 } },
    );
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function getFrequentlyBoughtTogether(
  productId: number | string,
  limit: number = 4,
): Promise<RecommendationResponseType | null> {
  try {
    const res = await fetch(
      `${RECOMMENDATION_SERVICE_URL}/api/v1/recommendations/frequently-bought-together/${productId}?limit=${limit}`,
      { next: { revalidate: 300 } },
    );
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function sendInteraction(
  payload: InteractionCreateType,
): Promise<void> {
  try {
    await fetch(`${RECOMMENDATION_SERVICE_URL}/api/v1/interactions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    // Non-blocking interaction telemetry
  }
}

export async function getCartRecommendations(
  productIds: number[],
  limit: number = 4,
): Promise<RecommendationResponseType | null> {
  if (!productIds || productIds.length === 0) {
    return await getTrendingRecommendations(limit);
  }

  // Use primary cart item for frequently bought together recommendations
  const primaryId = productIds[productIds.length - 1];
  if (!primaryId) {
    return await getTrendingRecommendations(limit);
  }

  const fbt = await getFrequentlyBoughtTogether(primaryId, limit);
  if (fbt && fbt.items && fbt.items.length > 0) {
    return fbt;
  }

  // Fallback to similar products of the primary item
  return await getSimilarProducts(primaryId, limit);
}

export async function sendAnalyticsEvent(
  user_id: string,
  product_id: number,
  event_type: "IMPRESSION" | "CLICK" | "ADD_TO_CART" | "PURCHASE",
  strategy: string,
  recommendation_id?: string,
): Promise<void> {
  try {
    await fetch(`${RECOMMENDATION_SERVICE_URL}/api/v1/analytics/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: user_id,
        productId: product_id,
        eventType: event_type,
        strategy,
        recommendationId: recommendation_id,
      }),
    });
  } catch {
    // Non-blocking telemetry
  }
}
