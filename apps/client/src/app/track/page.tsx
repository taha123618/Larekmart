"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { fetchTracking } from "@/services/shipping.service";
import { useWebSocket } from "@/hooks/useWebSocket";
import LiveDeliveryMap from "@/components/shipping/LiveDeliveryMap";
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
  Copy,
  Check,
  Package,
  ExternalLink,
  PhoneCall,
} from "lucide-react";

const steps = [
  {
    key: "READY_TO_SHIP",
    label: "Ready to Ship",
    desc: "Label generated & packed",
  },
  { key: "PICKED_UP", label: "Picked Up", desc: "Handed over to courier" },
  { key: "IN_TRANSIT", label: "In Transit", desc: "En route between hubs" },
  {
    key: "OUT_FOR_DELIVERY",
    label: "Out for Delivery",
    desc: "Rider dispatched to doorstep",
  },
  { key: "DELIVERED", label: "Delivered", desc: "Package signed & received" },
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
      <span className="font-bold text-xs px-3 py-1 rounded-full bg-red-50 text-red-700 border border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800/60 flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full bg-red-600" />
        TCS Express
      </span>
    );
  }
  if (c === "leopards") {
    return (
      <span className="font-bold text-xs px-3 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800/60 flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full bg-amber-600" />
        Leopards Courier
      </span>
    );
  }
  if (c === "dhl") {
    return (
      <span className="font-bold text-xs px-3 py-1 rounded-full bg-yellow-50 text-yellow-900 border border-yellow-300 dark:bg-yellow-950/40 dark:text-yellow-400 dark:border-yellow-800/60 flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full bg-yellow-500" />
        DHL Express
      </span>
    );
  }
  if (c === "fedex") {
    return (
      <span className="font-bold text-xs px-3 py-1 rounded-full bg-purple-50 text-purple-700 border border-purple-200 dark:bg-purple-950/40 dark:text-purple-400 dark:border-purple-800/60 flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full bg-purple-600" />
        FedEx
      </span>
    );
  }
  return (
    <span className="font-semibold text-xs px-3 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 flex items-center gap-1.5">
      <span className="w-2 h-2 rounded-full bg-slate-500" />
      Direct Courier
    </span>
  );
};

function TrackContent(): React.JSX.Element {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialNumber = searchParams.get("number") || "";

  const [trackingNumber, setTrackingNumber] = useState(initialNumber);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<TrackingResult | null>(null);
  const [copiedTracking, setCopiedTracking] = useState(false);

  const { isSignedIn, userId } = useAuth();
  const wsUrl =
    process.env.NEXT_PUBLIC_NOTIFICATION_WS_URL || "ws://localhost:8080/ws";
  const activeWsUrl =
    isSignedIn && userId
      ? `${wsUrl}?user_id=${encodeURIComponent(userId)}`
      : null;

  const { isReady, value: wsMsg } = useWebSocket<{
    type: string;
    shipment_id?: string;
    tracking_number?: string;
  }>(activeWsUrl);

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

  useEffect(() => {
    if (!wsMsg || !data) return;
    if (
      wsMsg.shipment_id === data.shipmentId ||
      wsMsg.tracking_number === data.trackingNumber ||
      wsMsg.type === "shipment_tracking_update"
    ) {
      handleSearch(data.trackingNumber);
    }
  }, [wsMsg, data, handleSearch]);

  const copyToClipboard = (text: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedTracking(true);
      setTimeout(() => setCopiedTracking(false), 2000);
    }
  };

  const currentStep = data ? getStepIndex(data.status) : 0;
  const isDelivered = data?.status === "DELIVERED";

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 sm:py-12">
      {/* HERO HEADER */}
      <div className="relative overflow-hidden bg-gradient-to-br from-slate-950 via-gray-900 to-zinc-900 text-white rounded-3xl p-8 sm:p-12 mb-8 shadow-xl text-center">
        <div className="relative z-10">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-white/10 text-white mb-4 backdrop-blur-md border border-white/10 shadow-lg">
            <Truck className="w-7 h-7" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
            Live Shipment Tracker
          </h1>
          <p className="text-sm sm:text-base text-gray-300 mt-2.5 max-w-lg mx-auto leading-relaxed">
            Track your packages in real-time across TCS, Leopards, DHL & FedEx
            with instant courier scan milestones.
          </p>

          {/* SEARCH BOX INSIDE HERO */}
          <div className="mt-8 max-w-xl mx-auto">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSearch(trackingNumber);
              }}
              className="flex flex-col sm:flex-row gap-2.5 bg-white/10 p-2 rounded-2xl border border-white/15 backdrop-blur-md shadow-2xl"
            >
              <div className="relative flex-1">
                <Search className="w-5 h-5 absolute left-3.5 top-3.5 text-gray-400" />
                <input
                  type="text"
                  value={trackingNumber}
                  onChange={(e) => setTrackingNumber(e.target.value)}
                  placeholder="Enter tracking # or order ID (e.g. TCS-DEMO-001)"
                  className="w-full pl-11 pr-4 py-3 text-sm bg-white dark:bg-slate-900 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium transition"
                />
              </div>
              <button
                type="submit"
                disabled={loading || !trackingNumber.trim()}
                className="px-7 py-3 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition cursor-pointer shadow-md shadow-emerald-500/20"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Search className="w-4 h-4" />
                )}
                <span>Track Order</span>
              </button>
            </form>

            {/* QUICK DEMO BADGES */}
            <div className="mt-3.5 flex flex-wrap items-center justify-center gap-2 text-xs text-gray-300">
              <span className="text-gray-400">Quick Test:</span>
              {["TCS-DEMO-001", "LEO-DEMO-002", "DHL-DEMO-003"].map((demo) => (
                <button
                  key={demo}
                  type="button"
                  onClick={() => {
                    setTrackingNumber(demo);
                    handleSearch(demo);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-gray-200 font-mono text-[11px] transition cursor-pointer border border-white/10"
                >
                  {demo}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ERROR MESSAGE */}
      {error && (
        <div className="p-5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 rounded-2xl text-sm text-rose-800 dark:text-rose-300 flex items-start gap-3.5 mb-8 shadow-sm animate-in fade-in">
          <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-bold text-rose-900 dark:text-rose-200">
              Shipment Not Located
            </p>
            <p className="text-xs text-rose-700 dark:text-rose-400 mt-1 leading-relaxed">
              {error}
            </p>
          </div>
        </div>
      )}

      {/* LIVE TRACKING RESULT */}
      {data && (
        <div className="flex flex-col gap-6 animate-in fade-in duration-300">
          {/* OVERVIEW CARD */}
          <div className="bg-white/95 dark:bg-slate-900/70 dark:backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)] rounded-3xl p-6 sm:p-8 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center justify-between pb-6 border-b border-gray-100 dark:border-slate-800 gap-4">
              <div>
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-slate-500">
                    Tracking No.
                  </span>
                  <span className="font-mono text-lg font-extrabold text-gray-900 dark:text-white">
                    {data.trackingNumber}
                  </span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(data.trackingNumber)}
                    className="p-1.5 hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-500 dark:text-slate-400 rounded-lg transition"
                    title="Copy tracking number"
                  >
                    {copiedTracking ? (
                      <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                  {getCarrierBadge(data.carrier)}
                </div>
                <div className="text-xs text-gray-500 dark:text-slate-400 mt-1 flex items-center gap-2">
                  <span>Shipment ID:</span>
                  <span className="font-mono text-gray-700 dark:text-slate-300 font-medium">
                    {data.shipmentId}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3 flex-wrap">
                <span
                  className={`text-xs font-bold px-3.5 py-1.5 rounded-full flex items-center gap-1.5 ${
                    isDelivered
                      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                      : "bg-blue-50 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800"
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      isDelivered
                        ? "bg-emerald-600 dark:bg-emerald-400"
                        : "bg-blue-600 dark:bg-blue-400 animate-pulse"
                    }`}
                  />
                  {data.status.replace(/_/g, " ")}
                </span>
                {data.estimatedDeliveryAt && (
                  <span className="text-xs font-medium text-gray-600 dark:text-slate-300 bg-gray-50 dark:bg-slate-800 px-3 py-1.5 rounded-full border border-gray-100 dark:border-slate-700 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-gray-400 dark:text-slate-500" />
                    ETA:{" "}
                    {new Date(data.estimatedDeliveryAt).toLocaleDateString()}
                  </span>
                )}
              </div>
            </div>

            {/* COD NOTICE IF CASH ON DELIVERY */}
            {data.isCod && (
              <div className="mt-6 p-4 sm:p-5 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/40 dark:to-teal-950/30 border border-emerald-200/80 dark:border-emerald-800/50 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                    <Banknote className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-emerald-950 dark:text-emerald-200">
                      Cash on Delivery (COD) Parcel
                    </h4>
                    <p className="text-xs text-emerald-800 dark:text-emerald-300 mt-0.5">
                      Pay rider upon doorstep delivery:{" "}
                      <span className="font-bold text-emerald-900 dark:text-emerald-100 text-sm">
                        PKR{" "}
                        {data.codAmount
                          ? Number(data.codAmount).toLocaleString()
                          : "—"}
                      </span>
                    </p>
                  </div>
                </div>
                <span className="text-xs font-bold px-3 py-1 rounded-full bg-white dark:bg-slate-900 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 w-max shadow-xs">
                  {data.codStatus === "COLLECTED"
                    ? "✓ Cash Collected"
                    : "Payment Due on Delivery"}
                </span>
              </div>
            )}

            {/* PROGRESS STEPPER */}
            <div className="mt-10 pt-4">
              <div className="relative flex items-center justify-between">
                <div className="absolute top-1/2 left-0 right-0 -translate-y-1/2 h-1 bg-gray-100 dark:bg-slate-800 -z-0" />
                <div
                  className="absolute top-1/2 left-0 -translate-y-1/2 h-1 bg-gray-900 dark:bg-emerald-500 transition-all duration-700 -z-0"
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
                      className="relative z-10 flex flex-col items-center gap-2 bg-white dark:bg-slate-900 px-1 sm:px-2"
                    >
                      <div
                        className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-xs font-bold transition-all shadow-xs ${
                          isDone
                            ? "bg-gray-900 dark:bg-emerald-600 text-white shadow-md"
                            : "bg-gray-50 dark:bg-slate-800 text-gray-400 dark:text-slate-500 border border-gray-200 dark:border-slate-700"
                        } ${isCurrent ? "ring-4 ring-emerald-100 dark:ring-emerald-950 border-2 border-emerald-500" : ""}`}
                      >
                        {isDone ? (
                          <CheckCircle2 className="w-5 h-5 text-white" />
                        ) : (
                          idx + 1
                        )}
                      </div>
                      <div className="text-center hidden sm:block">
                        <p
                          className={`text-xs font-bold leading-tight ${
                            isCurrent
                              ? "text-gray-900 dark:text-white"
                              : "text-gray-600 dark:text-slate-400"
                          }`}
                        >
                          {st.label}
                        </p>
                        <p className="text-[10px] text-gray-400 dark:text-slate-500 mt-0.5 max-w-[100px] leading-tight">
                          {st.desc}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* REAL-TIME DELIVERY RADAR MAP */}
          <LiveDeliveryMap data={data} isLiveConnected={isReady} />

          {/* CHECKPOINT HISTORY */}
          <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-sm">
            <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2.5">
              <Navigation className="w-5 h-5 text-gray-700 dark:text-slate-300" />
              <span>Tracking Milestones & Courier Scans</span>
            </h3>

            {data.events.length === 0 ? (
              <div className="p-8 text-center bg-gray-50 dark:bg-slate-800/50 rounded-2xl border border-gray-100 dark:border-slate-700/60">
                <Package className="w-8 h-8 text-gray-400 dark:text-slate-500 mx-auto mb-2" />
                <p className="text-sm font-semibold text-gray-700 dark:text-slate-200">
                  Parcel Prepared for Carrier Handover
                </p>
                <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                  Tracking scans usually update within 2 to 4 hours after
                  courier pickup.
                </p>
              </div>
            ) : (
              <div className="relative border-l-2 border-gray-200 dark:border-slate-700 ml-3 pl-6 space-y-6">
                {data.events.map((ev, index) => {
                  const isLatest = index === 0;
                  return (
                    <div key={ev.id || index} className="relative group">
                      <div
                        className={`absolute -left-[31px] top-1 w-3.5 h-3.5 rounded-full border-2 border-white dark:border-slate-900 ring-2 ${
                          isLatest
                            ? "bg-emerald-500 ring-emerald-200 dark:ring-emerald-900/60 animate-pulse"
                            : "bg-gray-400 dark:bg-slate-600 ring-gray-100 dark:ring-slate-800"
                        }`}
                      />
                      <div className="bg-gray-50/70 hover:bg-gray-50 dark:bg-slate-800/60 dark:hover:bg-slate-800 p-4 rounded-2xl border border-gray-100 dark:border-slate-700/60 transition">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <span className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wide">
                            {ev.status.replace(/_/g, " ")}
                          </span>
                          <span className="text-[11px] font-medium text-gray-400 dark:text-slate-400">
                            {new Date(ev.occurredAt).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-xs text-gray-600 dark:text-slate-300 mt-1.5 leading-relaxed">
                          {ev.description}
                        </p>
                        {ev.location && (
                          <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-slate-400 mt-2 font-medium">
                            <MapPin className="w-3.5 h-3.5 text-gray-400 dark:text-slate-500" />
                            <span>{ev.location}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* COURIER ASSISTANCE & SUPPORT */}
          <div className="bg-gray-50/80 dark:bg-slate-800/50 border border-gray-100 dark:border-slate-700/60 rounded-3xl p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 text-gray-800 dark:text-slate-200 flex items-center justify-center shrink-0 shadow-sm">
                <PhoneCall className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-gray-900 dark:text-white">
                  Need Help with this Shipment?
                </h4>
                <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                  Contact our logistics dispatch desk or courier support
                  directly.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <a
                href="mailto:support@larekmart.com"
                className="px-5 py-2.5 bg-white hover:bg-gray-100 dark:bg-slate-900 dark:hover:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-800 dark:text-slate-200 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
              >
                <span>Email Support</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
              <button
                type="button"
                onClick={() => handleSearch(trackingNumber)}
                className="px-5 py-2.5 bg-gray-900 hover:bg-black dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Refresh Status
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function TrackPage(): React.JSX.Element {
  return (
    <Suspense
      fallback={
        <div className="max-w-4xl mx-auto py-24 text-center flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
          <p className="text-sm text-gray-500 font-medium">
            Loading shipment tracking engine...
          </p>
        </div>
      }
    >
      <TrackContent />
    </Suspense>
  );
}
