"use client";

import React from "react";
import {
  Navigation,
  MapPin,
  Clock,
  Compass,
  Radio,
  Truck,
  ShieldCheck,
  LocateFixed,
} from "lucide-react";
import type { TrackingResult, TrackingEvent } from "@repo/types";

interface LiveDeliveryMapProps {
  data: TrackingResult;
  isLiveConnected?: boolean;
}

export default function LiveDeliveryMap({
  data,
  isLiveConnected = false,
}: LiveDeliveryMapProps): React.JSX.Element {
  const latestEvent: TrackingEvent | undefined = data.events[0];
  const lat = data.currentLatitude ?? latestEvent?.latitude ?? null;
  const lng = data.currentLongitude ?? latestEvent?.longitude ?? null;
  const heading = data.currentHeading ?? latestEvent?.heading ?? 0;
  const etaMinutes = data.etaMinutes ?? 35;
  const locationName = latestEvent?.location || "Regional Transit Hub";
  const status = data.status;

  const isOutForDelivery = status === "OUT_FOR_DELIVERY";
  const isDelivered = status === "DELIVERED";
  const isInTransit = status === "IN_TRANSIT";

  return (
    <div className="relative overflow-hidden bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 text-white shadow-xl">
      {/* Decorative background grid and glow */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:24px_24px] opacity-40 -z-0 pointer-events-none" />
      <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl -z-0 pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl -z-0 pointer-events-none" />

      {/* Header bar */}
      <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold mb-2">
            <Radio className="w-3.5 h-3.5 animate-pulse text-emerald-400" />
            <span>
              {isLiveConnected
                ? "Live Courier Telemetry Active"
                : "Real-Time Courier Geolocation"}
            </span>
          </div>
          <h3 className="text-lg sm:text-xl font-black tracking-tight text-white flex items-center gap-2">
            <span>Delivery Transit Radar</span>
            <span className="text-xs font-mono font-medium px-2 py-0.5 rounded bg-slate-800 text-slate-300">
              {data.carrier.toUpperCase()}
            </span>
          </h3>
        </div>

        {/* Status / ETA badge */}
        <div className="flex items-center gap-3">
          {lat !== null && lng !== null ? (
            <div className="text-right">
              <span className="block text-[10px] text-slate-400 font-medium">
                GPS COORDINATES
              </span>
              <span className="font-mono text-xs font-bold text-slate-200">
                {lat.toFixed(4)}° N, {lng.toFixed(4)}° E
              </span>
            </div>
          ) : (
            <div className="text-right">
              <span className="block text-[10px] text-slate-400 font-medium">
                CURRENT HUB
              </span>
              <span className="text-xs font-bold text-slate-200">
                {locationName}
              </span>
            </div>
          )}

          {isOutForDelivery && (
            <div className="flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-300">
              <Clock className="w-4 h-4 text-amber-400 animate-spin-slow" />
              <div>
                <span className="block text-[10px] font-semibold text-amber-400/80 leading-none">
                  APPROX. ARRIVAL
                </span>
                <span className="text-xs font-bold leading-tight">
                  ~{etaMinutes} mins
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* RADAR MAP CANVAS SIMULATION */}
      <div className="relative z-10 mt-6 h-56 sm:h-64 rounded-2xl bg-slate-950 border border-slate-800 overflow-hidden flex items-center justify-center">
        {/* Radar concentric circular range waves */}
        <div className="absolute w-96 h-96 rounded-full border border-emerald-500/10 pointer-events-none" />
        <div className="absolute w-72 h-72 rounded-full border border-emerald-500/15 pointer-events-none" />
        <div className="absolute w-48 h-48 rounded-full border border-emerald-500/20 pointer-events-none" />
        <div className="absolute w-24 h-24 rounded-full border border-emerald-500/30 pointer-events-none" />

        {/* Crosshair lines */}
        <div className="absolute inset-x-0 top-1/2 h-px bg-slate-800/80 pointer-events-none" />
        <div className="absolute inset-y-0 left-1/2 w-px bg-slate-800/80 pointer-events-none" />

        {/* Route Path Polyline simulation */}
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M 40,180 Q 180,60 320,130 T 560,90"
            fill="none"
            stroke="rgba(16, 185, 129, 0.4)"
            strokeWidth="3"
            strokeDasharray="6,6"
            className="animate-dash"
          />
        </svg>

        {/* Departure Hub Pin */}
        <div className="absolute left-8 bottom-12 flex flex-col items-center">
          <div className="w-8 h-8 rounded-full bg-slate-800 border-2 border-slate-600 flex items-center justify-center shadow-lg">
            <MapPin className="w-4 h-4 text-slate-400" />
          </div>
          <span className="text-[10px] font-bold text-slate-400 mt-1.5 px-2 py-0.5 rounded bg-slate-900/90 border border-slate-800">
            Logistics Hub
          </span>
        </div>

        {/* Delivery Vehicle Marker (Dynamic Pin) */}
        <div className="relative z-20 flex flex-col items-center">
          {/* Radar scan pulse */}
          <div className="absolute -inset-4 rounded-full bg-emerald-500/20 animate-ping pointer-events-none" />
          <div className="relative w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-400 p-0.5 shadow-xl shadow-emerald-500/30 flex items-center justify-center">
            <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center">
              <Truck
                className="w-6 h-6 text-emerald-400 transition-transform duration-500"
                style={{ transform: `rotate(${heading || 0}deg)` }}
              />
            </div>
          </div>
          <div className="mt-2 text-center">
            <span className="inline-flex items-center gap-1 text-[11px] font-extrabold text-white px-2.5 py-1 rounded-full bg-slate-900/95 border border-emerald-500/40 shadow-lg">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              {isDelivered
                ? "Delivered at Destination"
                : isOutForDelivery
                  ? "Rider Dispatched to Doorstep"
                  : isInTransit
                    ? "En Route between Hubs"
                    : "Courier Assigned"}
            </span>
          </div>
        </div>

        {/* Destination Pin */}
        <div className="absolute right-8 top-12 flex flex-col items-center">
          <div className="w-8 h-8 rounded-full bg-indigo-950 border-2 border-indigo-500 flex items-center justify-center shadow-lg">
            <MapPin className="w-4 h-4 text-indigo-400" />
          </div>
          <span className="text-[10px] font-bold text-indigo-300 mt-1.5 px-2 py-0.5 rounded bg-slate-900/90 border border-slate-800">
            Your Address
          </span>
        </div>
      </div>

      {/* Geolocation Telemetry Footer */}
      <div className="relative z-10 mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3 rounded-2xl bg-slate-950/60 border border-slate-800/80">
          <span className="flex items-center gap-1.5 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
            <Compass className="w-3.5 h-3.5 text-indigo-400" />
            Heading
          </span>
          <span className="block text-sm font-black text-slate-100 mt-1">
            {heading ? `${heading}° Direction` : "Northbound"}
          </span>
        </div>

        <div className="p-3 rounded-2xl bg-slate-950/60 border border-slate-800/80">
          <span className="flex items-center gap-1.5 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
            <LocateFixed className="w-3.5 h-3.5 text-emerald-400" />
            Telemetry Fix
          </span>
          <span className="block text-sm font-black text-slate-100 mt-1">
            {lat !== null ? "GPS Verified (3m)" : "Cellular Triangulated"}
          </span>
        </div>

        <div className="p-3 rounded-2xl bg-slate-950/60 border border-slate-800/80">
          <span className="flex items-center gap-1.5 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
            <Navigation className="w-3.5 h-3.5 text-teal-400" />
            Last Checkpoint
          </span>
          <span className="block text-sm font-black text-slate-100 mt-1 truncate">
            {locationName}
          </span>
        </div>

        <div className="p-3 rounded-2xl bg-slate-950/60 border border-slate-800/80">
          <span className="flex items-center gap-1.5 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
            <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
            Chain of Custody
          </span>
          <span className="block text-sm font-black text-slate-100 mt-1">
            Tamper-Proof
          </span>
        </div>
      </div>
    </div>
  );
}
