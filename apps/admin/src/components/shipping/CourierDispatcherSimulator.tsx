"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Truck,
  Radio,
  MapPin,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Send,
  Zap,
} from "lucide-react";
import type { Shipment } from "@repo/types";
import { updateShipmentLocation } from "@/lib/shipping.service";

interface CourierDispatcherSimulatorProps {
  shipments: Shipment[];
}

const CITY_PRESETS = [
  {
    name: "Karachi Central Hub",
    location: "KHI Hub (S.I.T.E Area)",
    lat: 24.8607,
    lng: 67.0011,
    heading: 45,
  },
  {
    name: "Lahore Sorting Facility",
    location: "LHE Hub (Gulberg III)",
    lat: 31.5204,
    lng: 74.3587,
    heading: 90,
  },
  {
    name: "Islamabad Express Center",
    location: "ISB Gateway (I-9 Industrial)",
    lat: 33.6844,
    lng: 73.0479,
    heading: 180,
  },
  {
    name: "Customer Doorstep Beat",
    location: "Last-Mile Delivery Route",
    lat: 24.8934,
    lng: 67.0281,
    heading: 270,
  },
];

export default function CourierDispatcherSimulator({
  shipments,
}: CourierDispatcherSimulatorProps) {
  const router = useRouter();

  const [isOpen, setIsOpen] = useState(false);
  const [selectedShipmentId, setSelectedShipmentId] = useState<string>(
    shipments[0]?.id || "",
  );
  const [status, setStatus] = useState<string>("OUT_FOR_DELIVERY");
  const [location, setLocation] = useState<string>(CITY_PRESETS[0]!.location);
  const [description, setDescription] = useState<string>(
    "Courier rider assigned and dispatched with shipment for final doorstep delivery.",
  );
  const [latitude, setLatitude] = useState<number>(CITY_PRESETS[0]!.lat);
  const [longitude, setLongitude] = useState<number>(CITY_PRESETS[0]!.lng);
  const [heading, setHeading] = useState<number>(CITY_PRESETS[0]!.heading);
  const [etaMinutes, setEtaMinutes] = useState<number>(25);

  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const applyPreset = (preset: (typeof CITY_PRESETS)[0]) => {
    setLocation(preset.location);
    setLatitude(preset.lat);
    setLongitude(preset.lng);
    setHeading(preset.heading);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedShipmentId) {
      setFeedback({
        type: "error",
        message: "Please select or enter a valid shipment ID.",
      });
      return;
    }

    setLoading(true);
    setFeedback(null);

    try {
      const res = await updateShipmentLocation(selectedShipmentId, {
        status,
        location,
        description,
        latitude,
        longitude,
        heading,
        accuracyMeters: 5,
        etaMinutes,
      });

      if (res.success) {
        setFeedback({
          type: "success",
          message: `Courier telemetry emitted to Kafka (tracking.updated & shipping.tracking.updated) & broadcasted via WebSockets for shipment ${selectedShipmentId.slice(0, 8)}...`,
        });
        router.refresh();
      } else {
        setFeedback({
          type: "error",
          message: res.message || "Failed to transmit location update.",
        });
      }
    } catch (err) {
      setFeedback({
        type: "error",
        message:
          err instanceof Error ? err.message : "Unexpected transmission error.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-primary-foreground rounded-xl border border-border/40 p-5 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border/40">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 mb-1.5">
            <Radio className="w-3 h-3 animate-pulse text-emerald-500" />
            <span>Real-Time Geolocation Telemetry</span>
          </div>
          <h2 className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2">
            <Zap className="w-5 h-5 text-amber-500" />
            <span>Courier Dispatch & Live GPS Simulator</span>
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Broadcast simulated GPS coordinates, vehicle heading, and scan
            milestones to consumer storefronts and tracking maps in real time.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-semibold rounded-lg transition flex items-center justify-center gap-2 cursor-pointer shadow-xs"
        >
          <Truck className="w-4 h-4" />
          <span>{isOpen ? "Close Simulator" : "Open Dispatch Simulator"}</span>
        </button>
      </div>

      {isOpen && (
        <form
          onSubmit={handleSubmit}
          className="mt-5 space-y-4 animate-in fade-in"
        >
          {/* FEEDBACK BANNER */}
          {feedback && (
            <div
              className={`p-3.5 rounded-lg text-xs flex items-start gap-2.5 border ${
                feedback.type === "success"
                  ? "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/60"
                  : "bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/60"
              }`}
            >
              {feedback.type === "success" ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
              )}
              <div className="flex-1">
                <p className="font-semibold">{feedback.message}</p>
              </div>
            </div>
          )}

          {/* QUICK PRESETS */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              Rapid Geolocation Presets:
            </label>
            <div className="flex flex-wrap gap-2">
              {CITY_PRESETS.map((p) => (
                <button
                  key={p.name}
                  type="button"
                  onClick={() => applyPreset(p)}
                  className="px-2.5 py-1 text-xs rounded-md bg-secondary hover:bg-secondary/80 border border-border/60 text-foreground transition cursor-pointer flex items-center gap-1.5"
                >
                  <MapPin className="w-3 h-3 text-muted-foreground" />
                  <span>{p.name}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
            {/* SHIPMENT SELECT */}
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                Target Shipment
              </label>
              {shipments.length > 0 ? (
                <select
                  value={selectedShipmentId}
                  onChange={(e) => setSelectedShipmentId(e.target.value)}
                  className="w-full text-xs rounded-lg border border-border bg-background px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  {shipments.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.carrier.toUpperCase()} —{" "}
                      {s.trackingNumber || s.id.slice(0, 10)} ({s.status})
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={selectedShipmentId}
                  onChange={(e) => setSelectedShipmentId(e.target.value)}
                  placeholder="Paste Shipment ID or UUID"
                  className="w-full text-xs rounded-lg border border-border bg-background px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary font-mono"
                />
              )}
            </div>

            {/* MILESTONE STATUS */}
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                Milestone Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full text-xs rounded-lg border border-border bg-background px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="IN_TRANSIT">IN_TRANSIT (Between Hubs)</option>
                <option value="OUT_FOR_DELIVERY">
                  OUT_FOR_DELIVERY (Last-Mile Doorstep)
                </option>
                <option value="DELIVERED">DELIVERED (Signed & Received)</option>
                <option value="EXCEPTION">
                  EXCEPTION (Delivery Attempt Failed)
                </option>
              </select>
            </div>

            {/* LOCATION NAME */}
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                Checkpoint Name / Hub
              </label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. Karachi Central Hub"
                className="w-full text-xs rounded-lg border border-border bg-background px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                required
              />
            </div>
          </div>

          {/* TELEMETRY INPUTS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 pt-1">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                Latitude (°N)
              </label>
              <input
                type="number"
                step="any"
                value={latitude}
                onChange={(e) => setLatitude(parseFloat(e.target.value) || 0)}
                className="w-full text-xs rounded-lg border border-border bg-background px-3 py-2 font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                Longitude (°E)
              </label>
              <input
                type="number"
                step="any"
                value={longitude}
                onChange={(e) => setLongitude(parseFloat(e.target.value) || 0)}
                className="w-full text-xs rounded-lg border border-border bg-background px-3 py-2 font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1 flex items-center justify-between">
                <span>Heading Compass</span>
                <span className="font-mono text-[10px] text-muted-foreground">
                  {heading}°
                </span>
              </label>
              <input
                type="range"
                min="0"
                max="360"
                value={heading}
                onChange={(e) => setHeading(parseInt(e.target.value, 10))}
                className="w-full h-8"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1 flex items-center justify-between">
                <span>Doorstep ETA</span>
                <span className="font-mono text-[10px] text-muted-foreground">
                  {etaMinutes} min
                </span>
              </label>
              <input
                type="number"
                min="1"
                max="360"
                value={etaMinutes}
                onChange={(e) =>
                  setEtaMinutes(parseInt(e.target.value, 10) || 15)
                }
                className="w-full text-xs rounded-lg border border-border bg-background px-3 py-2 font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          {/* DESCRIPTION */}
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1">
              Event Description / Rider Notes
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Package loaded onto courier van for doorstep delivery"
              className="w-full text-xs rounded-lg border border-border bg-background px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              required
            />
          </div>

          {/* SUBMIT BUTTON */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="px-4 py-2 border border-border rounded-lg text-xs font-medium text-muted-foreground hover:bg-secondary transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition flex items-center gap-2 cursor-pointer shadow-sm"
            >
              {loading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Send className="w-3.5 h-3.5" />
              )}
              <span>Transmit Geolocation & Update Scan</span>
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
