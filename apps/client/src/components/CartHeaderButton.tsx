"use client";

import useCartStore from "@/stores/cartStore";
import { useUIStore } from "@/stores/uiStore";
import { ShoppingBag } from "lucide-react";
import { useState, useEffect } from "react";

export default function CartHeaderButton() {
  const { cart, serverCart, hasHydrated } = useCartStore();
  const { openCartDrawer } = useUIStore();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted || !hasHydrated) {
    return (
      <div className="flex items-center gap-2 p-2 rounded-xl text-slate-400">
        <ShoppingBag className="w-5 h-5" />
      </div>
    );
  }

  const count =
    serverCart && serverCart.items && serverCart.items.length > 0
      ? serverCart.items.reduce((acc, item) => acc + item.quantity, 0)
      : cart.reduce((acc, item) => acc + item.quantity, 0);

  const subtotal = cart.reduce(
    (acc, item) => acc + item.price * item.quantity,
    0,
  );

  return (
    <button
      onClick={openCartDrawer}
      className="flex items-center gap-2.5 p-2 rounded-xl hover:bg-slate-100/80 dark:hover:bg-slate-800/80 transition group cursor-pointer"
      aria-label={`Shopping cart with ${count} items`}
    >
      <div className="relative">
        <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 flex items-center justify-center group-hover:bg-indigo-100 dark:group-hover:bg-indigo-900/60 transition">
          <ShoppingBag className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
        </div>
        {count > 0 && (
          <span className="absolute -top-1 -right-1 bg-indigo-600 text-white text-[10px] font-extrabold w-4 h-4 rounded-full flex items-center justify-center shadow-xs">
            {count}
          </span>
        )}
      </div>

      <div className="hidden xl:flex flex-col text-left">
        <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
          My Cart
        </span>
        <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
          ${subtotal.toFixed(2)}
        </span>
      </div>
    </button>
  );
}
