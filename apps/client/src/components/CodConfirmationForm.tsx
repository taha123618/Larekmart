"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { ShippingFormInputs, CartItemType } from "@repo/types";
import useCartStore from "@/stores/cartStore";
import { getApiGatewayUrl } from "@/services/gateway.service";
import {
  Truck,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowRight,
} from "lucide-react";

export default function CodConfirmationForm({
  shippingForm,
  cart,
  grandTotal,
  discountTotal,
  taxTotal,
  taxCalculationId,
}: {
  shippingForm: ShippingFormInputs;
  cart: CartItemType[];
  grandTotal: number;
  discountTotal: number;
  taxTotal: number;
  taxCalculationId?: string;
}) {
  const router = useRouter();
  const { getToken, userId } = useAuth();
  const { clearCart, serverCart } = useCartStore();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmedOrderId, setConfirmedOrderId] = useState<string | null>(null);

  const carrierName = (shippingForm.carrier ?? "Custom").toUpperCase();
  const codFee = shippingForm.codFee ?? 0;
  const shippingAmount = shippingForm.shippingAmount ?? 200;

  const handleConfirmCodOrder = async () => {
    setLoading(true);
    setError(null);

    try {
      const token = await getToken();
      if (!token) {
        throw new Error("You must be signed in to confirm an order.");
      }

      const orderServiceUrl = getApiGatewayUrl();

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        "x-request-id":
          typeof crypto !== "undefined" && crypto.randomUUID
            ? crypto.randomUUID()
            : `req-${Date.now()}`,
      };
      if (userId) {
        headers["x-user-id"] = userId;
      }

      const res = await fetch(`${orderServiceUrl}/api/v1/orders/cod`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          email: shippingForm.email,
          couponCode: serverCart?.coupons?.[0]?.code || undefined,
          amount: Math.round(grandTotal * 100), // in paisa — verified against
          // the server-recomputed total (catalog prices + components below).
          discountTotal: Math.round((discountTotal ?? 0) * 100),
          taxTotal: Math.round((taxTotal ?? 0) * 100),
          taxCalculationId,
          carrier: shippingForm.carrier,
          serviceType: shippingForm.serviceType,
          shippingRateAmount: Math.round(shippingAmount * 100),
          codFee: Math.round(codFee * 100),
          shippingAddress: {
            fullName: shippingForm.name,
            phone: shippingForm.phone,
            addressLine1: shippingForm.address,
            city: shippingForm.city,
            country: "PK",
          },
          products: cart.map((item) => ({
            productId: Number(item.id),
            quantity: item.quantity,
            price: Math.round(item.price * 100),
          })),
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(
          data.message || "Failed to confirm Cash on Delivery order",
        );
      }

      const createdOrder = await res.json();
      setConfirmedOrderId(createdOrder._id || createdOrder.id);
      clearCart(token);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "An unexpected error occurred",
      );
    } finally {
      setLoading(false);
    }
  };

  if (confirmedOrderId) {
    return (
      <div className="flex flex-col items-center justify-center p-8 sm:p-10 bg-white/90 dark:bg-[#0b0f19]/90 backdrop-blur-2xl border border-emerald-500/30 dark:border-emerald-500/20 rounded-3xl text-center shadow-xl shadow-emerald-500/5 dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)]">
        <div className="w-16 h-16 bg-gradient-to-tr from-emerald-500 to-teal-400 text-white rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-emerald-500/25 animate-in zoom-in-95 duration-200">
          <CheckCircle2 className="w-8 h-8" />
        </div>
        <h3 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
          Order Confirmed!
        </h3>
        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1.5 max-w-md leading-relaxed">
          Your Cash on Delivery booking with{" "}
          <span className="font-bold text-slate-900 dark:text-white">
            {carrierName}
          </span>{" "}
          has been dispatched. Please keep exact cash ready upon delivery.
        </p>

        <div className="mt-5 p-4 bg-slate-50/90 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800 rounded-2xl w-full max-w-sm text-left text-xs flex flex-col gap-2 shadow-xs">
          <div className="flex justify-between items-center">
            <span className="text-slate-500 dark:text-slate-400">
              Order ID:
            </span>
            <span className="font-mono font-bold text-slate-900 dark:text-white bg-slate-200/60 dark:bg-slate-800 px-2 py-0.5 rounded-lg text-[11px]">
              {confirmedOrderId}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-500 dark:text-slate-400">Courier:</span>
            <span className="font-bold text-slate-900 dark:text-white">
              {carrierName}
            </span>
          </div>
          <div className="flex justify-between border-t border-slate-200 dark:border-slate-800 pt-2 font-bold text-sm">
            <span className="text-slate-900 dark:text-white">
              Pay on Delivery:
            </span>
            <span className="text-emerald-600 dark:text-emerald-400 font-black">
              PKR {Math.round(grandTotal)}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 mt-6">
          <button
            onClick={() => router.push(`/track`)}
            className="px-5 py-3 bg-gradient-to-r from-slate-900 to-slate-800 dark:from-emerald-600 dark:to-teal-600 hover:from-slate-800 hover:to-slate-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-md cursor-pointer"
          >
            <span>Track Shipment</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => router.push("/orders")}
            className="px-5 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-bold transition cursor-pointer shadow-xs"
          >
            My Orders
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="p-4 bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-800/60 rounded-2xl flex items-start gap-3 shadow-xs">
        <Truck className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
        <div className="flex flex-col gap-1">
          <h4 className="text-sm font-bold text-emerald-950 dark:text-emerald-200">
            Cash on Delivery with {carrierName}
          </h4>
          <p className="text-xs text-emerald-800 dark:text-emerald-300 leading-relaxed">
            No upfront card payment required. Our courier rider will collect
            cash at your doorstep in{" "}
            <span className="font-bold">{shippingForm.city}</span> before
            handing over your package.
          </p>
        </div>
      </div>

      <div className="border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4.5 bg-slate-50/70 dark:bg-slate-900/60 backdrop-blur-md flex flex-col gap-2.5 text-xs shadow-xs">
        <span className="font-bold text-slate-900 dark:text-white">
          Delivery & Collection Summary:
        </span>
        <div className="flex justify-between text-slate-600 dark:text-slate-400">
          <span>Recipient:</span>
          <span className="font-bold text-slate-900 dark:text-white">
            {shippingForm.name} ({shippingForm.phone})
          </span>
        </div>
        <div className="flex justify-between text-slate-600 dark:text-slate-400">
          <span>Address:</span>
          <span className="font-medium text-slate-900 dark:text-white text-right max-w-[240px] truncate">
            {shippingForm.address}, {shippingForm.city}
          </span>
        </div>
        <div className="flex justify-between text-slate-600 dark:text-slate-400">
          <span>Courier Service:</span>
          <span className="font-medium text-slate-900 dark:text-white">
            {carrierName} ({shippingForm.serviceType})
          </span>
        </div>
        <div className="flex justify-between text-slate-600 dark:text-slate-400">
          <span>Shipping Fee:</span>
          <span className="font-medium text-slate-900 dark:text-white">
            PKR {shippingAmount}
          </span>
        </div>
        {codFee > 0 && (
          <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-bold">
            <span>COD Handling Fee:</span>
            <span>+PKR {codFee}</span>
          </div>
        )}
        <div className="border-t border-slate-200 dark:border-slate-800 pt-2.5 flex justify-between font-bold text-sm text-slate-900 dark:text-white">
          <span>Amount to Pay Rider:</span>
          <span className="text-emerald-600 dark:text-emerald-400 font-black">
            PKR {Math.round(grandTotal)}
          </span>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-xl text-xs text-rose-700 dark:text-rose-400 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <button
        onClick={handleConfirmCodOrder}
        disabled={loading}
        className="w-full bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-600 hover:from-emerald-500 hover:via-teal-500 hover:to-emerald-500 disabled:opacity-50 text-white font-bold py-3.5 px-4 rounded-xl text-sm flex items-center justify-center gap-2 transition cursor-pointer shadow-lg shadow-emerald-500/25 active:scale-[0.99]"
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Booking Shipment with {carrierName}...</span>
          </>
        ) : (
          <>
            <span>Confirm Cash on Delivery Order</span>
            <ArrowRight className="w-4 h-4" />
          </>
        )}
      </button>
    </div>
  );
}
