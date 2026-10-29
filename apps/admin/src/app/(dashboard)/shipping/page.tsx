import {
  fetchShipments,
  fetchShippingMethods,
  type ShipmentListResponse,
} from "@/lib/shipping.service";
import {
  Truck,
  CheckCircle,
  AlertCircle,
  Clock,
  Send,
  Navigation,
  CheckCircle2,
  XCircle,
  ExternalLink,
  MapPin,
  Box,
  Banknote,
  Filter,
} from "lucide-react";
import type { Shipment, ShippingMethod } from "@repo/types";
import Link from "next/link";
import CourierDispatcherSimulator from "@/components/shipping/CourierDispatcherSimulator";
import { getApiGatewayUrl } from "@/services/gateway.service";

async function getShippingHealth(): Promise<{ ok: boolean; status?: string }> {
  try {
    const base = getApiGatewayUrl();
    const res = await fetch(`${base}/api/v1/health/ready`, {
      cache: "no-store",
    });
    if (res.ok) {
      const data = (await res.json()) as { status?: string };
      return { ok: true, status: data.status };
    }
    return { ok: false };
  } catch {
    return { ok: false };
  }
}

const StatCard = ({
  title,
  value,
  icon: Icon,
  color = "blue",
  subtitle,
}: {
  title: string;
  value: string | number;
  icon: React.ElementType;
  color?: "blue" | "green" | "amber" | "purple" | "rose" | "indigo" | "emerald";
  subtitle?: string;
}) => {
  const colorClasses = {
    blue: "bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400",
    green: "bg-green-50 text-green-600 dark:bg-green-950 dark:text-green-400",
    amber: "bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400",
    purple:
      "bg-purple-50 text-purple-600 dark:bg-purple-950 dark:text-purple-400",
    rose: "bg-rose-50 text-rose-600 dark:bg-rose-950 dark:text-rose-400",
    indigo:
      "bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400",
    emerald:
      "bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400",
  };
  return (
    <div className="bg-primary-foreground rounded-xl p-5 flex items-center gap-4 border border-border/40">
      <div className={`p-3 rounded-lg ${colorClasses[color]}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-sm text-muted-foreground">{title}</p>
        <p className="text-2xl font-bold">{value}</p>
        {subtitle && (
          <p className="text-[11px] text-muted-foreground mt-0.5">{subtitle}</p>
        )}
      </div>
    </div>
  );
};

const getStatusBadge = (status: string) => {
  switch (status) {
    case "DELIVERED":
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
          <CheckCircle2 className="w-3 h-3" />
          Delivered
        </span>
      );
    case "OUT_FOR_DELIVERY":
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300">
          <Navigation className="w-3 h-3" />
          Out for Delivery
        </span>
      );
    case "IN_TRANSIT":
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">
          <Send className="w-3 h-3" />
          In Transit
        </span>
      );
    case "LABEL_CREATED":
    case "READY_TO_SHIP":
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
          <Clock className="w-3 h-3" />
          {status.replace(/_/g, " ")}
        </span>
      );
    case "CANCELLED":
    case "FAILED":
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300">
          <XCircle className="w-3 h-3" />
          {status}
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300">
          {status}
        </span>
      );
  }
};

const getCarrierBadge = (carrier: string) => {
  const c = carrier.toLowerCase();
  if (c === "tcs") {
    return (
      <span className="font-bold text-xs px-2 py-0.5 rounded bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300">
        TCS
      </span>
    );
  }
  if (c === "leopards") {
    return (
      <span className="font-bold text-xs px-2 py-0.5 rounded bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300">
        LEOPARDS
      </span>
    );
  }
  if (c === "dhl") {
    return (
      <span className="font-bold text-xs px-2 py-0.5 rounded bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300">
        DHL
      </span>
    );
  }
  if (c === "fedex") {
    return (
      <span className="font-bold text-xs px-2 py-0.5 rounded bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300">
        FEDEX
      </span>
    );
  }
  return (
    <span className="font-semibold text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
      CUSTOM
    </span>
  );
};

interface ShippingPageProps {
  searchParams?: Promise<{
    carrier?: string;
    status?: string;
    isCod?: string;
    search?: string;
  }>;
}

const ShippingPage = async ({ searchParams }: ShippingPageProps) => {
  const resolvedParams = searchParams ? await searchParams : {};
  const activeCarrier = resolvedParams.carrier || "all";
  const activeStatus = resolvedParams.status || "all";
  const activeCodFilter = resolvedParams.isCod; // "true", "false", or undefined

  const [healthResult, shipmentsResult, methodsResult] =
    await Promise.allSettled([
      getShippingHealth(),
      fetchShipments({
        limit: 100,
        carrier: activeCarrier,
        status: activeStatus,
        isCod: activeCodFilter ? activeCodFilter === "true" : undefined,
      }),
      fetchShippingMethods(),
    ]);

  const health =
    healthResult.status === "fulfilled" ? healthResult.value : { ok: false };
  const shipmentsData: ShipmentListResponse =
    shipmentsResult.status === "fulfilled"
      ? shipmentsResult.value
      : {
          shipments: [],
          pagination: { page: 1, limit: 100, total: 0, totalPages: 0 },
        };
  const methodsData: ShippingMethod[] =
    methodsResult.status === "fulfilled" ? methodsResult.value : [];

  const shipments: Shipment[] = shipmentsData.shipments;
  const inTransitCount = shipments.filter(
    (s) =>
      s.status === "IN_TRANSIT" ||
      s.status === "PICKED_UP" ||
      s.status === "OUT_FOR_DELIVERY",
  ).length;
  const deliveredCount = shipments.filter(
    (s) => s.status === "DELIVERED",
  ).length;

  const codShipments = shipments.filter((s) => s.isCod);
  const totalCodCollected = codShipments
    .filter((s) => s.codStatus === "COLLECTED")
    .reduce((sum, s) => sum + (s.codAmount ? Number(s.codAmount) : 0), 0);
  const totalCodPending = codShipments
    .filter((s) => s.codStatus !== "COLLECTED")
    .reduce((sum, s) => sum + (s.codAmount ? Number(s.codAmount) : 0), 0);

  const clientBase =
    process.env.NEXT_PUBLIC_CLIENT_URL || "http://localhost:3002";

  return (
    <div className="flex flex-col gap-6 pb-12">
      {/* HEADER */}
      <div className="flex items-center justify-between mb-2 py-3 px-4 bg-secondary rounded-lg">
        <div className="flex items-center gap-2">
          <Truck className="w-5 h-5 text-primary" />
          <h1 className="font-semibold text-lg">Logistics & Shipments</h1>
          <span className="text-xs text-muted-foreground ml-2">
            (shipping-service @ port 8011)
          </span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          {health.ok ? (
            <>
              <CheckCircle className="w-4 h-4 text-emerald-500" />
              <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                Carrier Adapters & Service Ready
              </span>
            </>
          ) : (
            <>
              <AlertCircle className="w-4 h-4 text-rose-500" />
              <span className="text-rose-600 dark:text-rose-400 font-medium">
                Shipping Service Offline
              </span>
            </>
          )}
        </div>
      </div>

      {/* STAT CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Shipments"
          value={shipmentsData.pagination.total}
          icon={Box}
          color="blue"
        />
        <StatCard
          title="Active in Transit"
          value={inTransitCount}
          icon={Send}
          color="indigo"
          subtitle={`${deliveredCount} fulfilled & delivered`}
        />
        <StatCard
          title="COD Collected"
          value={`PKR ${totalCodCollected.toLocaleString()}`}
          icon={Banknote}
          color="emerald"
          subtitle="Delivered & funds received"
        />
        <StatCard
          title="COD Pending"
          value={`PKR ${totalCodPending.toLocaleString()}`}
          icon={Clock}
          color="amber"
          subtitle="Awaiting rider cash collection"
        />
      </div>

      {/* COURIER DISPATCH & GEOLOCATION TELEMETRY SIMULATOR */}
      <CourierDispatcherSimulator shipments={shipments} />

      {/* FILTER TABS & TOOLBAR */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-primary-foreground p-3 rounded-xl border border-border/40 text-xs">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-muted-foreground font-medium flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" />
            Payment Type:
          </span>
          <Link
            href="/shipping"
            className={`px-3 py-1.5 rounded-lg font-medium transition ${
              !activeCodFilter
                ? "bg-primary text-primary-foreground font-semibold"
                : "bg-secondary text-secondary-foreground hover:bg-muted"
            }`}
          >
            All Shipments
          </Link>
          <Link
            href="/shipping?isCod=true"
            className={`px-3 py-1.5 rounded-lg font-medium transition ${
              activeCodFilter === "true"
                ? "bg-primary text-primary-foreground font-semibold"
                : "bg-secondary text-secondary-foreground hover:bg-muted"
            }`}
          >
            Cash on Delivery (COD)
          </Link>
          <Link
            href="/shipping?isCod=false"
            className={`px-3 py-1.5 rounded-lg font-medium transition ${
              activeCodFilter === "false"
                ? "bg-primary text-primary-foreground font-semibold"
                : "bg-secondary text-secondary-foreground hover:bg-muted"
            }`}
          >
            Prepaid Card
          </Link>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-muted-foreground font-medium">Carrier:</span>
          {["all", "tcs", "leopards", "dhl", "fedex", "custom"].map((c) => (
            <Link
              key={c}
              href={`/shipping?carrier=${c}${activeCodFilter ? `&isCod=${activeCodFilter}` : ""}`}
              className={`px-2.5 py-1 rounded font-medium uppercase text-[11px] transition ${
                activeCarrier === c
                  ? "bg-primary text-primary-foreground font-bold"
                  : "bg-secondary text-secondary-foreground hover:bg-muted"
              }`}
            >
              {c}
            </Link>
          ))}
        </div>
      </div>

      {/* SHIPMENTS LIST TABLE */}
      <div className="bg-primary-foreground rounded-xl p-5 border border-border/40 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-base flex items-center gap-2">
            <Truck className="w-4 h-4 text-muted-foreground" />
            Consignments & Dispatches ({shipments.length})
          </h2>
          <span className="text-xs text-muted-foreground">
            Source of truth: PostgreSQL (<code>larekmart_shipping_db</code>)
          </span>
        </div>

        {shipments.length === 0 ? (
          <div className="text-center py-12 text-sm text-muted-foreground flex flex-col items-center gap-2">
            <Box className="w-8 h-8 text-muted-foreground/60" />
            <p>No shipments matching current filters.</p>
            <p className="text-xs">
              Shipments are automatically generated when customer orders are
              placed or triggered via carrier adapters.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground text-xs">
                  <th className="text-left py-2.5 px-3">Shipment / Order</th>
                  <th className="text-left py-2.5 px-3">Carrier & Service</th>
                  <th className="text-left py-2.5 px-3">Tracking Number</th>
                  <th className="text-left py-2.5 px-3">
                    Destination Snapshot
                  </th>
                  <th className="text-left py-2.5 px-3">Payment & COD</th>
                  <th className="text-left py-2.5 px-3">Status</th>
                  <th className="text-right py-2.5 px-3">Shipping Fee</th>
                  <th className="text-center py-2.5 px-3">Label</th>
                  <th className="text-right py-2.5 px-3">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {shipments.map((s) => (
                  <tr key={s.id} className="hover:bg-muted/30 transition">
                    <td className="py-3 px-3">
                      <div className="font-mono text-xs text-foreground font-medium">
                        {s.id.slice(0, 8)}...
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Order: {s.orderId}
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2">
                        {getCarrierBadge(s.carrier)}
                        <span className="text-xs capitalize text-muted-foreground font-medium">
                          {s.serviceType}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-3 font-mono text-xs">
                      {s.trackingNumber ? (
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-primary bg-primary/5 px-2 py-0.5 rounded border border-primary/10">
                            {s.trackingNumber}
                          </span>
                          <a
                            href={`${clientBase}/track?number=${encodeURIComponent(s.trackingNumber)}`}
                            target="_blank"
                            rel="noreferrer"
                            title="Open customer live tracking"
                            className="text-muted-foreground hover:text-foreground"
                          >
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      ) : (
                        <span className="text-muted-foreground italic">
                          Pending assignment
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-1.5 text-xs text-foreground font-medium">
                        <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
                        {s.shippingAddress.city}, {s.shippingAddress.country}
                      </div>
                      <div className="text-xs text-muted-foreground line-clamp-1 max-w-[200px]">
                        {s.shippingAddress.fullName} • {s.shippingAddress.phone}
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      {s.isCod ? (
                        <div className="flex flex-col gap-0.5">
                          <span className="font-bold text-xs text-emerald-700 dark:text-emerald-400">
                            COD: PKR{" "}
                            {s.codAmount
                              ? Number(s.codAmount).toLocaleString()
                              : s.shippingRateAmount}
                          </span>
                          <span
                            className={`text-[10px] font-medium px-1.5 py-0.5 rounded w-fit ${
                              s.codStatus === "COLLECTED"
                                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                                : s.codStatus === "REFUSED"
                                  ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                                  : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                            }`}
                          >
                            {s.codStatus || "Pending Collection"}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground font-medium">
                          Prepaid Card
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3">{getStatusBadge(s.status)}</td>
                    <td className="py-3 px-3 text-right font-medium">
                      {s.currency} {s.shippingRateAmount.toLocaleString()}
                    </td>
                    <td className="py-3 px-3 text-center">
                      {s.labels && s.labels.length > 0 ? (
                        <a
                          href={s.labels[0]?.labelUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 font-medium"
                        >
                          PDF <ExternalLink className="w-3 h-3" />
                        </a>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-right text-xs text-muted-foreground">
                      {new Date(s.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* CARRIER METHODS */}
      <div className="bg-primary-foreground rounded-xl p-5 border border-border/40 shadow-sm">
        <h2 className="font-semibold text-base mb-3 flex items-center gap-2">
          <Truck className="w-4 h-4 text-muted-foreground" />
          Active Shipping Carriers & Methods ({methodsData.length})
        </h2>
        {methodsData.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">
            No shipping methods configured yet.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {methodsData.map((m) => (
              <div
                key={m.id}
                className="p-4 rounded-lg border border-border/60 bg-secondary/30 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    {getCarrierBadge(m.carrier)}
                    <span className="text-xs text-emerald-600 font-medium">
                      Active
                    </span>
                  </div>
                  <h3 className="font-semibold text-sm text-foreground">
                    {m.name}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                    {m.description}
                  </p>
                </div>
                <div className="mt-4 pt-2 border-t border-border/40 flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">
                    Est: {m.estimatedDaysMin}-{m.estimatedDaysMax} days
                  </span>
                  <span className="font-bold text-foreground">
                    Base: PKR {m.baseRate}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ARCHITECTURE & BOUNDARIES EXPLANATION */}
      <div className="bg-primary-foreground rounded-xl p-5 border border-border/40 text-sm text-muted-foreground">
        <p className="font-semibold text-foreground mb-1">
          Service Ownership & Lifecycle Architecture
        </p>
        <p>
          <strong>shipping-service</strong> exclusively owns the physical
          fulfillment lifecycle, carrier provider adapters (TCS, Leopards, DHL,
          FedEx, Custom Fleet), rate calculations, COD collection tracking,
          tracking history events, and carrier webhook ingestion.{" "}
          <strong>order-service</strong> owns the financial and business order
          record, while <strong>inventory-service</strong> manages warehouse
          reservations and stock ledger. All cross-service coordination occurs
          asynchronously over Kafka topics (<code>order.created</code>,{" "}
          <code>payment.successful</code>, <code>shipment.*</code>,{" "}
          <code>tracking.updated</code>). Shipping addresses are snapshotted
          immutably at creation time to prevent customer profile drift from
          invalidating historical logistics data.
        </p>
      </div>
    </div>
  );
};

export default ShippingPage;
