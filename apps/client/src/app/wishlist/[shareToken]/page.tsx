"use client";

import { useEffect, useState, use } from "react";
import { fetchSharedWishlist } from "@/services/wishlist.service";
import type { SharedWishlistResponse, WishlistItem } from "@repo/types";
import useCartStore from "@/stores/cartStore";
import {
  Heart,
  ShoppingCart,
  ExternalLink,
  Package,
  Calendar,
  Lock,
  ArrowLeft,
  Check,
} from "lucide-react";
import Link from "next/link";
import { toast } from "react-toastify";

interface SharedWishlistPageProps {
  params: Promise<{
    shareToken: string;
  }>;
}

export default function SharedWishlistPage({
  params,
}: SharedWishlistPageProps) {
  const resolvedParams = use(params);
  const shareToken = resolvedParams.shareToken;

  const [data, setData] = useState<SharedWishlistResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { addToCart } = useCartStore();

  useEffect(() => {
    async function load() {
      try {
        setIsLoading(true);
        const result = await fetchSharedWishlist(shareToken);
        setData(result);
      } catch (err: any) {
        setError(err.message || "Shared wishlist not found or has expired.");
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, [shareToken]);

  const handleAddToCart = (item: SharedWishlistResponse["items"][0]) => {
    addToCart({
      id: Number(item.productId) || 1,
      name: item.note || `Product #${item.productId}`,
      price: item.currentPrice
        ? Number(item.currentPrice)
        : Number(item.addedPrice),
      quantity: 1,
      selectedSize: "m",
      selectedColor: "default",
      shortDescription: "",
      description: "",
      categorySlug: "general",
      sizes: ["m"],
      colors: ["default"],
      images: { default: "" },
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    toast.success("Added item to your cart!");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#070b14] flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 rounded-full border-4 border-indigo-600 border-t-transparent animate-spin mx-auto" />
          <p className="text-sm text-slate-500 font-medium">
            Loading shared wishlist...
          </p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#070b14] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white dark:bg-slate-900 rounded-3xl p-8 border border-slate-200 dark:border-slate-800 text-center shadow-xl">
          <div className="w-16 h-16 rounded-2xl bg-rose-50 dark:bg-rose-950/50 text-rose-500 flex items-center justify-center mx-auto mb-4">
            <Lock className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
            Wishlist Unavailable
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">
            {error || "This shared link is invalid or may have expired."}
          </p>
          <Link
            href="/products"
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to Marketplace</span>
          </Link>
        </div>
      </div>
    );
  }

  const { wishlist, items, permission } = data;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#070b14] text-slate-900 dark:text-slate-100 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Banner */}
        <div className="bg-white dark:bg-slate-900/80 p-6 sm:p-8 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-rose-50 dark:bg-rose-950/50 flex items-center justify-center text-rose-500 shadow-sm shrink-0">
              <Heart className="w-7 h-7 fill-rose-500" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
                  {wishlist.name}
                </h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300">
                  Shared {permission}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-2">
                <Calendar className="w-3.5 h-3.5" />
                <span>
                  Created on {new Date(wishlist.createdAt).toLocaleDateString()}
                </span>
                <span>•</span>
                <span>{items.length} saved products</span>
              </p>
            </div>
          </div>

          <Link
            href="/products"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 transition"
          >
            <Package className="w-4 h-4" />
            <span>Browse More Products</span>
          </Link>
        </div>

        {/* Items List */}
        {items.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-12 text-center border border-slate-200 dark:border-slate-800">
            <p className="text-sm text-slate-500">
              This shared wishlist currently has no items.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {items.map((item: WishlistItem) => (
              <div
                key={item.id}
                className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-sm hover:shadow-lg transition flex flex-col justify-between space-y-4"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                      Product #{item.productId}
                    </span>
                    {item.inStock ? (
                      <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                        In Stock
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold text-amber-500">
                        Out of Stock
                      </span>
                    )}
                  </div>

                  <h3 className="text-base font-bold text-slate-900 dark:text-white mt-2 line-clamp-2">
                    {item.note || `Saved Product #${item.productId}`}
                  </h3>

                  <div className="mt-2 text-xl font-black text-rose-600 dark:text-rose-400">
                    $
                    {item.currentPrice
                      ? Number(item.currentPrice).toFixed(2)
                      : Number(item.addedPrice).toFixed(2)}
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <button
                    onClick={() => handleAddToCart(item)}
                    className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-600/20 transition cursor-pointer"
                  >
                    <ShoppingCart className="w-3.5 h-3.5" />
                    <span>Buy This Gift</span>
                  </button>

                  <Link
                    href={`/products/${item.productId}`}
                    className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition"
                    title="View Product"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
