import {
  fetchStorefront,
  fetchSystemSettings,
  type PublicStorefrontResponse,
} from "@/services/seller.service";
import { StorefrontView } from "@/components/seller/StorefrontView";
import type { ProductType } from "@repo/types";
import Link from "next/link";
import { Store } from "lucide-react";

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
      headline:
        "Official Flagship Store • Premium Electronics & Lifestyle Goods",
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
  const storefront =
    (await fetchStorefront(slug)) || getFallbackStorefront(slug);

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

  const settings = await fetchSystemSettings();
  if (!settings.isSellerEnabled || !settings.isStorefrontsActive) {
    return (
      <main className="min-h-[60vh] flex items-center justify-center px-4 py-16">
        <div className="max-w-md w-full text-center space-y-4 p-8 rounded-2xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-950/20 shadow-sm">
          <div className="w-12 h-12 mx-auto rounded-full bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center text-amber-600 dark:text-amber-400">
            <Store className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">
            Marketplace Stores Temporarily Paused
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            {settings.maintenanceMessage ||
              "Marketplace storefronts and independent merchant stores are currently paused for routine maintenance. Please check back later or continue exploring our catalog."}
          </p>
          <div className="pt-2">
            <Link
              href="/products"
              className="inline-flex items-center justify-center px-4 py-2 rounded-xl text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700 transition"
            >
              Browse All Products
            </Link>
          </div>
        </div>
      </main>
    );
  }

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
