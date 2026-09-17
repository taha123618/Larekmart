"use client";

import useCartStore from "@/stores/cartStore";
import { ProductType } from "@repo/types";
import {
  Minus,
  Plus,
  ShoppingCart,
  CheckCircle2,
  AlertCircle,
  XCircle,
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

  const variantId = `${selectedSize}-${selectedColor}`;

  useEffect(() => {
    let isMounted = true;
    const fetchStock = async () => {
      setIsLoadingInventory(true);
      try {
        const inventoryUrl =
          process.env.NEXT_PUBLIC_INVENTORY_SERVICE_URL ||
          "http://localhost:8007";
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
      <button
        onClick={handleAddToCart}
        disabled={isOutOfStock}
        className={`px-4 py-2.5 rounded-md shadow-lg flex items-center justify-center gap-2 text-sm font-medium transition-all ${
          isOutOfStock
            ? "bg-gray-300 text-gray-500 cursor-not-allowed"
            : "bg-gray-800 hover:bg-gray-900 text-white cursor-pointer"
        }`}
      >
        <Plus className="w-4 h-4" />
        {isOutOfStock ? "Out of Stock" : "Add to Cart"}
      </button>

      <button
        disabled={isOutOfStock}
        className={`px-4 py-2.5 rounded-md flex items-center justify-center gap-2 text-sm font-medium transition-all ${
          isOutOfStock
            ? "border border-gray-200 text-gray-400 cursor-not-allowed"
            : "ring-1 ring-gray-400 shadow-sm text-gray-800 hover:bg-gray-50 cursor-pointer"
        }`}
      >
        <ShoppingCart className="w-4 h-4" />
        {isOutOfStock ? "Unavailable" : "Buy this Item"}
      </button>
    </div>
  );
};

export default ProductInteraction;
