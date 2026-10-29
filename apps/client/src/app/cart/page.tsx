"use client";

import ShippingForm from "@/components/ShippingForm";
import StripePaymentForm from "@/components/StripePaymentForm";
import CodConfirmationForm from "@/components/CodConfirmationForm";
import MediaImage from "@/components/MediaImage";
import useCartStore from "@/stores/cartStore";
import {
  useCartQuery,
  useApplyCouponMutation,
  useRemoveCouponMutation,
  useUpdateCartItemMutation,
  useRemoveCartItemMutation,
} from "@/hooks/useCartQuery";
import { ShippingFormInputs, CartItemType, Promotion } from "@repo/types";
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
  Sparkles,
  Coins,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState, useRef, useMemo } from "react";
import RecommendationSection from "@/components/RecommendationSection";
import { useAuth } from "@clerk/nextjs";
import { motion, AnimatePresence } from "framer-motion";
import { fetchActivePromotions } from "@/services/promotion.service";
import { getTaxQuote } from "@/services/tax.service";
import { fetchPriceQuote } from "@/services/pricing.service";
import { useCurrencyStore } from "@/stores/currencyStore";
import type { TaxCalculationResponse, PriceQuote } from "@repo/types";
import { trackCustomerInteraction } from "@/services/analytics.service";

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
  const [activePromotions, setActivePromotions] = useState<Promotion[]>([]);
  const [taxQuote, setTaxQuote] = useState<TaxCalculationResponse | null>(null);
  const [isTaxLoading, setIsTaxLoading] = useState(false);
  const [pricingQuote, setPricingQuote] = useState<PriceQuote | null>(null);
  const [isPricingLoading, setIsPricingLoading] = useState(false);
  const { currentCurrency, formatPrice } = useCurrencyStore();

  // Local optimistic store
  const { cart, serverCart, removeFromCart, updateQuantity, mergeGuestCart } =
    useCartStore();

  useEffect(() => {
    let mounted = true;
    fetchActivePromotions()
      .then((promos) => {
        if (mounted && promos) setActivePromotions(promos);
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  // Dynamic real-time tax calculation based on destination jurisdiction & cart items
  useEffect(() => {
    if (cart.length === 0) {
      setTaxQuote(null);
      return;
    }

    let isMounted = true;
    const calculateTax = async () => {
      setIsTaxLoading(true);
      try {
        const token = await getToken();
        const quote = await getTaxQuote(
          {
            currency: "USD",
            destinationAddress: {
              country: shippingForm?.country || "US",
              region: shippingForm?.state || "CA",
              city: shippingForm?.city || undefined,
              postalCode: shippingForm?.postalCode || undefined,
            },
            lines: cart.map((item) => ({
              lineId: String(item.id),
              productId: String(item.id),
              categoryCode: "standard",
              quantity: item.quantity,
              unitPrice: item.price.toFixed(2),
              amount: (item.price * item.quantity).toFixed(2),
              discountAmount: "0.00",
              isInclusive: false,
            })),
            isInclusive: false,
          },
          token ?? undefined,
        );
        if (isMounted) {
          setTaxQuote(quote);
        }
      } catch (err) {
        console.warn("Could not calculate dynamic tax quote:", err);
      } finally {
        if (isMounted) setIsTaxLoading(false);
      }
    };

    calculateTax();
    return () => {
      isMounted = false;
    };
  }, [
    cart,
    shippingForm?.country,
    shippingForm?.state,
    shippingForm?.city,
    shippingForm?.postalCode,
    getToken,
  ]);

  // Dynamic authoritative price quote calculation from pricing-service (volume tiers & discount composition)
  useEffect(() => {
    if (cart.length === 0) {
      setPricingQuote(null);
      return;
    }

    let isMounted = true;
    const calculatePricing = async () => {
      setIsPricingLoading(true);
      try {
        const token = await getToken();
        const quote = await fetchPriceQuote(
          {
            currency: currentCurrency,
            items: cart.map((item) => ({
              productId: String(item.id),
              quantity: item.quantity,
            })),
            promotionDiscount: serverCart?.pricing?.discountTotal || 0,
          },
          token ?? undefined,
        );
        if (isMounted) {
          setPricingQuote(quote);
        }
      } catch (err) {
        console.warn("Could not calculate dynamic pricing quote:", err);
      } finally {
        if (isMounted) setIsPricingLoading(false);
      }
    };

    calculatePricing();
    return () => {
      isMounted = false;
    };
  }, [cart, currentCurrency, serverCart?.pricing?.discountTotal, getToken]);

  const availableCoupons = useMemo(() => {
    const list: Array<{ code: string; label: string }> = [];
    for (const promo of activePromotions) {
      if (promo.status === "ACTIVE" && promo.coupons) {
        for (const c of promo.coupons) {
          if (
            c.isActive &&
            !list.some((existing) => existing.code === c.code)
          ) {
            const label =
              promo.type === "PERCENTAGE"
                ? `${promo.discountValue}% OFF`
                : promo.type === "FREE_SHIPPING"
                  ? "Free Shipping"
                  : `$${promo.discountValue} OFF`;
            list.push({ code: c.code, label });
          }
        }
      }
    }
    return list;
  }, [activePromotions]);

  const activeStep = parseInt(searchParams.get("step") || "1");

  useEffect(() => {
    trackCustomerInteraction({
      userId: userId ?? undefined,
      eventType: activeStep > 1 ? "CHECKOUT_START" : "VIEW",
      metadata: { page: "cart", step: activeStep, itemCount: cart.length },
    });
  }, [activeStep, userId, cart.length]);

  // TanStack React Query + Axios hooks
  const { data: serverCartQueryData, isLoading: isCartLoading } =
    useCartQuery();
  const applyCouponMutation = useApplyCouponMutation();
  const removeCouponMutation = useRemoveCouponMutation();
  const updateItemMutation = useUpdateCartItemMutation();
  const removeItemMutation = useRemoveCartItemMutation();

  const activeServerCart = serverCartQueryData;

  const hasMergedRef = useRef(false);

  useEffect(() => {
    if (hasMergedRef.current || !userId) return;
    const init = async () => {
      const token = await getToken();
      if (userId && token && !hasMergedRef.current) {
        hasMergedRef.current = true;
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

  // Pricing values from authoritative pricing-service quote, serverCart, or client calculation
  const fallbackSubtotal = cart.reduce(
    (acc, item) => acc + item.price * item.quantity,
    0,
  );
  const subtotal =
    pricingQuote?.subtotal !== undefined
      ? pricingQuote.subtotal
      : activeServerCart?.pricing?.subtotal &&
          activeServerCart.pricing.subtotal > 0
        ? activeServerCart.pricing.subtotal
        : serverCart?.pricing?.subtotal && serverCart.pricing.subtotal > 0
          ? serverCart.pricing.subtotal
          : fallbackSubtotal;
  const discountTotal =
    pricingQuote?.totalDiscount !== undefined && pricingQuote.totalDiscount > 0
      ? pricingQuote.totalDiscount
      : (activeServerCart?.pricing?.discountTotal ??
        serverCart?.pricing?.discountTotal ??
        0);
  const shippingFee =
    shippingForm?.shippingAmount !== undefined
      ? shippingForm.shippingAmount
      : activeServerCart?.pricing?.shippingTotal &&
          activeServerCart.pricing.shippingTotal > 0
        ? activeServerCart.pricing.shippingTotal
        : serverCart?.pricing?.shippingTotal &&
            serverCart.pricing.shippingTotal > 0
          ? serverCart.pricing.shippingTotal
          : 200;
  const codFee = shippingForm?.isCod ? (shippingForm.codFee ?? 30) : 0;
  const taxTotal =
    taxQuote?.taxTotal !== undefined
      ? parseFloat(taxQuote.taxTotal)
      : (activeServerCart?.pricing?.taxTotal ??
        serverCart?.pricing?.taxTotal ??
        0);
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
    <div className="flex flex-col gap-8 items-center justify-center py-8 px-4 max-w-7xl mx-auto">
      {/* TITLE */}
      <div className="text-center">
        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
          Marketplace Checkout
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Review your items, apply vouchers, and complete your secure order.
        </p>
      </div>

      {/* STEPS */}
      <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-6 bg-white/95 dark:bg-slate-900/60 dark:backdrop-blur-xl p-2.5 sm:p-3 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)]">
        {steps.map((step) => {
          const isActive = step.id === activeStep;
          return (
            <div
              className={`flex items-center gap-2.5 px-3 py-1.5 rounded-xl transition ${
                isActive
                  ? "bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-bold"
                  : "text-slate-500 dark:text-slate-400"
              }`}
              key={step.id}
            >
              <div
                className={`w-6 h-6 rounded-full text-white flex items-center justify-center text-xs font-bold ${
                  isActive ? "bg-indigo-600" : "bg-slate-300 dark:bg-slate-700"
                }`}
              >
                {step.id}
              </div>
              <span className="text-xs sm:text-sm">{step.title}</span>
            </div>
          );
        })}
      </div>

      {/* INVENTORY ADJUSTMENTS NOTICE */}
      {activeServerCart?.adjustments &&
        activeServerCart.adjustments.length > 0 && (
          <div className="w-full bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 text-amber-800 dark:text-amber-300 p-4 rounded-2xl flex items-start gap-3 text-sm">
            <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
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
      <div className="w-full flex flex-col lg:flex-row gap-8">
        {/* LEFT COLUMN: ITEMS OR CHECKOUT STEPS */}
        <div className="w-full lg:w-7/12 bg-white/95 dark:bg-slate-900/70 dark:backdrop-blur-xl shadow-xs border border-slate-200/80 dark:border-slate-800/80 dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)] p-6 md:p-8 rounded-3xl flex flex-col gap-6 overflow-hidden">
          <AnimatePresence mode="wait">
            {activeStep === 1 ? (
              <motion.div
                key="step-1"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2 }}
                className="flex flex-col gap-6"
              >
                {isCartLoading && cart.length === 0 ? (
                  <div className="flex items-center justify-center py-16 gap-2 text-gray-500 dark:text-slate-400">
                    <Loader2 className="w-5 h-5 animate-spin text-gray-800 dark:text-slate-200" />
                    <span>Loading your cart...</span>
                  </div>
                ) : cart.length === 0 ? (
                  <div className="text-center py-16 flex flex-col items-center gap-4">
                    <p className="text-gray-500 dark:text-slate-400">
                      Your cart is currently empty.
                    </p>
                    <button
                      onClick={() => router.push("/products")}
                      className="px-6 py-2.5 bg-slate-900 dark:bg-slate-800 text-white rounded-lg hover:bg-slate-800 dark:hover:bg-slate-700 transition cursor-pointer"
                    >
                      Explore Catalog
                    </button>
                  </div>
                ) : (
                  <AnimatePresence mode="popLayout">
                    {cart.map((item, index) => (
                      <motion.div
                        layout
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{
                          opacity: 0,
                          x: -25,
                          transition: { duration: 0.2 },
                        }}
                        transition={{
                          type: "spring",
                          stiffness: 350,
                          damping: 25,
                        }}
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-gray-100 dark:border-slate-800 last:border-b-0"
                        key={`${item.id}-${item.selectedSize}-${item.selectedColor}-${index}`}
                      >
                        {/* IMAGE AND DETAILS */}
                        <div className="flex gap-4 sm:gap-6 items-center">
                          <div className="relative w-20 h-20 sm:w-24 sm:h-24 bg-gray-50 dark:bg-slate-800 rounded-xl overflow-hidden shrink-0 border border-gray-100 dark:border-slate-700 flex items-center justify-center">
                            <MediaImage
                              src={
                                (item.images as Record<string, string>)?.[
                                  item.selectedColor
                                ] ||
                                (typeof item.images === "object" && item.images
                                  ? Object.values(
                                      item.images as Record<string, string>,
                                    )[0] || ""
                                  : "") ||
                                (item as { image?: string }).image ||
                                ""
                              }
                              alt={item.name}
                              fallbackSrc="/placeholder.png"
                              className="w-full h-full object-contain"
                            />
                          </div>
                          <div className="flex flex-col gap-1">
                            <p className="text-sm font-semibold text-gray-900 dark:text-white line-clamp-2">
                              {item.name}
                            </p>
                            <div className="flex flex-wrap gap-2 text-xs text-gray-500 dark:text-slate-400">
                              {item.selectedSize && (
                                <span>Size: {item.selectedSize}</span>
                              )}
                              {item.selectedColor && (
                                <span>Color: {item.selectedColor}</span>
                              )}
                            </div>
                            <p className="text-sm font-semibold text-gray-800 dark:text-slate-100 mt-1">
                              ${(item.price * item.quantity).toFixed(2)}
                              {item.quantity > 1 && (
                                <span className="text-xs font-normal text-gray-500 dark:text-slate-400 ml-1">
                                  (${item.price.toFixed(2)} each)
                                </span>
                              )}
                            </p>
                          </div>
                        </div>

                        {/* CONTROLS */}
                        <div className="flex items-center justify-between sm:justify-end gap-4 w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-slate-800">
                          <div className="flex items-center border border-gray-200 dark:border-slate-700 rounded-lg overflow-hidden bg-white dark:bg-slate-800">
                            <motion.button
                              whileTap={{ scale: 0.88 }}
                              onClick={() =>
                                handleQuantityChange(item, item.quantity - 1)
                              }
                              className="px-2.5 py-1.5 hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-600 dark:text-slate-300 transition cursor-pointer"
                              aria-label="Decrease quantity"
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </motion.button>
                            <span className="px-3 py-1 text-sm font-medium text-gray-800 dark:text-slate-100">
                              {item.quantity}
                            </span>
                            <motion.button
                              whileTap={{ scale: 0.88 }}
                              onClick={() =>
                                handleQuantityChange(item, item.quantity + 1)
                              }
                              className="px-2.5 py-1.5 hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-600 dark:text-slate-300 transition cursor-pointer"
                              aria-label="Increase quantity"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </motion.button>
                          </div>

                          <motion.button
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={() => handleRemoveItem(item)}
                            className="w-8 h-8 rounded-full bg-red-50 dark:bg-rose-950/40 hover:bg-red-100 dark:hover:bg-rose-900/60 text-red-500 dark:text-rose-400 flex items-center justify-center transition cursor-pointer"
                            title="Remove item"
                          >
                            <Trash2 className="w-4 h-4" />
                          </motion.button>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                )}
              </motion.div>
            ) : activeStep === 2 ? (
              <motion.div
                key="step-2"
                initial={{ opacity: 0, x: 15 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -15 }}
                transition={{ duration: 0.2 }}
              >
                <ShippingForm setShippingForm={setShippingForm} />
              </motion.div>
            ) : activeStep === 3 && shippingForm ? (
              <motion.div
                key="step-3"
                initial={{ opacity: 0, x: 15 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -15 }}
                transition={{ duration: 0.2 }}
              >
                {shippingForm.isCod ? (
                  <CodConfirmationForm
                    shippingForm={shippingForm}
                    cart={cart}
                    grandTotal={grandTotal}
                    discountTotal={discountTotal}
                    taxTotal={taxTotal}
                    taxCalculationId={taxQuote?.calculationId}
                  />
                ) : (
                  <StripePaymentForm
                    shippingForm={shippingForm}
                    taxCalculationId={taxQuote?.calculationId}
                    taxAmount={taxTotal}
                    onSwitchToCod={() =>
                      setShippingForm((prev) =>
                        prev ? { ...prev, isCod: true } : undefined,
                      )
                    }
                  />
                )}
              </motion.div>
            ) : (
              <motion.p
                key="step-fallback"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-sm text-gray-500"
              >
                Please fill in the shipping form to continue.
              </motion.p>
            )}
          </AnimatePresence>
        </div>

        {/* RIGHT COLUMN: PRICING BREAKDOWN & COUPONS */}
        <div className="w-full lg:w-5/12 bg-white/95 dark:bg-slate-900/70 dark:backdrop-blur-xl shadow-xs border border-slate-200/80 dark:border-slate-800/80 dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)] p-6 md:p-8 rounded-3xl flex flex-col gap-6 h-max">
          <h2 className="font-bold text-lg text-slate-900 dark:text-white">
            Order Summary
          </h2>

          {/* COUPON CODE FORM */}
          {activeStep === 1 && (
            <div className="flex flex-col gap-2 pt-2 pb-4 border-b border-gray-100 dark:border-slate-800">
              <form onSubmit={handleApplyCoupon} className="flex gap-2">
                <div className="relative flex-1">
                  <Tag className="w-4 h-4 absolute left-3 top-3 text-gray-400 dark:text-slate-500" />
                  <input
                    type="text"
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value)}
                    placeholder="Enter coupon (e.g. SAVE10)"
                    className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 rounded-lg uppercase tracking-wider focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <button
                  type="submit"
                  disabled={couponLoading || !couponCode.trim()}
                  className="px-4 py-2 bg-slate-900 dark:bg-slate-800 text-white rounded-lg text-sm font-medium hover:bg-slate-800 dark:hover:bg-slate-700 disabled:opacity-50 transition cursor-pointer flex items-center gap-1.5"
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
                      ? "text-emerald-700 dark:text-emerald-400 font-medium"
                      : "text-rose-600 dark:text-rose-400"
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

              {/* AVAILABLE PROMOTION BADGES */}
              {availableCoupons.length > 0 && (
                <div className="flex flex-col gap-1.5 mt-2">
                  <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                    Available promo codes:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {availableCoupons.map((c) => (
                      <button
                        key={c.code}
                        type="button"
                        onClick={() => setCouponCode(c.code)}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition cursor-pointer"
                        title={c.label}
                      >
                        <Sparkles className="w-2.5 h-2.5 text-indigo-500" />
                        <span>{c.code}</span>
                        <span className="text-[9px] font-sans font-normal opacity-75">
                          ({c.label})
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* APPLIED COUPONS LIST */}
              {activeServerCart?.coupons &&
                activeServerCart.coupons.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {activeServerCart.coupons.map((coupon) => (
                      <span
                        key={coupon.code}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                      >
                        <Tag className="w-3 h-3" />
                        {coupon.code} (-${coupon.appliedAmount.toFixed(2)})
                        <button
                          onClick={() => handleRemoveCoupon(coupon.code)}
                          className="hover:text-emerald-950 dark:hover:text-emerald-100 ml-1 cursor-pointer"
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
              <p className="text-gray-500 dark:text-slate-400 flex items-center gap-1.5">
                <span>Subtotal</span>
                {pricingQuote && (
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 font-semibold flex items-center gap-1">
                    <Coins className="w-2.5 h-2.5" />
                    pricing-service
                  </span>
                )}
              </p>
              <p className="font-medium text-gray-900 dark:text-white flex items-center gap-1.5">
                {isPricingLoading && (
                  <Loader2 className="w-3 h-3 animate-spin text-amber-600" />
                )}
                {formatPrice(subtotal)}
              </p>
            </div>

            {discountTotal > 0 && (
              <div className="flex justify-between text-sm text-emerald-600 dark:text-emerald-400 font-medium">
                <p className="flex items-center gap-1">
                  <Tag className="w-3.5 h-3.5" />
                  Discounts & Volume Tiers
                </p>
                <p>-{formatPrice(discountTotal)}</p>
              </div>
            )}

            <div className="flex justify-between text-sm">
              <p className="text-gray-500 dark:text-slate-400">
                Shipping{" "}
                {shippingForm?.carrier
                  ? `(${shippingForm.carrier.toUpperCase()})`
                  : "Estimate"}
              </p>
              <p className="font-medium text-gray-900 dark:text-white">
                {shippingFee === 0 ? "Free" : formatPrice(shippingFee)}
              </p>
            </div>

            {codFee > 0 && (
              <div className="flex justify-between text-sm text-emerald-700 dark:text-emerald-400 font-medium">
                <p>COD Handling Fee</p>
                <p>+{formatPrice(codFee)}</p>
              </div>
            )}

            {taxTotal > 0 && (
              <div className="flex flex-col gap-1">
                <div className="flex justify-between text-sm">
                  <div className="flex items-center gap-1.5 text-gray-500 dark:text-slate-400">
                    <span>Estimated Tax</span>
                    {taxQuote?.lines && taxQuote.lines[0]?.jurisdictionCode && (
                      <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300">
                        {taxQuote.lines[0].jurisdictionCode}
                      </span>
                    )}
                    {taxQuote?.lines && taxQuote.lines[0]?.isInclusive && (
                      <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                        (VAT Included)
                      </span>
                    )}
                  </div>
                  <p className="font-medium text-gray-900 dark:text-white flex items-center gap-1.5">
                    {isTaxLoading && (
                      <Loader2 className="w-3 h-3 animate-spin text-indigo-600" />
                    )}
                    {formatPrice(taxTotal)}
                  </p>
                </div>
                {taxQuote?.lines &&
                  taxQuote.lines[0]?.breakdown &&
                  taxQuote.lines[0].breakdown.length > 1 && (
                    <div className="pl-2 border-l-2 border-indigo-100 dark:border-indigo-950/80 text-[11px] text-slate-400 flex flex-col gap-0.5 mt-0.5">
                      {taxQuote.lines[0].breakdown.map((b) => (
                        <div
                          key={b.jurisdictionCode}
                          className="flex justify-between"
                        >
                          <span>
                            {b.jurisdictionName} (
                            {(parseFloat(b.rate) * 100).toFixed(1)}%)
                          </span>
                          <span>{formatPrice(parseFloat(b.taxAmount))}</span>
                        </div>
                      ))}
                    </div>
                  )}
              </div>
            )}

            <hr className="border-gray-200 dark:border-slate-800 my-1" />

            <div className="flex justify-between items-center">
              <p className="text-gray-900 dark:text-white font-semibold text-base">
                Estimated Total
              </p>
              <p className="font-bold text-lg text-gray-900 dark:text-white">
                {formatPrice(grandTotal)}
              </p>
            </div>
          </div>

          {activeStep === 1 && cart.length > 0 && (
            <button
              onClick={() => router.push("/cart?step=2", { scroll: false })}
              className="w-full bg-gradient-to-r from-indigo-600 via-indigo-500 to-violet-600 hover:from-indigo-500 hover:to-violet-500 transition-all duration-200 text-white py-3.5 px-4 rounded-2xl font-bold flex items-center justify-center gap-2 cursor-pointer mt-2 shadow-lg shadow-indigo-500/25 active:scale-95"
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
