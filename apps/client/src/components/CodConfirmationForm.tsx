"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { ShippingFormInputs, CartItemType } from "@repo/types";
import useCartStore from "@/stores/cartStore";
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
}: {
  shippingForm: ShippingFormInputs;
  cart: CartItemType[];
  grandTotal: number;
}) {
  const router = useRouter();
  const { getToken, userId } = useAuth();
  const { clearCart } = useCartStore();

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

      const orderServiceUrl =
        process.env.NEXT_PUBLIC_ORDER_SERVICE_URL || "http://localhost:8001";

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

      const res = await fetch(`${orderServiceUrl}/orders/cod`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          email: shippingForm.email,
          amount: Math.round(grandTotal * 100), // in cents/paisa
          carrier: shippingForm.carrier,
          serviceType: shippingForm.serviceType,
          shippingRateAmount: shippingAmount,
          codFee,
          shippingAddress: {
            fullName: shippingForm.name,
            phone: shippingForm.phone,
            addressLine1: shippingForm.address,
            city: shippingForm.city,
            country: "PK",
          },
          products: cart.map((item) => ({
            name: item.name,
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
      <div className="flex flex-col items-center justify-center p-8 bg-emerald-50/50 border border-emerald-200 rounded-xl text-center">
        <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-4">
          <CheckCircle2 className="w-7 h-7" />
        </div>
        <h3 className="text-xl font-bold text-gray-900">Order Confirmed!</h3>
        <p className="text-xs text-gray-600 mt-1 max-w-md">
          Your Cash on Delivery booking with{" "}
          <span className="font-semibold">{carrierName}</span> has been
          dispatched. Please keep exact cash ready upon delivery.
        </p>

        <div className="mt-4 p-3 bg-white border border-gray-200 rounded-lg w-full max-w-sm text-left text-xs flex flex-col gap-1.5">
          <div className="flex justify-between">
            <span className="text-gray-500">Order ID:</span>
            <span className="font-mono font-medium text-gray-900">
              {confirmedOrderId}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Courier:</span>
            <span className="font-semibold text-gray-900">{carrierName}</span>
          </div>
          <div className="flex justify-between border-t pt-1 font-semibold text-sm">
            <span>Pay on Delivery:</span>
            <span className="text-emerald-700">
              PKR {Math.round(grandTotal)}
            </span>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={() => router.push(`/track`)}
            className="px-5 py-2.5 bg-gray-900 hover:bg-gray-800 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition"
          >
            Track Shipment
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => router.push("/orders")}
            className="px-5 py-2.5 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg text-xs font-semibold transition"
          >
            My Orders
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg flex items-start gap-3">
        <Truck className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
        <div className="flex flex-col gap-1">
          <h4 className="text-sm font-bold text-emerald-950">
            Cash on Delivery with {carrierName}
          </h4>
          <p className="text-xs text-emerald-800 leading-relaxed">
            No upfront card payment required. Our courier rider will collect
            cash at your doorstep in{" "}
            <span className="font-semibold">{shippingForm.city}</span> before
            handing over your package.
          </p>
        </div>
      </div>

      <div className="border border-gray-200 rounded-lg p-4 bg-gray-50/50 flex flex-col gap-2 text-xs">
        <span className="font-semibold text-gray-900">
          Delivery & Collection Summary:
        </span>
        <div className="flex justify-between text-gray-600">
          <span>Recipient:</span>
          <span className="font-medium text-gray-900">
            {shippingForm.name} ({shippingForm.phone})
          </span>
        </div>
        <div className="flex justify-between text-gray-600">
          <span>Address:</span>
          <span className="font-medium text-gray-900">
            {shippingForm.address}, {shippingForm.city}
          </span>
        </div>
        <div className="flex justify-between text-gray-600">
          <span>Courier Service:</span>
          <span className="font-medium text-gray-900">
            {carrierName} ({shippingForm.serviceType})
          </span>
        </div>
        {codFee > 0 && (
          <div className="flex justify-between text-emerald-700">
            <span>COD Handling Fee:</span>
            <span className="font-medium">+PKR {codFee}</span>
          </div>
        )}
        <div className="border-t pt-2 flex justify-between font-bold text-sm text-gray-900">
          <span>Amount to Pay Rider:</span>
          <span className="text-emerald-700">PKR {Math.round(grandTotal)}</span>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <button
        onClick={handleConfirmCodOrder}
        disabled={loading}
        className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold py-3 px-4 rounded-lg text-sm flex items-center justify-center gap-2 transition cursor-pointer shadow-sm"
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
