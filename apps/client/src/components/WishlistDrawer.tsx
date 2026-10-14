"use client";

import { useWishlistStore } from "@/stores/wishlistStore";
import { useUIStore } from "@/stores/uiStore";
import useCartStore from "@/stores/cartStore";
import {
  X,
  Heart,
  ShoppingCart,
  Trash2,
  ArrowRight,
  Share2,
  Check,
  TrendingDown,
  AlertTriangle,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@clerk/nextjs";
import MediaImage from "./MediaImage";

interface WishlistDrawerProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export default function WishlistDrawer({
  isOpen,
  onClose,
}: WishlistDrawerProps = {}) {
  const { isWishlistDrawerOpen, closeWishlistDrawer } = useUIStore();
  const effectiveIsOpen = isOpen !== undefined ? isOpen : isWishlistDrawerOpen;
  const effectiveOnClose = onClose || closeWishlistDrawer;

  const { isSignedIn, getToken } = useAuth();
  const {
    items,
    wishlists,
    activeWishlistId,
    activeWishlistName,
    removeFromWishlist,
    clearWishlist,
    syncWithBackend,
    selectWishlist,
    shareActiveWishlist,
  } = useWishlistStore();
  const { addToCart } = useCartStore();

  const [copiedShareLink, setCopiedShareLink] = useState(false);
  const [isSharing, setIsSharing] = useState(false);

  // Sync with backend on open
  useEffect(() => {
    if (effectiveIsOpen) {
      document.body.style.overflow = "hidden";
      if (isSignedIn) {
        getToken().then((token) => {
          if (token) syncWithBackend(token);
        });
      }
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [effectiveIsOpen, isSignedIn, getToken, syncWithBackend]);

  const handleMoveToCart = (item: (typeof items)[0]) => {
    addToCart({
      id: item.id,
      name: item.name,
      price: item.price,
      quantity: 1,
      selectedSize: "m",
      selectedColor: "default",
      shortDescription: "",
      description: "",
      categorySlug: item.categorySlug,
      sizes: ["m"],
      colors: ["default"],
      images: { default: item.image },
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    removeFromWishlist(item.id);
    toast.success(`${item.name} moved to cart!`);
  };

  const handleShareWishlist = async () => {
    if (!isSignedIn) {
      toast.info("Sign in to generate shareable wishlist links!");
      return;
    }

    try {
      setIsSharing(true);
      const token = await getToken();
      if (!token) return;

      const url = await shareActiveWishlist(token);
      if (url) {
        await navigator.clipboard.writeText(url);
        setCopiedShareLink(true);
        toast.success("Share link copied to clipboard!");
        setTimeout(() => setCopiedShareLink(false), 3000);
      }
    } catch {
      toast.error("Failed to share wishlist");
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <AnimatePresence>
      {effectiveIsOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={effectiveOnClose}
            className="fixed inset-0 bg-black/75 backdrop-blur-md cursor-pointer"
          />

          <div className="fixed inset-y-0 right-0 max-w-full flex pl-0 sm:pl-10 pointer-events-none">
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="w-screen max-w-full sm:max-w-md bg-white/95 dark:bg-[#0b0f19]/95 backdrop-blur-2xl border-l border-slate-200/80 dark:border-slate-800/80 shadow-2xl flex flex-col pointer-events-auto h-full text-slate-900 dark:text-slate-100 dark:shadow-[0_25px_60px_-15px_rgba(0,0,0,0.8)]"
            >
              {/* Header */}
              <div className="flex flex-col px-4 sm:px-6 py-4 border-b border-slate-200/80 dark:border-slate-800/80 bg-slate-50/80 dark:bg-slate-900/60 backdrop-blur-md">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400">
                      <Heart className="w-4.5 h-4.5 fill-rose-500 text-rose-500" />
                    </div>
                    <div>
                      <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white leading-tight">
                        {activeWishlistName} ({items.length})
                      </h2>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        {wishlists.length > 1
                          ? `${wishlists.length} lists organized`
                          : "Saved products & price tracker"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    {items.length > 0 && (
                      <button
                        onClick={handleShareWishlist}
                        disabled={isSharing}
                        className="p-2 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                        title="Share Wishlist Link"
                        aria-label="Share Wishlist"
                      >
                        {copiedShareLink ? (
                          <Check className="w-4 h-4 text-emerald-500" />
                        ) : (
                          <Share2 className="w-4 h-4" />
                        )}
                      </button>
                    )}

                    <button
                      onClick={effectiveOnClose}
                      className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 transition cursor-pointer"
                      aria-label="Close wishlist"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* Multiple Wishlists Quick Switcher */}
                {wishlists.length > 1 && (
                  <div className="flex items-center gap-1.5 mt-3 overflow-x-auto pb-1 scrollbar-none">
                    {wishlists.map((w) => {
                      const isActive = w.id === activeWishlistId;
                      return (
                        <button
                          key={w.id}
                          onClick={() => {
                            getToken().then((t) =>
                              selectWishlist(w.id, t || undefined),
                            );
                          }}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold whitespace-nowrap transition cursor-pointer ${
                            isActive
                              ? "bg-rose-500 text-white shadow-sm"
                              : "bg-slate-200/80 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700"
                          }`}
                        >
                          {w.name}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Items */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
                {items.length === 0 ? (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="h-full flex flex-col items-center justify-center text-center py-12"
                  >
                    <div className="w-16 h-16 rounded-full bg-rose-50 dark:bg-rose-950/40 flex items-center justify-center mb-4">
                      <Heart className="w-8 h-8 text-rose-300 dark:text-rose-400" />
                    </div>
                    <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200 mb-1">
                      Your wishlist is empty
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mb-6">
                      Save items you love by tapping the heart icon on any
                      product card.
                    </p>
                    <button
                      onClick={effectiveOnClose}
                      className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition cursor-pointer"
                    >
                      Explore Marketplace
                    </button>
                  </motion.div>
                ) : (
                  <AnimatePresence mode="popLayout">
                    {items.map((item) => {
                      const hasPriceDrop =
                        item.currentPriceInPaisa &&
                        item.addedPriceInPaisa &&
                        item.currentPriceInPaisa < item.addedPriceInPaisa;

                      return (
                        <motion.div
                          layout
                          initial={{ opacity: 0, y: 15 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{
                            opacity: 0,
                            x: 25,
                            transition: { duration: 0.2 },
                          }}
                          transition={{
                            type: "spring",
                            stiffness: 350,
                            damping: 25,
                          }}
                          key={item.id}
                          className="flex gap-4 p-3 rounded-2xl border border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700 bg-white dark:bg-slate-800/80 transition group relative"
                        >
                          <Link
                            href={`/products/${item.id}`}
                            onClick={effectiveOnClose}
                            className="relative w-20 h-20 rounded-xl overflow-hidden bg-slate-50 dark:bg-slate-900 shrink-0"
                          >
                            {item.image ? (
                              <MediaImage
                                src={item.image}
                                alt={item.name}
                                className="w-full h-full object-contain p-1"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-xs text-slate-300 dark:text-slate-600">
                                No image
                              </div>
                            )}
                          </Link>

                          <div className="flex-1 flex flex-col justify-between min-w-0">
                            <div>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <Link
                                  href={`/products/${item.id}`}
                                  onClick={effectiveOnClose}
                                  className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100 line-clamp-1 hover:text-indigo-600 dark:hover:text-indigo-400 transition"
                                >
                                  {item.name}
                                </Link>

                                {hasPriceDrop && (
                                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                                    <TrendingDown className="w-3 h-3" />
                                    Price Drop!
                                  </span>
                                )}

                                {item.inStock === false && (
                                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                                    <AlertTriangle className="w-3 h-3" />
                                    Out of Stock
                                  </span>
                                )}
                              </div>

                              <p className="text-sm font-black text-rose-600 dark:text-rose-400 mt-1">
                                ${item.price.toFixed(2)}
                              </p>
                            </div>

                            <div className="flex items-center justify-between pt-2">
                              <button
                                onClick={() => handleMoveToCart(item)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-600 dark:hover:bg-indigo-600 text-indigo-700 dark:text-indigo-300 hover:text-white text-xs font-bold transition cursor-pointer"
                              >
                                <ShoppingCart className="w-3.5 h-3.5" />
                                <span>Move to Cart</span>
                              </button>

                              <button
                                onClick={() => removeFromWishlist(item.id)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 transition cursor-pointer"
                                title="Remove"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                )}
              </div>

              {/* Footer */}
              {items.length > 0 && (
                <div className="p-5 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <button
                      onClick={() => clearWishlist()}
                      className="text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-rose-600 transition cursor-pointer"
                    >
                      Clear Wishlist
                    </button>

                    <Link
                      href="/wishlist"
                      onClick={effectiveOnClose}
                      className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 cursor-pointer"
                    >
                      <span>Manage All Wishlists</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        </div>
      )}
    </AnimatePresence>
  );
}
