"use client";

import ShippingForm from "@/components/ShippingForm";
import StripePaymentForm from "@/components/StripePaymentForm";
import CodConfirmationForm from "@/components/CodConfirmationForm";
import useCartStore from "@/stores/cartStore";
import {
  useCartQuery,
  useApplyCouponMutation,
  useRemoveCouponMutation,
  useUpdateCartItemMutation,
  useRemoveCartItemMutation,
} from "@/hooks/useCartQuery";
import { ShippingFormInputs, CartItemType } from "@repo/types";
import {
  ArrowRight,
  Trash2,
  Plus,
  Minus,
  Tag,
  AlertCircle,
  X,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import RecommendationSection from "@/components/RecommendationSection";
import { useAuth } from "@clerk/nextjs";

const defaultSteps = [
  {
    id: 1,
    title: "Shopping Cart",
  },
  {
    id: 2,
    title: "Shipping Address",
  },
  {
    id: 3,
    title: "Payment Method",
  },
];

const CartContent = () => {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { getToken, userId } = useAuth();
  const [shippingForm, setShippingForm] = useState<ShippingFormInputs>();
  const [couponCode, setCouponCode] = useState("");
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponFeedback, setCouponFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const activeStep = parseInt(searchParams.get("step") || "1");

  // Local optimistic store
  const { cart, removeFromCart, updateQuantity, mergeGuestCart } =
    useCartStore();

  // TanStack React Query + Axios hooks
  const { data: serverCartQueryData, isLoading: isCartLoading } =
    useCartQuery();
  const applyCouponMutation = useApplyCouponMutation();
  const removeCouponMutation = useRemoveCouponMutation();
  const updateItemMutation = useUpdateCartItemMutation();
  const removeItemMutation = useRemoveCartItemMutation();

  const activeServerCart = serverCartQueryData;

  useEffect(() => {
    const init = async () => {
      const token = await getToken();
      if (userId && token) {
        await mergeGuestCart(token);
      }
    };
    init();
  }, [userId, getToken, mergeGuestCart]);

  const handleApplyCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!couponCode.trim()) return;

    setCouponLoading(true);
    setCouponFeedback(null);

    try {
      await applyCouponMutation.mutateAsync(couponCode.trim().toUpperCase());
      setCouponFeedback({
        type: "success",
        message: `Coupon "${couponCode.trim().toUpperCase()}" applied successfully!`,
      });
      setCouponCode("");
    } catch (err: unknown) {
      setCouponFeedback({
        type: "error",
        message: err instanceof Error ? err.message : "Invalid coupon code",
      });
    } finally {
      setCouponLoading(false);
    }
  };

  const handleRemoveCoupon = async (code: string) => {
    try {
      await removeCouponMutation.mutateAsync(code);
      setCouponFeedback(null);
    } catch (err: unknown) {
      console.warn("Failed to remove coupon:", err);
    }
  };

  const handleQuantityChange = (item: CartItemType, newQty: number) => {
    updateQuantity(item, newQty);
    const matchingItem = activeServerCart?.items.find(
      (i) =>
        i.productId === String(item.id) &&
        i.size === item.selectedSize &&
        i.color === item.selectedColor,
    );
    if (matchingItem?.id) {
      updateItemMutation.mutate({ itemId: matchingItem.id, quantity: newQty });
    }
  };

  const handleRemoveItem = (item: CartItemType) => {
    removeFromCart(item);
    const matchingItem = activeServerCart?.items.find(
      (i) =>
        i.productId === String(item.id) &&
        i.size === item.selectedSize &&
        i.color === item.selectedColor,
    );
    if (matchingItem?.id) {
      removeItemMutation.mutate(matchingItem.id);
    }
  };

  // Pricing values from authoritative serverCart or fallback to client calculation
  const fallbackSubtotal = cart.reduce(
    (acc, item) => acc + item.price * item.quantity,
    0,
  );
  const subtotal = activeServerCart?.pricing?.subtotal ?? fallbackSubtotal;
  const discountTotal = activeServerCart?.pricing?.discountTotal ?? 0;
  const shippingFee =
    shippingForm?.shippingAmount !== undefined
      ? shippingForm.shippingAmount
      : (activeServerCart?.pricing?.shippingTotal ??
        (subtotal > 2000 ? 0 : 250));
  const codFee =
    shippingForm?.isCod && shippingForm?.codFee ? shippingForm.codFee : 0;
  const taxTotal = activeServerCart?.pricing?.taxTotal ?? 0;
  const grandTotal = Math.max(
    0,
    subtotal - discountTotal + shippingFee + codFee + taxTotal,
  );

  const steps = [
    defaultSteps[0]!,
    defaultSteps[1]!,
    {
      id: 3,
      title: shippingForm?.isCod ? "COD Confirmation" : "Payment Method",
    },
  ];

  return (
    <div className="flex flex-col gap-8 items-center justify-center mt-12 px-4 max-w-7xl mx-auto">
      {/* TITLE */}
      <h1 className="text-2xl font-medium">Your Shopping Cart</h1>

      {/* STEPS */}
      <div className="flex flex-col lg:flex-row items-center gap-8 lg:gap-16">
        {steps.map((step) => (
          <div
            className={`flex items-center gap-2 border-b-2 pb-4 ${
              step.id === activeStep ? "border-gray-800" : "border-gray-200"
            }`}
            key={step.id}
          >
            <div
              className={`w-6 h-6 rounded-full text-white p-4 flex items-center justify-center text-sm font-semibold ${
                step.id === activeStep ? "bg-gray-800" : "bg-gray-400"
              }`}
            >
              {step.id}
            </div>
            <p
              className={`text-sm font-medium ${
                step.id === activeStep ? "text-gray-800" : "text-gray-400"
              }`}
            >
              {step.title}
            </p>
          </div>
        ))}
      </div>

      {/* INVENTORY ADJUSTMENTS NOTICE */}
      {activeServerCart?.adjustments &&
        activeServerCart.adjustments.length > 0 && (
          <div className="w-full bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-lg flex items-start gap-3 text-sm">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold">
                Notice regarding your cart items:{" "}
              </span>
              {activeServerCart.adjustments.map((adj, i) => (
                <p key={adj.id || i} className="mt-1">
                  • {adj.reason}
                </p>
              ))}
            </div>
          </div>
        )}

      {/* MAIN CONTAINER */}
      <div className="w-full flex flex-col lg:flex-row gap-12">
        {/* LEFT COLUMN: ITEMS OR CHECKOUT STEPS */}
        <div className="w-full lg:w-7/12 shadow-md border border-gray-100 p-6 md:p-8 rounded-lg flex flex-col gap-6">
          {activeStep === 1 ? (
            isCartLoading && cart.length === 0 ? (
              <div className="flex items-center justify-center py-16 gap-2 text-gray-500">
                <Loader2 className="w-5 h-5 animate-spin text-gray-800" />
                <span>Loading your cart...</span>
              </div>
            ) : cart.length === 0 ? (
              <div className="text-center py-16 flex flex-col items-center gap-4">
                <p className="text-gray-500">Your cart is currently empty.</p>
                <button
                  onClick={() => router.push("/products")}
                  className="px-6 py-2.5 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition cursor-pointer"
                >
                  Explore Catalog
                </button>
              </div>
            ) : (
              cart.map((item, index) => (
                <div
                  className="flex items-center justify-between pb-6 border-b border-gray-100 last:border-b-0"
                  key={`${item.id}-${item.selectedSize}-${item.selectedColor}-${index}`}
                >
                  {/* IMAGE AND DETAILS */}
                  <div className="flex gap-6 items-center">
                    <div className="relative w-24 h-24 bg-gray-50 rounded-lg overflow-hidden shrink-0 border border-gray-100">
                      <img
                        src={
                          (item.images as Record<string, string>)?.[
                            item.selectedColor
                          ] ||
                          (typeof item.images === "object" && item.images
                            ? Object.values(
                                item.images as Record<string, string>,
                              )[0] || ""
                            : "") ||
                          "/placeholder.png"
                        }
                        alt={item.name}
                        // fill
                        className="object-contain"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <p className="text-sm font-semibold text-gray-900">
                        {item.name}
                      </p>
                      <div className="flex flex-wrap gap-2 text-xs text-gray-500">
                        {item.selectedSize && (
                          <span>Size: {item.selectedSize}</span>
                        )}
                        {item.selectedColor && (
                          <span>Color: {item.selectedColor}</span>
                        )}
                      </div>
                      <p className="text-sm font-semibold text-gray-800 mt-1">
                        ${(item.price * item.quantity).toFixed(2)}
                        {item.quantity > 1 && (
                          <span className="text-xs font-normal text-gray-500 ml-1">
                            (${item.price.toFixed(2)} each)
                          </span>
                        )}
                      </p>
                    </div>
                  </div>

                  {/* CONTROLS */}
                  <div className="flex items-center gap-4">
                    <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
                      <button
                        onClick={() =>
                          handleQuantityChange(item, item.quantity - 1)
                        }
                        className="px-2.5 py-1.5 hover:bg-gray-100 text-gray-600 transition cursor-pointer"
                        aria-label="Decrease quantity"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="px-3 py-1 text-sm font-medium text-gray-800">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() =>
                          handleQuantityChange(item, item.quantity + 1)
                        }
                        className="px-2.5 py-1.5 hover:bg-gray-100 text-gray-600 transition cursor-pointer"
                        aria-label="Increase quantity"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <button
                      onClick={() => handleRemoveItem(item)}
                      className="w-8 h-8 rounded-full bg-red-50 hover:bg-red-100 text-red-500 flex items-center justify-center transition cursor-pointer"
                      title="Remove item"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )
          ) : activeStep === 2 ? (
            <ShippingForm setShippingForm={setShippingForm} />
          ) : activeStep === 3 && shippingForm ? (
            shippingForm.isCod ? (
              <CodConfirmationForm
                shippingForm={shippingForm}
                cart={cart}
                grandTotal={grandTotal}
              />
            ) : (
              <StripePaymentForm shippingForm={shippingForm} />
            )
          ) : (
            <p className="text-sm text-gray-500">
              Please fill in the shipping form to continue.
            </p>
          )}
        </div>

        {/* RIGHT COLUMN: PRICING BREAKDOWN & COUPONS */}
        <div className="w-full lg:w-5/12 shadow-md border border-gray-100 p-6 md:p-8 rounded-lg flex flex-col gap-6 h-max">
          <h2 className="font-semibold text-lg text-gray-900">Order Summary</h2>

          {/* COUPON CODE FORM */}
          {activeStep === 1 && (
            <div className="flex flex-col gap-2 pt-2 pb-4 border-b border-gray-100">
              <form onSubmit={handleApplyCoupon} className="flex gap-2">
                <div className="relative flex-1">
                  <Tag className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
                  <input
                    type="text"
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value)}
                    placeholder="Enter coupon (e.g. SAVE10)"
                    className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg uppercase tracking-wider focus:outline-none focus:ring-1 focus:ring-gray-800"
                  />
                </div>
                <button
                  type="submit"
                  disabled={couponLoading || !couponCode.trim()}
                  className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50 transition cursor-pointer flex items-center gap-1.5"
                >
                  {couponLoading && (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  )}
                  <span>{couponLoading ? "Applying..." : "Apply"}</span>
                </button>
              </form>

              {couponFeedback && (
                <div
                  className={`text-xs mt-1 flex items-center gap-1.5 ${
                    couponFeedback.type === "success"
                      ? "text-emerald-700 font-medium"
                      : "text-rose-600"
                  }`}
                >
                  {couponFeedback.type === "success" ? (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  ) : (
                    <AlertCircle className="w-3.5 h-3.5" />
                  )}
                  <span>{couponFeedback.message}</span>
                </div>
              )}

              {/* APPLIED COUPONS LIST */}
              {activeServerCart?.coupons &&
                activeServerCart.coupons.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {activeServerCart.coupons.map((coupon) => (
                      <span
                        key={coupon.code}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200"
                      >
                        <Tag className="w-3 h-3" />
                        {coupon.code} (-${coupon.appliedAmount.toFixed(2)})
                        <button
                          onClick={() => handleRemoveCoupon(coupon.code)}
                          className="hover:text-emerald-950 ml-1 cursor-pointer"
                          title="Remove coupon"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
            </div>
          )}

          {/* FINANCIAL TOTALS */}
          <div className="flex flex-col gap-3">
            <div className="flex justify-between text-sm">
              <p className="text-gray-500">Subtotal</p>
              <p className="font-medium text-gray-900">
                ${subtotal.toFixed(2)}
              </p>
            </div>

            {discountTotal > 0 && (
              <div className="flex justify-between text-sm text-emerald-600 font-medium">
                <p>Discounts Applied</p>
                <p>-${discountTotal.toFixed(2)}</p>
              </div>
            )}

            <div className="flex justify-between text-sm">
              <p className="text-gray-500">
                Shipping{" "}
                {shippingForm?.carrier
                  ? `(${shippingForm.carrier.toUpperCase()})`
                  : "Estimate"}
              </p>
              <p className="font-medium text-gray-900">
                {shippingFee === 0 ? "Free" : `$${shippingFee.toFixed(2)}`}
              </p>
            </div>

            {codFee > 0 && (
              <div className="flex justify-between text-sm text-emerald-700 font-medium">
                <p>COD Handling Fee</p>
                <p>+${codFee.toFixed(2)}</p>
              </div>
            )}

            {taxTotal > 0 && (
              <div className="flex justify-between text-sm">
                <p className="text-gray-500">Estimated Tax</p>
                <p className="font-medium text-gray-900">
                  ${taxTotal.toFixed(2)}
                </p>
              </div>
            )}

            <hr className="border-gray-200 my-1" />

            <div className="flex justify-between items-center">
              <p className="text-gray-900 font-semibold text-base">
                Estimated Total
              </p>
              <p className="font-bold text-lg text-gray-900">
                ${grandTotal.toFixed(2)}
              </p>
            </div>
          </div>

          {activeStep === 1 && cart.length > 0 && (
            <button
              onClick={() => router.push("/cart?step=2", { scroll: false })}
              className="w-full bg-gray-900 hover:bg-gray-800 transition text-white py-3 px-4 rounded-lg font-medium flex items-center justify-center gap-2 cursor-pointer mt-2"
            >
              Proceed to Shipping
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {activeStep === 1 && cart.length > 0 && (
        <div className="w-full mt-8">
          <RecommendationSection
            title="Recommended Add-ons"
            subtitle="Frequently bought together with items in your cart"
            type="cart"
            productIds={cart.map((item) => Number(item.id))}
            limit={4}
          />
        </div>
      )}
    </div>
  );
};

const CartPage = () => {
  return (
    <Suspense
      fallback={
        <div className="mt-12 text-center text-gray-500">Loading cart...</div>
      }
    >
      <CartContent />
    </Suspense>
  );
};

export default CartPage;
