"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { fetchTracking } from "@/services/shipping.service";
import type { TrackingResult } from "@repo/types";
import {
  Search,
  Truck,
  CheckCircle2,
  Clock,
  Navigation,
  AlertCircle,
  Loader2,
  MapPin,
  Banknote,
} from "lucide-react";

const steps = [
  { key: "READY_TO_SHIP", label: "Ready to Ship" },
  { key: "PICKED_UP", label: "Picked Up" },
  { key: "IN_TRANSIT", label: "In Transit" },
  { key: "OUT_FOR_DELIVERY", label: "Out for Delivery" },
  { key: "DELIVERED", label: "Delivered" },
];

function getStepIndex(status: string): number {
  switch (status) {
    case "LABEL_CREATED":
    case "READY_TO_SHIP":
      return 0;
    case "PICKED_UP":
      return 1;
    case "IN_TRANSIT":
      return 2;
    case "OUT_FOR_DELIVERY":
      return 3;
    case "DELIVERED":
      return 4;
    default:
      return 1;
  }
}

const getCarrierBadge = (carrier: string) => {
  const c = carrier.toLowerCase();
  if (c === "tcs") {
    return (
      <span className="font-bold text-xs px-2.5 py-1 rounded bg-red-100 text-red-700">
        TCS Express
      </span>
    );
  }
  if (c === "leopards") {
    return (
      <span className="font-bold text-xs px-2.5 py-1 rounded bg-amber-100 text-amber-800">
        Leopards Courier
      </span>
    );
  }
  if (c === "dhl") {
    return (
      <span className="font-bold text-xs px-2.5 py-1 rounded bg-yellow-100 text-yellow-900">
        DHL Express
      </span>
    );
  }
  if (c === "fedex") {
    return (
      <span className="font-bold text-xs px-2.5 py-1 rounded bg-purple-100 text-purple-700">
        FedEx
      </span>
    );
  }
  return (
    <span className="font-semibold text-xs px-2.5 py-1 rounded bg-slate-100 text-slate-700">
      Direct Carrier
    </span>
  );
};

function TrackContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialNumber = searchParams.get("number") || "";

  const [trackingNumber, setTrackingNumber] = useState(initialNumber);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<TrackingResult | null>(null);

  const handleSearch = useCallback(
    async (numToSearch: string) => {
      const trimmed = numToSearch.trim();
      if (!trimmed) return;

      setLoading(true);
      setError(null);

      try {
        const res = await fetchTracking(trimmed);
        if (!res) {
          throw new Error(
            `No shipment found matching tracking number or order "${trimmed}".`,
          );
        }
        setData(res);
        router.replace(`/track?number=${encodeURIComponent(trimmed)}`, {
          scroll: false,
        });
      } catch (err: unknown) {
        setError(
          err instanceof Error ? err.message : "Failed to load tracking data.",
        );
        setData(null);
      } finally {
        setLoading(false);
      }
    },
    [router],
  );

  useEffect(() => {
    if (initialNumber) {
      handleSearch(initialNumber);
    }
  }, [initialNumber, handleSearch]);

  const currentStep = data ? getStepIndex(data.status) : 0;

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      {/* HEADER */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center p-3 bg-gray-100 rounded-full mb-3 text-gray-800">
          <Truck className="w-8 h-8" />
        </div>
        <h1 className="text-3xl font-extrabold text-gray-900">
          Track Your Shipment
        </h1>
        <p className="text-sm text-gray-500 mt-2 max-w-md mx-auto">
          Enter your courier tracking number or order number for live updates,
          courier checkpoints, and delivery ETA.
        </p>
      </div>

      {/* SEARCH BOX */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-200 mb-8">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSearch(trackingNumber);
          }}
          className="flex gap-2"
        >
          <div className="relative flex-1">
            <Search className="w-5 h-5 absolute left-3.5 top-3.5 text-gray-400" />
            <input
              type="text"
              value={trackingNumber}
              onChange={(e) => setTrackingNumber(e.target.value)}
              placeholder="e.g. TCS-739182390 or order ID..."
              className="w-full pl-11 pr-4 py-3 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-900 focus:bg-white transition"
            />
          </div>
          <button
            type="submit"
            disabled={loading || !trackingNumber.trim()}
            className="px-6 py-3 bg-gray-900 hover:bg-gray-800 disabled:opacity-50 text-white rounded-xl text-sm font-semibold flex items-center gap-2 transition cursor-pointer"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Search className="w-4 h-4" />
            )}
            <span>Track</span>
          </button>
        </form>

        <div className="mt-3 flex items-center gap-2 text-xs text-gray-500">
          <span>Quick Try:</span>
          {["TCS-DEMO-001", "LEO-DEMO-002", "DHL-DEMO-003"].map((demo) => (
            <button
              key={demo}
              type="button"
              onClick={() => {
                setTrackingNumber(demo);
                handleSearch(demo);
              }}
              className="underline text-gray-700 hover:text-black font-medium cursor-pointer"
            >
              {demo}
            </button>
          ))}
        </div>
      </div>

      {/* ERROR MESSAGE */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-sm text-rose-800 flex items-start gap-3 mb-8">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Tracking lookup failed</p>
            <p className="text-xs text-rose-700 mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* LIVE TRACKING RESULT */}
      {data && (
        <div className="flex flex-col gap-6">
          {/* OVERVIEW CARD */}
          <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center justify-between pb-6 border-b border-gray-100 gap-4">
              <div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-gray-500">
                    Tracking Number:
                  </span>
                  <span className="font-mono text-base font-bold text-gray-900">
                    {data.trackingNumber}
                  </span>
                  {getCarrierBadge(data.carrier)}
                </div>
                <div className="text-xs text-gray-500 mt-1.5">
                  Shipment ID:{" "}
                  <span className="font-mono text-gray-700">
                    {data.shipmentId}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold px-3 py-1 rounded-full bg-emerald-100 text-emerald-800">
                  {data.status.replace(/_/g, " ")}
                </span>
                {data.estimatedDeliveryAt && (
                  <span className="text-xs text-gray-500 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    ETA:{" "}
                    {new Date(data.estimatedDeliveryAt).toLocaleDateString()}
                  </span>
                )}
              </div>
            </div>

            {/* COD NOTICE IF CASH ON DELIVERY */}
            {data.isCod && (
              <div className="mt-4 p-4 bg-emerald-50/70 border border-emerald-200 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                    <Banknote className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-emerald-950">
                      Cash on Delivery Consignment
                    </h4>
                    <p className="text-xs text-emerald-800">
                      Amount to pay rider:{" "}
                      <span className="font-bold text-emerald-900">
                        PKR{" "}
                        {data.codAmount
                          ? Number(data.codAmount).toLocaleString()
                          : "—"}
                      </span>
                    </p>
                  </div>
                </div>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-200 text-emerald-900">
                  {data.codStatus === "COLLECTED"
                    ? "Cash Collected"
                    : "Payment Pending"}
                </span>
              </div>
            )}

            {/* PROGRESS STEPPER */}
            <div className="mt-8 pt-4">
              <div className="relative flex items-center justify-between">
                <div className="absolute top-1/2 left-0 right-0 -translate-y-1/2 h-1 bg-gray-200 -z-0" />
                <div
                  className="absolute top-1/2 left-0 -translate-y-1/2 h-1 bg-gray-900 transition-all duration-500 -z-0"
                  style={{
                    width: `${(Math.min(currentStep, steps.length - 1) / (steps.length - 1)) * 100}%`,
                  }}
                />

                {steps.map((st, idx) => {
                  const isDone = idx <= currentStep;
                  const isCurrent = idx === currentStep;
                  return (
                    <div
                      key={st.key}
                      className="relative z-10 flex flex-col items-center gap-2 bg-white px-2"
                    >
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition ${
                          isDone
                            ? "bg-gray-900 text-white"
                            : "bg-gray-100 text-gray-400 border border-gray-200"
                        } ${isCurrent ? "ring-4 ring-gray-200" : ""}`}
                      >
                        {isDone ? (
                          <CheckCircle2 className="w-4 h-4" />
                        ) : (
                          idx + 1
                        )}
                      </div>
                      <span
                        className={`text-[11px] font-medium text-center hidden sm:block ${
                          isCurrent
                            ? "text-gray-900 font-bold"
                            : "text-gray-500"
                        }`}
                      >
                        {st.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* CHECKPOINT HISTORY */}
          <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
            <h3 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Navigation className="w-4 h-4 text-gray-600" />
              Tracking Milestones & Checkpoints
            </h3>

            {data.events.length === 0 ? (
              <p className="text-xs text-gray-500">
                No intermediate carrier scan events logged yet. The parcel is
                prepared for dispatch.
              </p>
            ) : (
              <div className="relative border-l-2 border-gray-200 ml-3 pl-6 space-y-6">
                {data.events.map((ev, index) => (
                  <div key={ev.id || index} className="relative">
                    <div className="absolute -left-[31px] top-0 w-3.5 h-3.5 rounded-full bg-gray-900 border-2 border-white ring-2 ring-gray-200" />
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-gray-900">
                          {ev.status.replace(/_/g, " ")}
                        </span>
                        <span className="text-xs text-gray-400">
                          {new Date(ev.occurredAt).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-xs text-gray-600 mt-1">
                        {ev.description}
                      </p>
                      {ev.location && (
                        <div className="flex items-center gap-1 text-[11px] text-gray-500 mt-1">
                          <MapPin className="w-3 h-3 text-gray-400" />
                          <span>{ev.location}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function TrackPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-4xl mx-auto py-20 text-center text-sm text-gray-500">
          Loading shipment tracker...
        </div>
      }
    >
      <TrackContent />
    </Suspense>
  );
}
