"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Flame, Clock, ShoppingCart, Eye } from "lucide-react";
import useCartStore from "@/stores/cartStore";
import { useUIStore } from "@/stores/uiStore";
import { toast } from "react-toastify";
import type { ProductType } from "@repo/types";
import MediaImage from "./MediaImage";

interface FlashDealsProps {
  products?: ProductType[];
}

export default function FlashDeals({ products = [] }: FlashDealsProps) {
  const { addToCart } = useCartStore();
  const { openQuickView } = useUIStore();

  // Countdown timer state
  const [timeLeft, setTimeLeft] = useState({
    hours: 8,
    minutes: 42,
    seconds: 15,
  });

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev.seconds > 0) {
          return { ...prev, seconds: prev.seconds - 1 };
        } else if (prev.minutes > 0) {
          return { ...prev, minutes: 59, seconds: 59 };
        } else if (prev.hours > 0) {
          return { hours: prev.hours - 1, minutes: 59, seconds: 59 };
        }
        return { hours: 12, minutes: 0, seconds: 0 };
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  if (!products || products.length === 0) {
    return null;
  }

  const handleQuickAdd = (product: ProductType) => {
    const selectedSize = product.sizes?.[0] || "m";
    const selectedColor =
      product.colors?.[0] || Object.keys(product.images || {})[0] || "default";

    addToCart({
      ...product,
      quantity: 1,
      selectedSize,
      selectedColor,
    });
    toast.success(`${product.name} added to cart!`);
  };

  const handleOpenQuickView = (product: ProductType) => {
    openQuickView(product);
  };

  return (
    <section
      id="flash-deals"
      className="my-10 bg-gradient-to-r from-rose-500/10 via-orange-500/10 to-amber-500/10 rounded-3xl p-6 sm:p-8 border border-rose-200/60 shadow-xs"
    >
      {/* Header with Countdown */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-rose-500 to-amber-500 flex items-center justify-center text-white shadow-md shadow-rose-200">
            <Flame className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                Flash Deals
              </h2>
              <span className="px-2 py-0.5 rounded-full bg-rose-500 text-white text-[10px] font-black uppercase tracking-wider">
                Limited Stock
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Refreshes every 24 hours. Grab live deals before stock runs out!
            </p>
          </div>
        </div>

        {/* Ticker */}
        <div className="flex items-center gap-2 bg-white/80 backdrop-blur-xs px-4 py-2 rounded-2xl border border-rose-200 shadow-xs">
          <Clock className="w-4 h-4 text-rose-500" />
          <span className="text-xs font-bold text-slate-600">Ends in:</span>
          <div className="flex items-center gap-1 font-mono text-xs font-black text-white">
            <span className="bg-slate-900 px-2 py-1 rounded-md">
              {String(timeLeft.hours).padStart(2, "0")}
            </span>
            <span className="text-slate-900 font-bold">:</span>
            <span className="bg-slate-900 px-2 py-1 rounded-md">
              {String(timeLeft.minutes).padStart(2, "0")}
            </span>
            <span className="text-slate-900 font-bold">:</span>
            <span className="bg-rose-600 px-2 py-1 rounded-md animate-pulse">
              {String(timeLeft.seconds).padStart(2, "0")}
            </span>
          </div>
        </div>
      </div>

      {/* Grid of Real Flash Products */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {products.map((item) => {
          const imageSrc =
            item.images && Object.values(item.images)[0]
              ? Object.values(item.images)[0]
              : "";
          const originalPrice = item.price * 1.35;
          const soldPercentage = 68 + ((item.id * 7) % 28);

          return (
            <div
              key={item.id}
              className="bg-white rounded-2xl p-4 border border-rose-100 shadow-xs hover:shadow-xl transition-all duration-300 flex flex-col justify-between group relative overflow-hidden hover:-translate-y-1.5"
            >
              {/* Discount Badge */}
              <div className="absolute top-3 left-3 z-10 px-2.5 py-1 bg-rose-600 text-white rounded-xl text-xs font-black shadow-xs">
                -25%
              </div>

              {/* Quick Actions Hover Overlay */}
              <div className="absolute top-3 right-3 z-10 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col gap-1.5">
                <button
                  onClick={() => handleOpenQuickView(item)}
                  className="w-8 h-8 rounded-full bg-white text-slate-700 hover:text-indigo-600 flex items-center justify-center shadow-md transition-transform hover:scale-110 active:scale-95 cursor-pointer"
                  title="Quick view"
                >
                  <Eye className="w-4 h-4" />
                </button>
              </div>

              {/* Image */}
              <Link
                href={`/products/${item.id}`}
                className="relative aspect-square w-full rounded-xl overflow-hidden bg-slate-50 mb-3 flex items-center justify-center"
              >
                {imageSrc ? (
                  <MediaImage
                    src={imageSrc}
                    alt={item.name}
                    className="w-full h-full object-contain p-2 group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xs text-slate-400">
                    No image
                  </div>
                )}
              </Link>

              {/* Content */}
              <div>
                <Link href={`/products/${item.id}`}>
                  <h3 className="text-xs sm:text-sm font-bold text-slate-900 line-clamp-1 hover:text-indigo-600 transition">
                    {item.name}
                  </h3>
                </Link>

                {/* Price */}
                <div className="flex items-baseline gap-2 mt-2">
                  <span className="text-base sm:text-lg font-black text-rose-600">
                    ${item.price.toFixed(2)}
                  </span>
                  <span className="text-xs text-slate-400 line-through">
                    ${originalPrice.toFixed(2)}
                  </span>
                </div>

                {/* Stock Progress Bar */}
                <div className="mt-3">
                  <div className="flex justify-between text-[10px] font-bold text-slate-500 mb-1">
                    <span>Claimed: {soldPercentage}%</span>
                    <span className="text-rose-600">High Demand</span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-amber-500 to-rose-500 rounded-full transition-all duration-500"
                      style={{ width: `${soldPercentage}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Add to Cart Button */}
              <div className="mt-4 pt-3 border-t border-slate-100">
                <button
                  onClick={() => handleQuickAdd(item)}
                  className="w-full py-2 px-3 bg-slate-900 hover:bg-rose-600 text-white rounded-xl text-xs font-bold transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <ShoppingCart className="w-3.5 h-3.5" />
                  <span>Claim Deal</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
