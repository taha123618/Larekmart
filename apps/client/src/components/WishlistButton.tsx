"use client";

import { useWishlistStore } from "@/stores/wishlistStore";
import { useUIStore } from "@/stores/uiStore";
import { Heart } from "lucide-react";
import { useState, useEffect } from "react";

export default function WishlistButton() {
  const { items } = useWishlistStore();
  const { openWishlistDrawer } = useUIStore();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const count = isMounted ? items.length : 0;

  return (
    <button
      onClick={openWishlistDrawer}
      className="relative flex items-center gap-1.5 p-2 rounded-xl text-slate-700 hover:text-rose-600 hover:bg-slate-100/80 transition cursor-pointer"
      title="Saved Wishlist"
      aria-label="Wishlist"
    >
      <div className="relative">
        <Heart
          className={`w-5 h-5 ${count > 0 ? "text-rose-500 fill-rose-50" : ""}`}
        />
        {count > 0 && (
          <span className="absolute -top-1.5 -right-2 bg-rose-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center animate-pulse">
            {count}
          </span>
        )}
      </div>
      <span className="hidden lg:inline text-xs font-semibold">Wishlist</span>
    </button>
  );
}
