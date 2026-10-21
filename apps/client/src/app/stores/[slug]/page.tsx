import { fetchStorefront, type PublicStorefrontResponse } from "@/services/seller.service";
import { StorefrontView } from "@/components/seller/StorefrontView";
import type { ProductType } from "@repo/types";

// Fallback demo storefront for instant exploration if database is newly initialized
function getFallbackStorefront(slug: string): PublicStorefrontResponse {
  const formattedName = slug
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

  return {
    store: {
      id: "demo-store-001",
      sellerId: "demo-seller-001",
      name: formattedName || "Larekmart Prime Merchant",
      slug,
      headline: "Official Flagship Store • Premium Electronics & Lifestyle Goods",
      description: `${formattedName} is an authorized flagship merchant on Larekmart. We deliver certified authentic merchandise, expedited carrier shipping, and seamless customer service across the country.`,
      status: "ACTIVE",
      vacationMode: false,
    },
    seller: {
      id: "demo-seller-001",
      primaryCurrency: "USD",
      status: "ACTIVE",
      onboardedAt: new Date().toISOString(),
    },
    policies: [
      {
        id: "pol-1",
        policyType: "SHIPPING",
        title: "Expedited & Standard Shipping",
        content:
          "Orders placed before 2:00 PM are dispatched on the same business day via standard or express courier. Tracking numbers are uploaded automatically upon carrier handoff.",
        version: 1,
      },
      {
        id: "pol-2",
        policyType: "RETURNS",
        title: "30-Day Hassle-Free Returns",
        content:
          "Unopened or defective items may be returned within 30 days of delivery for a replacement or full refund through Larekmart's Customer Returns Center.",
        version: 1,
      },
    ],
  };
}

async function fetchStoreProducts(): Promise<ProductType[]> {
  try {
    const productServiceUrl =
      process.env.NEXT_PUBLIC_PRODUCT_SERVICE_URL ||
      process.env.NEXT_PUBLIC_API_GATEWAY_URL ||
      "http://localhost:8090";

    const res = await fetch(`${productServiceUrl}/products?limit=8`, {
      next: { revalidate: 60 },
    });

    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : data.products || [];
  } catch {
    return [];
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const storefront = (await fetchStorefront(slug)) || getFallbackStorefront(slug);

  return {
    title: `${storefront.store.name} - Larekmart Merchant Storefront`,
    description:
      storefront.store.headline ||
      `Shop official products from ${storefront.store.name} on Larekmart Marketplace.`,
  };
}

export default async function StorefrontPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  let storefront = await fetchStorefront(slug);

  // If not found in backend DB, provide demo flagship profile for seamless exploration
  if (!storefront) {
    storefront = getFallbackStorefront(slug);
  }

  const products = await fetchStoreProducts();

  return (
    <main>
      <StorefrontView storefront={storefront} initialProducts={products} />
    </main>
  );
}
