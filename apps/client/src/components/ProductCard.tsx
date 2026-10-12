"use client";

import { useState, useEffect } from "react";
import useCartStore from "@/stores/cartStore";
import { useWishlistStore } from "@/stores/wishlistStore";
import { useUIStore } from "@/stores/uiStore";
import { ProductType } from "@repo/types";
import { ShoppingCart, Heart, Eye, Star } from "lucide-react";
import Link from "next/link";
import { toast } from "react-toastify";
import MediaImage from "./MediaImage";

interface ProductCardProps {
  product: ProductType & {
    rating?: number;
    reviewCount?: number;
  };
}

export default function ProductCard({ product }: ProductCardProps) {
  const defaultColor =
    (product.colors && product.colors[0]) ||
    (product.images ? Object.keys(product.images)[0] : "") ||
    "default";
  const defaultSize = (product.sizes && product.sizes[0]) || "m";

  const [productTypes, setProductTypes] = useState({
    size: defaultSize,
    color: defaultColor,
  });

  const { addToCart } = useCartStore();
  const { toggleWishlist, isInWishlist } = useWishlistStore();
  const { openQuickView } = useUIStore();

  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
  }, []);

  const isFavorited = isMounted ? isInWishlist(product.id) : false;

  const handleProductType = ({
    type,
    value,
  }: {
    type: "size" | "color";
    value: string;
  }) => {
    setProductTypes((prev) => ({
      ...prev,
      [type]: value,
    }));
  };

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    addToCart({
      ...product,
      quantity: 1,
      selectedSize: productTypes.size,
      selectedColor: productTypes.color,
    });
    toast.success(`${product.name} added to cart!`);
  };

  const handleWishlistClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const added = toggleWishlist(product);
    if (added) {
      toast.success("Saved to wishlist!");
    } else {
      toast.info("Removed from wishlist");
    }
  };

  const handleQuickViewClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    openQuickView(product);
  };

  const originalPrice = product.price * 1.3;
  const discountPercent = Math.round(((originalPrice - product.price) / originalPrice) * 100);

  const activeImage =
    (product.images as Record<string, string>)?.[productTypes.color] ||
    (product.images ? Object.values(product.images)[0] : "") ||
    "";

  return (
    <div className="group bg-white rounded-2xl border border-slate-200/80 hover:border-indigo-500/60 shadow-xs hover:shadow-xl transition-all duration-300 flex flex-col justify-between overflow-hidden relative hover:-translate-y-1">
      {/* BADGES & QUICK ACTIONS OVERLAY */}
      <div className="absolute top-3 left-3 z-20 flex flex-col gap-1.5 pointer-events-none">
        <span className="px-2 py-0.5 rounded-lg bg-rose-600 text-white text-[10px] font-black uppercase tracking-wider shadow-xs">
          -{discountPercent}%
        </span>
        <span className="px-2 py-0.5 rounded-lg bg-indigo-600 text-white text-[10px] font-bold tracking-wider shadow-xs hidden group-hover:inline-block transition">
          Top Pick
        </span>
      </div>

      <div className="absolute top-3 right-3 z-20 flex flex-col gap-1.5 opacity-90 group-hover:opacity-100 transition">
        <button
          suppressHydrationWarning
          onClick={handleWishlistClick}
          className={`w-8 h-8 rounded-full flex items-center justify-center transition-all hover:scale-110 active:scale-95 shadow-xs cursor-pointer ${
            isFavorited
              ? "bg-rose-50 text-rose-500 border border-rose-200"
              : "bg-white/90 backdrop-blur-xs text-slate-500 hover:text-rose-500 hover:bg-white"
          }`}
          title={isFavorited ? "Remove from wishlist" : "Save to wishlist"}
          aria-label="Wishlist"
        >
          <Heart className={`w-4 h-4 ${isFavorited ? "fill-rose-500 text-rose-500" : ""}`} />
        </button>

        <button
          onClick={handleQuickViewClick}
          className="w-8 h-8 rounded-full bg-white/90 backdrop-blur-xs text-slate-500 hover:text-indigo-600 hover:bg-white flex items-center justify-center transition-all hover:scale-110 active:scale-95 shadow-xs opacity-0 group-hover:opacity-100 cursor-pointer"
          title="Quick preview"
          aria-label="Quick preview"
        >
          <Eye className="w-4 h-4" />
        </button>
      </div>

      {/* PRODUCT IMAGE */}
      <Link href={`/products/${product.id}`} className="block relative aspect-[4/5] bg-slate-50 overflow-hidden">
        <MediaImage
          src={activeImage}
          alt={product.name}
          className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-500"
        />
      </Link>

      {/* PRODUCT DETAILS */}
      <div className="p-4 flex flex-col gap-3 flex-1 justify-between">
        <div>
          {/* Category & Rating */}
          <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
            <span className="uppercase font-semibold tracking-wider text-indigo-600 truncate max-w-[120px]">
              {product.categorySlug || "Marketplace"}
            </span>
            {product.rating ? (
              <div className="flex items-center gap-1 text-amber-500 font-bold">
                <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                <span>{Number(product.rating).toFixed(1)}</span>
                {product.reviewCount ? (
                  <span className="text-slate-400 font-normal">
                    ({product.reviewCount})
                  </span>
                ) : null}
              </div>
            ) : (
              <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                Verified Item
              </span>
            )}
          </div>

          {/* Product Name */}
          <Link href={`/products/${product.id}`}>
            <h3 className="font-bold text-sm text-slate-900 group-hover:text-indigo-600 transition line-clamp-1">
              {product.name}
            </h3>
          </Link>

          {/* Description */}
          <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">
            {product.shortDescription || "High quality guaranteed marketplace item."}
          </p>

          {/* COLOR SWATCHES & SIZES */}
          <div className="flex items-center justify-between gap-2 mt-3 pt-2 border-t border-slate-100">
            {/* Colors */}
            <div className="flex items-center gap-1">
              {product.colors && product.colors.length > 0 &&
                product.colors.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      handleProductType({ type: "color", value: color });
                    }}
                    className={`w-4 h-4 rounded-full border transition-transform hover:scale-125 active:scale-90 p-0.5 cursor-pointer ${
                      productTypes.color === color
                        ? "border-indigo-600 scale-110"
                        : "border-slate-300 opacity-80"
                    }`}
                    title={color}
                  >
                    <div
                      className="w-full h-full rounded-full"
                      style={{ backgroundColor: color }}
                    />
                  </button>
                ))}
            </div>

            {/* Sizes */}
            {product.sizes && product.sizes.length > 0 && (
              <select
                value={productTypes.size}
                onChange={(e) =>
                  handleProductType({ type: "size", value: e.target.value })
                }
                className="text-[11px] font-semibold text-slate-600 bg-slate-50 border border-slate-200 rounded-md px-1.5 py-0.5 outline-hidden hover:border-slate-300 cursor-pointer"
              >
                {product.sizes.map((s) => (
                  <option key={s} value={s}>
                    {s.toUpperCase()}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* PRICING & ADD TO CART */}
        <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
          <div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-base sm:text-lg font-black text-slate-900">
                ${product.price.toFixed(2)}
              </span>
              <span className="text-xs text-slate-400 line-through">
                ${originalPrice.toFixed(2)}
              </span>
            </div>
            <span className="text-[10px] text-emerald-600 font-bold block">
              Free Shipping
            </span>
          </div>

          <button
            onClick={handleAddToCart}
            className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all hover:scale-[1.03] active:scale-[0.97] flex items-center gap-1.5 shadow-xs hover:shadow-md cursor-pointer shrink-0"
            title="Add to cart"
            aria-label="Add to cart"
          >
            <ShoppingCart className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Add</span>
          </button>
        </div>
      </div>
    </div>
  );
}
