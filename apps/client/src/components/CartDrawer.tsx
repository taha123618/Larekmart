"use client";

import { useUIStore } from "@/stores/uiStore";
import useCartStore from "@/stores/cartStore";
import { X, ShoppingBag, Plus, Minus, Trash2, ArrowRight } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import MediaImage from "./MediaImage";

export default function CartDrawer() {
  const { isCartDrawerOpen, closeCartDrawer } = useUIStore();
  const { cart, removeFromCart, updateQuantity } = useCartStore();
  const subtotal = cart.reduce(
    (acc, item) => acc + item.price * item.quantity,
    0,
  );

  // Prevent background scroll when drawer is open
  useEffect(() => {
    if (isCartDrawerOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isCartDrawerOpen]);

  return (
    <AnimatePresence>
      {isCartDrawerOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={closeCartDrawer}
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
              <div className="flex items-center justify-between px-4 sm:px-6 py-4.5 border-b border-slate-200/80 dark:border-slate-800/80 bg-slate-50/80 dark:bg-slate-900/60 backdrop-blur-md">
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">
                    <ShoppingBag className="w-4.5 h-4.5" />
                  </div>
                  <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                    Shopping Cart (
                    {cart.reduce((acc, i) => acc + i.quantity, 0)})
                  </h2>
                </div>

                <button
                  onClick={closeCartDrawer}
                  className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-full hover:bg-gray-200 dark:hover:bg-slate-800 transition cursor-pointer"
                  aria-label="Close cart"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Cart Items List */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
                {cart.length === 0 ? (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="h-full flex flex-col items-center justify-center text-center py-12"
                  >
                    <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
                      <ShoppingBag className="w-8 h-8 text-slate-400" />
                    </div>
                    <h3 className="text-base font-medium text-gray-900 dark:text-white mb-1">
                      Your cart is empty
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-slate-400 max-w-xs mb-6">
                      Explore our marketplace collections and discover trending
                      deals.
                    </p>
                    <button
                      onClick={closeCartDrawer}
                      className="px-6 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition cursor-pointer"
                    >
                      Start Shopping
                    </button>
                  </motion.div>
                ) : (
                  <AnimatePresence mode="popLayout">
                    {cart.map((item) => {
                      const itemImg =
                        (item.images as Record<string, string>)?.[
                          item.selectedColor || ""
                        ] ||
                        (item.images ? Object.values(item.images)[0] : "") ||
                        "/placeholder.png";

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
                          key={`${item.id}-${item.selectedSize}-${item.selectedColor}`}
                          className="flex gap-4 p-3 rounded-xl border border-gray-100 dark:border-slate-800 hover:border-gray-200 dark:hover:border-slate-700 transition bg-white dark:bg-slate-800/80 shadow-xs"
                        >
                          <div className="relative w-20 h-20 rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-900 shrink-0 flex items-center justify-center">
                            {itemImg ? (
                              <MediaImage
                                src={itemImg}
                                alt={item.name}
                                className="w-full h-full object-contain p-1"
                              />
                            ) : (
                              <div className="text-xs text-gray-400 dark:text-slate-500">
                                No image
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="text-sm font-medium text-gray-900 dark:text-slate-100 truncate">
                              {item.name}
                            </h4>
                            <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                              {item.selectedSize &&
                                `Size: ${item.selectedSize.toUpperCase()}`}
                              {item.selectedColor &&
                                ` • Color: ${item.selectedColor}`}
                            </p>
                            {(item as { sellerName?: string }).sellerName && (
                              <p className="text-[11px] text-indigo-600 dark:text-indigo-400 mt-0.5 truncate font-medium">
                                Sold by{" "}
                                {(item as { sellerName?: string }).sellerName}
                              </p>
                            )}
                            <div className="flex items-center justify-between mt-3">
                              <div className="flex items-center border border-gray-200 dark:border-slate-700 rounded-lg">
                                <button
                                  onClick={() => {
                                    if (item.quantity > 1) {
                                      updateQuantity(item, item.quantity - 1);
                                    } else {
                                      removeFromCart(item);
                                    }
                                  }}
                                  className="p-1 hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-600 dark:text-slate-300 transition cursor-pointer"
                                >
                                  <Minus className="w-3.5 h-3.5" />
                                </button>
                                <span className="px-2 text-xs font-semibold text-gray-800 dark:text-slate-200">
                                  {item.quantity}
                                </span>
                                <button
                                  onClick={() =>
                                    updateQuantity(item, item.quantity + 1)
                                  }
                                  className="p-1 hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-600 dark:text-slate-300 transition cursor-pointer"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                </button>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="text-sm font-semibold text-gray-900 dark:text-slate-100">
                                  ${(item.price * item.quantity).toFixed(2)}
                                </span>
                                <button
                                  onClick={() => removeFromCart(item)}
                                  className="text-gray-400 hover:text-red-500 transition cursor-pointer"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                )}
              </div>

              {/* Footer & Checkout */}
              {cart.length > 0 && (
                <div className="p-6 border-t border-gray-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 space-y-4">
                  <div className="flex items-center justify-between text-base font-semibold text-gray-900 dark:text-white">
                    <span>Subtotal</span>
                    <span>${subtotal.toFixed(2)}</span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-slate-400">
                    Taxes, shipping and promotion discounts calculated at
                    checkout.
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <Link
                      href="/cart"
                      onClick={closeCartDrawer}
                      className="w-full py-3 px-4 rounded-xl border border-slate-300 dark:border-slate-700 text-center text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition active:scale-95"
                    >
                      View Cart
                    </Link>
                    <Link
                      href="/cart"
                      onClick={closeCartDrawer}
                      className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-center text-xs sm:text-sm font-bold transition flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/25 active:scale-95"
                    >
                      <span>Checkout</span>
                      <ArrowRight className="w-4 h-4" />
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
