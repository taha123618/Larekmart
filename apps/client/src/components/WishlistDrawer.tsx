"use client";

import { useWishlistStore } from "@/stores/wishlistStore";
import { useUIStore } from "@/stores/uiStore";
import useCartStore from "@/stores/cartStore";
import { X, Heart, ShoppingCart, Trash2, ArrowRight } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";
import { toast } from "react-toastify";
import { motion, AnimatePresence } from "framer-motion";
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

  const { items, removeFromWishlist, clearWishlist } = useWishlistStore();
  const { addToCart } = useCartStore();

  useEffect(() => {
    if (effectiveIsOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [effectiveIsOpen]);

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
            className="fixed inset-0 bg-black/50 backdrop-blur-xs cursor-pointer"
          />

          <div className="fixed inset-y-0 right-0 max-w-full flex pl-0 sm:pl-10 pointer-events-none">
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="w-screen max-w-full sm:max-w-md bg-white shadow-2xl flex flex-col pointer-events-auto h-full"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-slate-100 bg-slate-50">
                <div className="flex items-center gap-2">
                  <Heart className="w-5 h-5 text-rose-500 fill-rose-500" />
                  <h2 className="text-base sm:text-lg font-bold text-slate-900">
                    My Wishlist ({items.length})
                  </h2>
                </div>
                <button
                  onClick={effectiveOnClose}
                  className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-200 transition cursor-pointer"
                  aria-label="Close wishlist"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Items */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
                {items.length === 0 ? (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="h-full flex flex-col items-center justify-center text-center py-12"
                  >
                    <div className="w-16 h-16 rounded-full bg-rose-50 flex items-center justify-center mb-4">
                      <Heart className="w-8 h-8 text-rose-300" />
                    </div>
                    <h3 className="text-base font-semibold text-slate-800 mb-1">
                      Your wishlist is empty
                    </h3>
                    <p className="text-xs text-slate-500 max-w-xs mb-6">
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
                    {items.map((item) => (
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
                        className="flex gap-4 p-3 rounded-2xl border border-slate-100 hover:border-slate-200 bg-white transition group"
                      >
                        <Link
                          href={`/products/${item.id}`}
                          onClick={effectiveOnClose}
                          className="relative w-20 h-20 rounded-xl overflow-hidden bg-slate-50 shrink-0"
                        >
                          {item.image ? (
                            <MediaImage
                              src={item.image}
                              alt={item.name}
                              className="w-full h-full object-contain p-1"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-xs text-slate-300">
                              No image
                            </div>
                          )}
                        </Link>

                        <div className="flex-1 flex flex-col justify-between min-w-0">
                          <div>
                            <Link
                              href={`/products/${item.id}`}
                              onClick={effectiveOnClose}
                              className="text-xs sm:text-sm font-bold text-slate-900 line-clamp-1 hover:text-indigo-600 transition"
                            >
                              {item.name}
                            </Link>
                            <p className="text-sm font-black text-rose-600 mt-1">
                              ${item.price.toFixed(2)}
                            </p>
                          </div>

                          <div className="flex items-center justify-between pt-2">
                            <button
                              onClick={() => handleMoveToCart(item)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-600 text-indigo-700 hover:text-white text-xs font-bold transition cursor-pointer"
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
                    ))}
                  </AnimatePresence>
                )}
              </div>

              {/* Footer */}
              {items.length > 0 && (
                <div className="p-6 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
                  <button
                    onClick={clearWishlist}
                    className="text-xs font-semibold text-slate-500 hover:text-rose-600 transition cursor-pointer"
                  >
                    Clear Wishlist
                  </button>

                  <Link
                    href="/products"
                    onClick={effectiveOnClose}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-700 cursor-pointer"
                  >
                    <span>Continue Shopping</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              )}
            </motion.div>
          </div>
        </div>
      )}
    </AnimatePresence>
  );
}
