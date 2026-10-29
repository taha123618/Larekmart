"use client";

import useCartStore from "@/stores/cartStore";
import { useWishlistStore } from "@/stores/wishlistStore";
import { useUIStore } from "@/stores/uiStore";
import { ProductType } from "@repo/types";
import {
  Minus,
  Plus,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Zap,
  Heart,
  Tag,
  Coins,
} from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { useAuth } from "@clerk/nextjs";
import { sendInteraction } from "@/services/recommendation.service";
import {
  fetchProductPrice,
  type ProductPricingDetails,
} from "@/services/pricing.service";
import { useCurrencyStore } from "@/stores/currencyStore";
import { getServiceUrl } from "@/services/gateway.service";

interface InventoryAvailabilityResponse {
  data?: {
    productId: number;
    variantId?: string;
    warehouseId?: string;
    availableQuantity: number;
    warehouses: Array<{
      warehouseId: string;
      availableQuantity: number;
      reservedQuantity: number;
      soldQuantity: number;
      status: string;
    }>;
  };
}

const ProductInteraction = ({
  product,
  selectedSize,
  selectedColor,
}: {
  product: ProductType;
  selectedSize: string;
  selectedColor: string;
}) => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { userId: authUserId } = useAuth();
  const effectiveUserId = authUserId || "user_client";
  const [quantity, setQuantity] = useState(1);
  const [inventory, setInventory] = useState<number | null>(null);
  const [isLoadingInventory, setIsLoadingInventory] = useState(false);

  const { addToCart } = useCartStore();
  const { openCartDrawer } = useUIStore();
  const { toggleWishlist, isInWishlist } = useWishlistStore();
  const { currentCurrency, formatPrice } = useCurrencyStore();
  const isFavorited = isInWishlist(product.id);

  const variantId = `${selectedSize}-${selectedColor}`;

  useEffect(() => {
    let isMounted = true;
    const fetchStock = async () => {
      setIsLoadingInventory(true);
      try {
        const inventoryUrl = getServiceUrl(
          process.env.NEXT_PUBLIC_API_GATEWAY_URL,
        );
        const res = await fetch(
          `${inventoryUrl}/api/v1/inventory/${product.id}/availability?variantId=${encodeURIComponent(
            variantId,
          )}`,
        );

        if (res.ok) {
          const json: InventoryAvailabilityResponse = await res.json();
          if (isMounted && json.data) {
            setInventory(json.data.availableQuantity);
            return;
          }
        }
        // Fallback: If no variant record yet, assume standard catalog availability
        if (isMounted) setInventory(50);
      } catch {
        if (isMounted) setInventory(50);
      } finally {
        if (isMounted) setIsLoadingInventory(false);
      }
    };

    fetchStock();

    // Record VIEW interaction for AI recommendations
    sendInteraction({
      userId: effectiveUserId,
      productId: Number(product.id),
      eventType: "VIEW",
      metadata: { categorySlug: product.categorySlug },
    });

    return () => {
      isMounted = false;
    };
  }, [product.id, variantId, product.categorySlug, effectiveUserId]);

  const isOutOfStock = inventory !== null && inventory <= 0;
  const isLowStock = inventory !== null && inventory > 0 && inventory <= 5;

  const [pricingDetails, setPricingDetails] =
    useState<ProductPricingDetails | null>(null);

  useEffect(() => {
    let isMounted = true;
    fetchProductPrice(String(product.id), currentCurrency)
      .then((data) => {
        if (isMounted && data) {
          setPricingDetails(data);
        }
      })
      .catch(() => { });
    return () => {
      isMounted = false;
    };
  }, [product.id, currentCurrency]);

  // Active volume tier discount calculation
  const baseUnitPrice = pricingDetails
    ? Number(pricingDetails.basePrice)
    : product.price;

  const applicableRule = pricingDetails?.rules
    ?.filter(
      (r) =>
        r.isActive &&
        quantity >= r.minQuantity &&
        (!r.maxQuantity || quantity <= r.maxQuantity),
    )
    ?.sort((a, b) => b.minQuantity - a.minQuantity)[0];

  let effectiveUnitPrice = baseUnitPrice;
  let savingsPerUnit = 0;
  if (applicableRule) {
    if (applicableRule.discountType === "percentage") {
      savingsPerUnit =
        (baseUnitPrice * Number(applicableRule.discountValue)) / 100;
      effectiveUnitPrice = Math.max(0, baseUnitPrice - savingsPerUnit);
    } else if (applicableRule.discountType === "fixed_amount") {
      savingsPerUnit = Number(applicableRule.discountValue);
      effectiveUnitPrice = Math.max(0, baseUnitPrice - savingsPerUnit);
    } else if (applicableRule.discountType === "override_price") {
      effectiveUnitPrice = Number(applicableRule.discountValue);
      savingsPerUnit = Math.max(0, baseUnitPrice - effectiveUnitPrice);
    }
  }

  const handleTypeChange = (type: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set(type, value);
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const handleQuantityChange = (type: "increment" | "decrement") => {
    if (type === "increment") {
      if (inventory !== null && quantity >= inventory) {
        toast.info(`Maximum available stock is ${inventory} units`);
        return;
      }
      setQuantity((prev) => prev + 1);
    } else {
      if (quantity > 1) {
        setQuantity((prev) => prev - 1);
      }
    }
  };

  const handleAddToCart = () => {
    if (isOutOfStock) {
      toast.error("This item is currently out of stock");
      return;
    }

    addToCart({
      ...product,
      price: effectiveUnitPrice,
      quantity,
      selectedColor,
      selectedSize,
    });

    // Record ADD_TO_CART interaction for personalized recommendations
    sendInteraction({
      userId: effectiveUserId,
      productId: Number(product.id),
      eventType: "ADD_TO_CART",
      metadata: {
        size: selectedSize,
        color: selectedColor,
        quantity,
        categorySlug: product.categorySlug,
        effectivePrice: effectiveUnitPrice,
      },
    });

    toast.success("Product added to cart");
  };

  return (
    <div className="flex flex-col gap-4 mt-4">
      {/* REAL-TIME INVENTORY STATUS BADGE */}
      <div className="flex items-center gap-2">
        {isLoadingInventory ? (
          <span className="text-xs text-gray-400 animate-pulse">
            Checking warehouse stock...
          </span>
        ) : isOutOfStock ? (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200 dark:border-rose-900/60">
            <XCircle className="w-3.5 h-3.5" />
            Out of Stock
          </span>
        ) : isLowStock ? (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200 dark:border-amber-900/60 animate-pulse">
            <AlertCircle className="w-3.5 h-3.5" />
            Low Stock — only {inventory} left!
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/60">
            <CheckCircle2 className="w-3.5 h-3.5" />
            In Stock ({inventory} units available)
          </span>
        )}
      </div>

      {/* SIZE */}
      <div className="flex flex-col gap-2 text-xs">
        <span className="text-gray-500 dark:text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
          Select Size
        </span>
        <div className="flex items-center gap-2">
          {product.sizes.map((size) => (
            <div
              className={`cursor-pointer border p-[2px] rounded-xl transition-all duration-200 ${selectedSize === size
                  ? "border-indigo-600 ring-2 ring-indigo-500/40 ring-offset-1 ring-offset-white dark:ring-offset-slate-900"
                  : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
                }`}
              key={size}
              onClick={() => handleTypeChange("size", size)}
            >
              <div
                className={`w-8 h-8 text-xs font-bold rounded-lg text-center flex items-center justify-center transition ${selectedSize === size
                    ? "bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-xs"
                    : "bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"
                  }`}
              >
                {size.toUpperCase()}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* COLOR */}
      <div className="flex flex-col gap-2 text-sm">
        <span className="text-gray-500 dark:text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
          Select Color:{" "}
          <span className="text-slate-900 dark:text-white capitalize">
            {selectedColor}
          </span>
        </span>
        <div className="flex items-center gap-2.5">
          {product.colors.map((color) => (
            <div
              className={`cursor-pointer border p-[2px] rounded-full transition-all duration-200 ${selectedColor === color
                  ? "border-indigo-600 ring-2 ring-indigo-500/50 ring-offset-2 ring-offset-white dark:ring-offset-slate-900 scale-110"
                  : "border-transparent hover:border-slate-300 dark:hover:border-slate-600 opacity-80 hover:opacity-100"
                }`}
              key={color}
              onClick={() => handleTypeChange("color", color)}
            >
              <div
                className="w-6 h-6 rounded-full border border-black/10 dark:border-white/10"
                style={{ backgroundColor: color }}
              />
            </div>
          ))}
        </div>
      </div>

      {/* QUANTITY */}
      <div className="flex flex-col gap-2 text-sm">
        <span className="text-gray-500 dark:text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
          Quantity
        </span>
        <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800/80 p-1 rounded-xl border border-slate-200/80 dark:border-slate-700/80 w-fit">
          <button
            className="cursor-pointer border border-slate-200 dark:border-slate-700 p-1.5 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 transition"
            disabled={isOutOfStock}
            onClick={() => handleQuantityChange("decrement")}
            aria-label="Decrease quantity"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
          <span className="px-3 font-black text-sm text-slate-900 dark:text-white min-w-[2rem] text-center">
            {quantity}
          </span>
          <button
            className="cursor-pointer border border-slate-200 dark:border-slate-700 p-1.5 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 transition"
            disabled={
              isOutOfStock || (inventory !== null && quantity >= inventory)
            }
            onClick={() => handleQuantityChange("increment")}
            aria-label="Increase quantity"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* AUTHORITATIVE PRICING & VOLUME DISCOUNT TIERS */}
      {pricingDetails && (
        <div className="flex flex-col gap-2 p-3 bg-amber-500/5 dark:bg-amber-500/10 border border-amber-500/20 rounded-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
              <Coins className="w-3.5 h-3.5" />
              Authoritative Price:
            </span>
            <div className="flex items-baseline gap-2">
              {savingsPerUnit > 0 && (
                <span className="text-xs text-slate-400 line-through">
                  {formatPrice(baseUnitPrice)}
                </span>
              )}
              <span className="text-sm font-bold text-slate-900 dark:text-white">
                {formatPrice(effectiveUnitPrice)}{" "}
                <span className="text-[10px] text-slate-500">/ unit</span>
              </span>
            </div>
          </div>

          {/* Active Savings Alert */}
          {savingsPerUnit > 0 && (
            <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-semibold bg-emerald-500/10 px-2 py-1 rounded-lg">
              <Tag className="w-3.5 h-3.5" />
              Volume tier unlocked! You save{" "}
              {formatPrice(savingsPerUnit * quantity)} on this order
            </div>
          )}

          {/* Available Tier Rules Pills */}
          {pricingDetails.rules && pricingDetails.rules.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {pricingDetails.rules.map((rule) => (
                <span
                  key={rule.id}
                  className={`text-[10px] px-2 py-0.5 rounded-full border transition ${quantity >= rule.minQuantity
                      ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-700 dark:text-emerald-300 font-semibold"
                      : "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400"
                    }`}
                >
                  Buy {rule.minQuantity}+{": "}
                  {rule.discountType === "percentage"
                    ? `${rule.discountValue}% OFF`
                    : `${formatPrice(Number(rule.discountValue))} OFF`}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* BUTTONS */}
      <div className="flex flex-col sm:flex-row gap-3 pt-2">
        <button
          onClick={handleAddToCart}
          disabled={isOutOfStock}
          className={`flex-1 px-5 py-3.5 rounded-xl shadow-md flex items-center justify-center gap-2 text-sm font-bold transition-all duration-200 active:scale-[0.98] ${isOutOfStock
              ? "bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed"
              : "bg-gradient-to-r from-indigo-600 via-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white cursor-pointer shadow-indigo-500/20 hover:shadow-lg hover:shadow-indigo-500/25"
            }`}
        >
          <Plus className="w-4 h-4" />
          {isOutOfStock ? "Out of Stock" : "Add to Cart"}
        </button>

        <button
          onClick={() => {
            handleAddToCart();
            openCartDrawer();
          }}
          disabled={isOutOfStock}
          className={`flex-1 px-5 py-3.5 rounded-xl flex items-center justify-center gap-2 text-sm font-bold transition-all duration-200 active:scale-[0.98] ${isOutOfStock
              ? "border border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed"
              : "bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 text-white cursor-pointer shadow-md hover:shadow-lg border border-slate-700/50"
            }`}
        >
          <Zap className="w-4 h-4 text-amber-400 fill-amber-400" />
          {isOutOfStock ? "Unavailable" : "Buy Now"}
        </button>

        <button
          type="button"
          onClick={() => {
            const added = toggleWishlist(product);
            if (added) toast.success("Saved to wishlist!");
            else toast.info("Removed from wishlist");
          }}
          className={`p-3.5 rounded-xl border transition-all duration-200 flex items-center justify-center cursor-pointer active:scale-95 ${isFavorited
              ? "bg-rose-50 dark:bg-rose-950/50 border-rose-200 dark:border-rose-900/60 text-rose-600 dark:text-rose-400 shadow-xs"
              : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-rose-600 hover:border-rose-200 dark:hover:border-rose-800"
            }`}
          title={isFavorited ? "Saved to Wishlist" : "Save to Wishlist"}
          aria-label="Toggle Wishlist"
        >
          <Heart
            className={`w-5 h-5 ${isFavorited ? "fill-rose-500 text-rose-500" : ""}`}
          />
        </button>
      </div>
    </div>
  );
};

export default ProductInteraction;
