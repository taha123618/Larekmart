"use client";

import { useUIStore } from "@/stores/uiStore";
import useCartStore from "@/stores/cartStore";
import { useWishlistStore } from "@/stores/wishlistStore";
import {
  X,
  ShoppingCart,
  Heart,
  Star,
  CheckCircle,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { useState, useEffect } from "react";
import { toast } from "react-toastify";
import type { ProductType } from "@repo/types";
import { motion, AnimatePresence } from "framer-motion";
import MediaImage from "./MediaImage";

type ProductWithRating = ProductType & {
  rating?: number;
  reviewCount?: number;
};

export default function QuickViewModal() {
  const { quickViewProduct, closeQuickView } = useUIStore();
  const { addToCart } = useCartStore();
  const { toggleWishlist, isInWishlist } = useWishlistStore();

  const [selectedSize, setSelectedSize] = useState<string>("");
  const [selectedColor, setSelectedColor] = useState<string>("");
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    if (quickViewProduct) {
      const defColor =
        (quickViewProduct.colors && quickViewProduct.colors[0]) ||
        (quickViewProduct.images
          ? Object.keys(quickViewProduct.images)[0]
          : "") ||
        "default";
      const defSize =
        (quickViewProduct.sizes && quickViewProduct.sizes[0]) || "m";
      setSelectedSize(defSize);
      setSelectedColor(defColor);
      setQuantity(1);
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [quickViewProduct]);

  const inWishlist = quickViewProduct
    ? isInWishlist(quickViewProduct.id)
    : false;

  const activeImage = quickViewProduct
    ? (quickViewProduct.images as Record<string, string>)?.[selectedColor] ||
      (quickViewProduct.images
        ? Object.values(quickViewProduct.images)[0]
        : "") ||
      "/placeholder.png"
    : "/placeholder.png";

  const handleAddToCart = () => {
    if (!quickViewProduct) return;
    addToCart({
      ...quickViewProduct,
      quantity,
      selectedSize,
      selectedColor,
    });
    toast.success(`${quickViewProduct.name} added to cart!`);
    closeQuickView();
  };

  const handleWishlistToggle = () => {
    if (!quickViewProduct) return;
    const added = toggleWishlist(quickViewProduct);
    if (added) {
      toast.success("Saved to wishlist!");
    } else {
      toast.info("Removed from wishlist");
    }
  };

  return (
    <AnimatePresence>
      {quickViewProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={closeQuickView}
            className="fixed inset-0 bg-black/60 backdrop-blur-xs cursor-pointer"
          />

          {/* Modal Dialog */}
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 15 }}
            transition={{ type: "spring", damping: 26, stiffness: 320 }}
            className="relative w-full max-w-3xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl overflow-hidden z-10 border border-slate-100 dark:border-slate-800 flex flex-col md:flex-row pointer-events-auto max-h-[92vh] overflow-y-auto text-slate-900 dark:text-slate-100"
          >
            {/* Close Button */}
            <button
              onClick={closeQuickView}
              className="absolute top-4 right-4 z-20 p-2 text-slate-400 hover:text-slate-700 dark:hover:text-white bg-white/80 dark:bg-slate-800/80 hover:bg-white dark:hover:bg-slate-800 rounded-full shadow-xs transition cursor-pointer"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Product Image Gallery */}
            <div className="w-full md:w-1/2 bg-slate-50 dark:bg-slate-950 p-4 sm:p-6 flex flex-col items-center justify-center relative min-h-[260px] sm:min-h-[320px]">
              <div className="relative w-full aspect-square max-w-[280px] rounded-xl overflow-hidden bg-white dark:bg-slate-900 shadow-xs flex items-center justify-center">
                {activeImage ? (
                  <MediaImage
                    src={activeImage}
                    alt={quickViewProduct.name}
                    className="w-full h-full object-contain p-2"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xs text-slate-300 dark:text-slate-600">
                    No image
                  </div>
                )}
              </div>

              {/* Color Switcher Preview */}
              {quickViewProduct.colors.length > 1 && (
                <div className="flex items-center gap-2 mt-4">
                  {quickViewProduct.colors.map((color) => (
                    <button
                      key={color}
                      onClick={() => setSelectedColor(color)}
                      className={`w-7 h-7 rounded-full border-2 transition p-0.5 cursor-pointer ${
                        selectedColor === color
                          ? "border-indigo-600 scale-110"
                          : "border-transparent opacity-80 hover:opacity-100"
                      }`}
                      title={color}
                    >
                      <div
                        className="w-full h-full rounded-full border border-slate-200 dark:border-slate-700"
                        style={{ backgroundColor: color }}
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Product Info & Actions */}
            <div className="w-full md:w-1/2 p-6 flex flex-col justify-between">
              <div>
                {/* Category & Badge */}
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 mb-2">
                  <span>{quickViewProduct.categorySlug || "Marketplace"}</span>
                  <span className="text-slate-300 dark:text-slate-600">•</span>
                  <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <CheckCircle className="w-3.5 h-3.5" /> In Stock
                  </span>
                </div>

                <h3 className="text-xl font-bold text-slate-900 dark:text-white leading-snug">
                  {quickViewProduct.name}
                </h3>

                {/* Rating / Guarantee */}
                {(quickViewProduct as ProductWithRating).rating ? (
                  <div className="flex items-center gap-2 mt-2">
                    <div className="flex items-center text-amber-400">
                      {[...Array(5)].map((_, i) => {
                        const r =
                          (quickViewProduct as ProductWithRating).rating ?? 0;
                        return (
                          <Star
                            key={i}
                            className={`w-4 h-4 ${
                              r >= i + 1
                                ? "fill-amber-400 text-amber-400"
                                : "text-slate-300 dark:text-slate-600"
                            }`}
                          />
                        );
                      })}
                    </div>
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      {Number(
                        (quickViewProduct as ProductWithRating).rating,
                      ).toFixed(1)}
                    </span>
                    {(quickViewProduct as ProductWithRating).reviewCount ? (
                      <span className="text-xs text-slate-400 dark:text-slate-500">
                        ({(quickViewProduct as ProductWithRating).reviewCount}{" "}
                        reviews)
                      </span>
                    ) : null}
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mt-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span>Verified Marketplace Guarantee</span>
                  </div>
                )}

                {/* Price */}
                <div className="mt-4 flex items-baseline gap-3">
                  <span className="text-2xl font-extrabold text-slate-900 dark:text-white">
                    ${quickViewProduct.price.toFixed(2)}
                  </span>
                  <span className="text-sm text-slate-400 dark:text-slate-500 line-through">
                    ${(quickViewProduct.price * 1.35).toFixed(2)}
                  </span>
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400">
                    26% OFF
                  </span>
                </div>

                <p className="text-xs text-slate-500 dark:text-slate-400 mt-3 line-clamp-3 leading-relaxed">
                  {quickViewProduct.shortDescription ||
                    quickViewProduct.description ||
                    "Premium quality item backed by Larekmart Buyer Protection and free returns within 30 days."}
                </p>

                {/* Size Selector */}
                {quickViewProduct.sizes.length > 0 && (
                  <div className="mt-4">
                    <div className="flex justify-between text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                      <span>Size:</span>
                      <span className="font-bold uppercase text-indigo-600 dark:text-indigo-400">
                        {selectedSize}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {quickViewProduct.sizes.map((size) => (
                        <button
                          key={size}
                          onClick={() => setSelectedSize(size)}
                          className={`px-3 py-1 text-xs font-semibold rounded-lg border transition cursor-pointer ${
                            selectedSize === size
                              ? "border-indigo-600 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 shadow-xs"
                              : "border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800"
                          }`}
                        >
                          {size.toUpperCase()}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Quantity */}
                <div className="mt-4 flex items-center gap-3">
                  <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    Quantity:
                  </span>
                  <div className="flex items-center border border-slate-200 dark:border-slate-700 rounded-lg">
                    <button
                      onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                      className="px-2.5 py-1 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-l-lg transition cursor-pointer"
                    >
                      -
                    </button>
                    <span className="px-3 text-xs font-bold text-slate-800 dark:text-slate-200">
                      {quantity}
                    </span>
                    <button
                      onClick={() => setQuantity((q) => Math.min(10, q + 1))}
                      className="px-2.5 py-1 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-r-lg transition cursor-pointer"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>

              {/* Action CTAs */}
              <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-col gap-2.5">
                <div className="flex gap-2">
                  <button
                    onClick={handleAddToCart}
                    className="flex-1 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 shadow-md shadow-indigo-100 dark:shadow-none transition cursor-pointer"
                  >
                    <ShoppingCart className="w-4 h-4" />
                    Add to Cart
                  </button>
                  <button
                    onClick={handleWishlistToggle}
                    className={`p-2.5 rounded-xl border transition cursor-pointer ${
                      inWishlist
                        ? "border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 text-rose-500"
                        : "border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:text-rose-500 hover:bg-slate-50 dark:hover:bg-slate-800"
                    }`}
                    title={
                      inWishlist ? "Remove from Wishlist" : "Add to Wishlist"
                    }
                  >
                    <Heart
                      className={`w-5 h-5 ${inWishlist ? "fill-rose-500" : ""}`}
                    />
                  </button>
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-400 dark:text-slate-500">
                  <div className="flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>Buyer Protection Guarantee</span>
                  </div>
                  <Link
                    href={`/products/${quickViewProduct.id}`}
                    onClick={closeQuickView}
                    className="text-indigo-600 dark:text-indigo-400 hover:underline font-semibold"
                  >
                    Full Product Details &rarr;
                  </Link>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
