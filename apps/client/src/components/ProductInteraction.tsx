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
} from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { useAuth } from "@clerk/nextjs";
import { sendInteraction } from "@/services/recommendation.service";

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
  const isFavorited = isInWishlist(product.id);

  const variantId = `${selectedSize}-${selectedColor}`;

  useEffect(() => {
    let isMounted = true;
    const fetchStock = async () => {
      setIsLoadingInventory(true);
      try {
        const inventoryUrl =
          process.env.NEXT_PUBLIC_INVENTORY_SERVICE_URL ||
          process.env.NEXT_PUBLIC_API_GATEWAY_URL ||
          "http://localhost:8090";
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
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200">
            <XCircle className="w-3.5 h-3.5" />
            Out of Stock
          </span>
        ) : isLowStock ? (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200 animate-pulse">
            <AlertCircle className="w-3.5 h-3.5" />
            Low Stock — only {inventory} left!
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5" />
            In Stock ({inventory} units available)
          </span>
        )}
      </div>

      {/* SIZE */}
      <div className="flex flex-col gap-2 text-xs">
        <span className="text-gray-500">Size</span>
        <div className="flex items-center gap-2">
          {product.sizes.map((size) => (
            <div
              className={`cursor-pointer border-1 p-[2px] ${
                selectedSize === size ? "border-gray-600" : "border-gray-300"
              }`}
              key={size}
              onClick={() => handleTypeChange("size", size)}
            >
              <div
                className={`w-6 h-6 text-center flex items-center justify-center ${
                  selectedSize === size
                    ? "bg-black text-white"
                    : "bg-white text-black"
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
        <span className="text-gray-500">Color</span>
        <div className="flex items-center gap-2">
          {product.colors.map((color) => (
            <div
              className={`cursor-pointer border-1 p-[2px] ${
                selectedColor === color ? "border-gray-300" : "border-white"
              }`}
              key={color}
              onClick={() => handleTypeChange("color", color)}
            >
              <div className={`w-6 h-6`} style={{ backgroundColor: color }} />
            </div>
          ))}
        </div>
      </div>

      {/* QUANTITY */}
      <div className="flex flex-col gap-2 text-sm">
        <span className="text-gray-500">Quantity</span>
        <div className="flex items-center gap-2">
          <button
            className="cursor-pointer border-1 border-gray-300 p-1 disabled:opacity-40 disabled:cursor-not-allowed"
            disabled={isOutOfStock}
            onClick={() => handleQuantityChange("decrement")}
          >
            <Minus className="w-4 h-4" />
          </button>
          <span>{quantity}</span>
          <button
            className="cursor-pointer border-1 border-gray-300 p-1 disabled:opacity-40 disabled:cursor-not-allowed"
            disabled={
              isOutOfStock || (inventory !== null && quantity >= inventory)
            }
            onClick={() => handleQuantityChange("increment")}
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* BUTTONS */}
      <div className="flex flex-col sm:flex-row gap-3 pt-2">
        <button
          onClick={handleAddToCart}
          disabled={isOutOfStock}
          className={`flex-1 px-5 py-3 rounded-xl shadow-md flex items-center justify-center gap-2 text-sm font-bold transition-all ${
            isOutOfStock
              ? "bg-slate-200 text-slate-400 cursor-not-allowed"
              : "bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer shadow-indigo-100"
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
          className={`flex-1 px-5 py-3 rounded-xl flex items-center justify-center gap-2 text-sm font-bold transition-all ${
            isOutOfStock
              ? "border border-slate-200 text-slate-400 cursor-not-allowed"
              : "bg-slate-900 hover:bg-slate-800 text-white cursor-pointer shadow-md"
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
          className={`p-3 rounded-xl border transition flex items-center justify-center cursor-pointer ${
            isFavorited
              ? "bg-rose-50 border-rose-200 text-rose-600 shadow-xs"
              : "bg-white border-slate-200 text-slate-600 hover:text-rose-600 hover:border-rose-200"
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
