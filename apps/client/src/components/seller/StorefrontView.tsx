"use client";

import { useState } from "react";
import ProductCard from "@/components/ProductCard";
import type { ProductType } from "@repo/types";
import type { PublicStorefrontResponse } from "@/services/seller.service";
import {
  Store,
  ShieldCheck,
  Star,
  Clock,
  Truck,
  RotateCcw,
  FileText,
  Search,
  CheckCircle,
  Share2,
  SlidersHorizontal,
  PackageCheck,
  Building,
} from "lucide-react";
import { toast } from "react-toastify";

interface StorefrontViewProps {
  storefront: PublicStorefrontResponse;
  initialProducts?: ProductType[];
}

export function StorefrontView({
  storefront,
  initialProducts = [],
}: StorefrontViewProps) {
  const { store, policies, seller } = storefront;

  const [activeTab, setActiveTab] = useState<"products" | "about" | "policies">(
    "products",
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"featured" | "price_asc" | "price_desc">(
    "featured",
  );

  const filteredProducts = initialProducts
    .filter((p) => p.name.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === "price_asc") return a.price - b.price;
      if (sortBy === "price_desc") return b.price - a.price;
      return 0;
    });

  const handleShare = () => {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(window.location.href);
      toast.success("Store link copied to clipboard!");
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-[#0b0f19] text-neutral-900 dark:text-neutral-100 pb-16">
      {/* STORE HERO BANNER */}
      <div className="relative w-full h-52 sm:h-64 md:h-80 bg-gradient-to-r from-indigo-900 via-purple-900 to-slate-900 overflow-hidden">
        <div className="absolute inset-0 opacity-20 bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:16px_16px]" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />

        {/* Floating Verified & Status Pill */}
        <div className="absolute top-4 right-4 flex items-center gap-2">
          {store.vacationMode ? (
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/90 text-white backdrop-blur-md flex items-center gap-1.5 shadow-lg">
              <Clock className="h-3.5 w-3.5" />
              On Vacation
            </span>
          ) : (
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/90 text-white backdrop-blur-md flex items-center gap-1.5 shadow-lg">
              <CheckCircle className="h-3.5 w-3.5" />
              Open for Orders
            </span>
          )}
          <button
            onClick={handleShare}
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white backdrop-blur-md transition-colors"
            title="Share Store"
          >
            <Share2 className="h-4 w-4" />
          </button>
        </div>

        {/* Store Title & Badges at bottom of banner */}
        <div className="absolute bottom-6 left-6 right-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="h-20 w-20 sm:h-24 sm:w-24 rounded-2xl bg-white dark:bg-neutral-800 p-1 shadow-2xl flex items-center justify-center border-2 border-white/20">
              <div className="h-full w-full rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white">
                <Store className="h-10 w-10 sm:h-12 sm:w-12" />
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                  {store.name}
                </h1>
                <ShieldCheck className="h-6 w-6 text-emerald-400 fill-emerald-400/20" />
              </div>

              {store.headline && (
                <p className="text-sm text-neutral-300 mt-0.5 max-w-xl line-clamp-1">
                  {store.headline}
                </p>
              )}

              <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-neutral-300">
                <span className="flex items-center text-amber-400 font-semibold">
                  <Star className="h-3.5 w-3.5 fill-amber-400 mr-1" />
                  4.9 (1.2k+ ratings)
                </span>
                <span>•</span>
                <span className="text-emerald-300 font-medium flex items-center gap-1">
                  <PackageCheck className="h-3.5 w-3.5" />
                  99% Fulfillment Rate
                </span>
                <span>•</span>
                <span className="font-mono text-neutral-300">
                  Currency: {seller.primaryCurrency}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* VACATION NOTICE ALERT (if active) */}
      {store.vacationMode && (
        <div className="max-w-7xl mx-auto px-4 mt-4">
          <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 text-sm flex items-start gap-3">
            <Clock className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Store is currently taking a break</p>
              <p className="text-xs mt-0.5 text-neutral-600 dark:text-neutral-400">
                {store.vacationMessage ||
                  "The seller is currently on vacation. Orders placed now will be fulfilled once the store reopens."}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* NAVIGATION TABS */}
      <div className="max-w-7xl mx-auto px-4 mt-6">
        <div className="flex items-center justify-between border-b border-neutral-200 dark:border-neutral-800 pb-2">
          <div className="flex gap-4">
            <button
              onClick={() => setActiveTab("products")}
              className={`pb-2 text-sm font-semibold transition-colors border-b-2 flex items-center gap-2 ${
                activeTab === "products"
                  ? "border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400"
                  : "border-transparent text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100"
              }`}
            >
              <Store className="h-4 w-4" />
              Products ({filteredProducts.length})
            </button>
            <button
              onClick={() => setActiveTab("about")}
              className={`pb-2 text-sm font-semibold transition-colors border-b-2 flex items-center gap-2 ${
                activeTab === "about"
                  ? "border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400"
                  : "border-transparent text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100"
              }`}
            >
              <Building className="h-4 w-4" />
              About Store
            </button>
            <button
              onClick={() => setActiveTab("policies")}
              className={`pb-2 text-sm font-semibold transition-colors border-b-2 flex items-center gap-2 ${
                activeTab === "policies"
                  ? "border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400"
                  : "border-transparent text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100"
              }`}
            >
              <ShieldCheck className="h-4 w-4" />
              Policies & Shipping ({policies.length})
            </button>
          </div>
        </div>

        {/* TAB CONTENT: PRODUCTS */}
        {activeTab === "products" && (
          <div className="mt-6 space-y-6">
            {/* Search & Sort Toolbar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-white dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-3 h-4 w-4 text-neutral-400" />
                <input
                  type="text"
                  placeholder="Search store inventory..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 border border-transparent"
                />
              </div>

              <div className="flex items-center gap-2">
                <SlidersHorizontal className="h-4 w-4 text-neutral-400" />
                <span className="text-xs text-neutral-500">Sort by:</span>
                <select
                  value={sortBy}
                  onChange={(e) =>
                    setSortBy(
                      e.target.value as "featured" | "price_asc" | "price_desc",
                    )
                  }
                  className="px-3 py-1.5 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="featured">Featured / Best Match</option>
                  <option value="price_asc">Price: Low to High</option>
                  <option value="price_desc">Price: High to Low</option>
                </select>
              </div>
            </div>

            {/* Product Grid */}
            {filteredProducts.length === 0 ? (
              <div className="text-center py-16 bg-white dark:bg-neutral-900/30 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-8">
                <Store className="mx-auto h-12 w-12 text-neutral-400 mb-3" />
                <h3 className="text-lg font-bold">No Products Found</h3>
                <p className="text-sm text-neutral-500 mt-1">
                  {searchQuery
                    ? `No items in ${store.name} match "${searchQuery}".`
                    : "This storefront currently has no public catalog items listed."}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 gap-4 sm:gap-6">
                {filteredProducts.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB CONTENT: ABOUT */}
        {activeTab === "about" && (
          <div className="mt-6 grid gap-6 md:grid-cols-3">
            <div className="md:col-span-2 space-y-6">
              <div className="p-6 rounded-2xl bg-white dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800">
                <h2 className="text-lg font-bold mb-3">About {store.name}</h2>
                <div className="text-sm text-neutral-600 dark:text-neutral-300 leading-relaxed whitespace-pre-line">
                  {store.description ||
                    `${store.name} is a verified marketplace vendor on Larekmart dedicated to providing premium authentic products, expedited logistics, and reliable customer support.`}
                </div>
              </div>

              <div className="p-6 rounded-2xl bg-white dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800">
                <h3 className="text-base font-bold mb-3 flex items-center gap-2">
                  <PackageCheck className="h-5 w-5 text-indigo-500" />
                  Merchant Commitments
                </h3>
                <div className="grid sm:grid-cols-2 gap-4 text-xs">
                  <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-700">
                    <span className="font-semibold text-neutral-900 dark:text-neutral-100">
                      100% Genuine Guaranteed
                    </span>
                    <p className="text-neutral-500 mt-0.5">
                      All inventory is verified and directly sourced from
                      registered manufacturers.
                    </p>
                  </div>
                  <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-700">
                    <span className="font-semibold text-neutral-900 dark:text-neutral-100">
                      Buyer Protection Included
                    </span>
                    <p className="text-neutral-500 mt-0.5">
                      Every order is backed by Larekmart&apos;s secure checkout
                      and dispute resolution.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Side Info Box */}
            <div className="space-y-4">
              <div className="p-5 rounded-2xl bg-white dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800 text-xs space-y-3">
                <h3 className="font-bold text-sm">Store Information</h3>
                <div>
                  <span className="text-neutral-400">Merchant Status</span>
                  <div className="font-semibold text-emerald-600 mt-0.5">
                    Verified Seller
                  </div>
                </div>
                <div>
                  <span className="text-neutral-400">Primary Currency</span>
                  <div className="font-semibold mt-0.5">
                    {seller.primaryCurrency}
                  </div>
                </div>
                <div>
                  <span className="text-neutral-400">Storefront URL</span>
                  <div className="font-mono text-indigo-500 mt-0.5 truncate">
                    /stores/{store.slug}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB CONTENT: POLICIES */}
        {activeTab === "policies" && (
          <div className="mt-6 space-y-6">
            {policies.length === 0 ? (
              <div className="p-8 text-center rounded-2xl bg-white dark:bg-neutral-900/30 border border-neutral-200 dark:border-neutral-800">
                <ShieldCheck className="mx-auto h-10 w-10 text-emerald-500 mb-2" />
                <h3 className="font-bold">
                  Standard Marketplace Policies Apply
                </h3>
                <p className="text-xs text-neutral-500 mt-1 max-w-md mx-auto">
                  This seller adheres to Larekmart&apos;s standard 30-day
                  hassle-free return policy and standard carrier delivery
                  timelines.
                </p>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {policies?.map((p) => (
                  <div
                    key={p.id}
                    className="p-5 rounded-2xl bg-white dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800 space-y-2"
                  >
                    <div className="flex items-center gap-2 font-bold text-sm text-neutral-900 dark:text-neutral-100">
                      {p.policyType === "SHIPPING" ? (
                        <Truck className="h-4 w-4 text-indigo-500" />
                      ) : p.policyType === "RETURNS" ? (
                        <RotateCcw className="h-4 w-4 text-emerald-500" />
                      ) : (
                        <FileText className="h-4 w-4 text-blue-500" />
                      )}
                      <span>{p.title}</span>
                      <span className="text-xs text-neutral-400 font-normal ml-auto">
                        v{p.version}
                      </span>
                    </div>
                    <p className="text-xs text-neutral-600 dark:text-neutral-300 leading-relaxed whitespace-pre-line">
                      {p.content}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
