import type React from "react";
import { auth } from "@clerk/nextjs/server";
import { OrderType } from "@repo/types";
import RecommendationSection from "@/components/RecommendationSection";
import Link from "next/link";
import {
  Truck,
  ExternalLink,
  Package,
  Calendar,
  CreditCard,
  Banknote,
} from "lucide-react";

const fetchOrders = async () => {
  const { getToken } = await auth();
  const token = await getToken();

  const orderServiceUrl =
    process.env.NEXT_PUBLIC_ORDER_SERVICE_URL ||
    process.env.NEXT_PUBLIC_API_GATEWAY_URL ||
    "http://localhost:8090";
  const res = await fetch(`${orderServiceUrl}/user-orders`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    return [];
  }

  const data: OrderType[] = await res.json();
  return data;
};

const getCarrierBadge = (carrier?: string | null) => {
  const c = (carrier || "custom").toLowerCase();
  if (c === "tcs") {
    return (
      <span className="font-bold text-[11px] px-2 py-0.5 rounded bg-red-100 text-red-700">
        TCS Express
      </span>
    );
  }
  if (c === "leopards") {
    return (
      <span className="font-bold text-[11px] px-2 py-0.5 rounded bg-amber-100 text-amber-800">
        Leopards
      </span>
    );
  }
  if (c === "dhl") {
    return (
      <span className="font-bold text-[11px] px-2 py-0.5 rounded bg-yellow-100 text-yellow-900">
        DHL Express
      </span>
    );
  }
  if (c === "fedex") {
    return (
      <span className="font-bold text-[11px] px-2 py-0.5 rounded bg-purple-100 text-purple-700">
        FedEx
      </span>
    );
  }
  return (
    <span className="font-semibold text-[11px] px-2 py-0.5 rounded bg-slate-100 text-slate-700">
      Direct Courier
    </span>
  );
};

const OrdersPage = async (): Promise<React.JSX.Element> => {
  const orders = await fetchOrders();

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            My Orders & Tracking
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Real-time fulfillment updates, carrier delivery milestones, and order receipts
          </p>
        </div>
        <Link
          href="/track"
          className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 transition shadow-xs shrink-0 self-start sm:self-auto"
        >
          <Truck className="w-4 h-4" />
          Track Any Package
        </Link>
      </div>

      {!orders || orders.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-3xl border border-slate-200/80 shadow-xs">
          <Package className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-800">
            No orders placed yet
          </h3>
          <p className="text-xs text-slate-500 mt-1 mb-4">
            Items you purchase will appear here along with live carrier tracking.
          </p>
          <Link
            href="/products"
            className="inline-flex items-center px-5 py-2.5 bg-indigo-600 text-white text-xs font-bold rounded-xl hover:bg-indigo-700 transition shadow-xs"
          >
            Start Shopping
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {orders.map((order) => {
            const trackQuery = order.trackingNumber || order._id;
            return (
              <div
                key={order._id}
                className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs hover:shadow-md transition flex flex-col md:flex-row md:items-center justify-between gap-6"
              >
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="font-mono text-xs font-black text-slate-900 bg-slate-100 px-2 py-0.5 rounded-lg">
                      #{order._id.slice(-8).toUpperCase()}
                    </span>
                    {getCarrierBadge(order.carrier)}
                    {order.isCod ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                        <Banknote className="w-3 h-3" />
                        Cash on Delivery
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-200">
                        <CreditCard className="w-3 h-3" />
                        Card Paid
                      </span>
                    )}
                    <span className="inline-flex items-center px-2.5 py-0.5 text-[11px] font-black rounded-full bg-emerald-100 text-emerald-800 capitalize">
                      {order.status}
                    </span>
                  </div>

                  <div className="flex items-center gap-4 text-xs text-gray-500 mt-1">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      {order.createdAt
                        ? new Date(order.createdAt).toLocaleDateString(
                          "en-US",
                          {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          },
                        )
                        : "-"}
                    </span>
                    <span>•</span>
                    <span className="font-medium text-gray-900">
                      Total: ${(order.amount / 100).toFixed(2)}
                    </span>
                    {order.trackingNumber && (
                      <>
                        <span>•</span>
                        <span className="font-mono text-gray-700">
                          Tracking:{" "}
                          <span className="font-semibold text-gray-900">
                            {order.trackingNumber}
                          </span>
                        </span>
                      </>
                    )}
                  </div>

                  <div className="text-xs text-gray-600 mt-1">
                    <span className="font-medium text-gray-700">Items: </span>
                    {order.products
                      ?.map((p) => `${p.name} (x${p.quantity})`)
                      .join(", ") || "-"}
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-3 md:pt-0 border-t md:border-t-0 border-gray-100">
                  <Link
                    href={`/track?number=${encodeURIComponent(trackQuery)}`}
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 transition shadow-xs"
                  >
                    <Truck className="w-3.5 h-3.5" />
                    Track Shipment
                    <ExternalLink className="w-3 h-3" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-16 border-t pt-8">
        <RecommendationSection
          title="Recommended For Your Next Order"
          subtitle="More styles curated to match your order history and tastes"
          type="personalized"
          limit={4}
        />
      </div>
    </div>
  );
};

export default OrdersPage;
