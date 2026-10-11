"use client";

import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { useAuth } from "@clerk/nextjs";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ShoppingCart,
  CheckCircle2,
  Clock,
  Tag,
  Layers,
  Database,
  RefreshCw,
  Loader2,
  AlertCircle,
} from "lucide-react";
import type { CartResponseType } from "@repo/types";

interface CartAdminStats {
  activeCarts: number;
  convertedCarts: number;
  expiredCarts: number;
  abandonedCarts: number;
  totalPipelineValue: number;
  averageItemsPerCart: number;
}

const getCartServiceUrl = () =>
  process.env.NEXT_PUBLIC_CART_SERVICE_URL ||
  process.env.NEXT_PUBLIC_API_GATEWAY_URL ||
  "http://localhost:8090";

const CartsAdminPage = () => {
  const { getToken } = useAuth();
  const serviceUrl = getCartServiceUrl();

  // 1. React Query hook for Cart Aggregate Stats via Axios
  const {
    data: statsData,
    isLoading: isStatsLoading,
    isRefetching: isStatsRefetching,
    refetch: refetchStats,
    error: statsError,
  } = useQuery<CartAdminStats>({
    queryKey: ["cart-admin-stats"],
    queryFn: async () => {
      const token = await getToken();
      const response = await axios.get<CartAdminStats>(
        `${serviceUrl}/api/v1/cart/admin/stats`,
        {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          timeout: 10000,
        },
      );
      return response.data;
    },
    refetchInterval: 15000, // Background poll every 15s for live dashboard
  });

  // 2. React Query hook for Recent Active/Converted Carts via Axios
  const {
    data: recentCartsData,
    isLoading: isRecentLoading,
    isRefetching: isRecentRefetching,
    refetch: refetchRecent,
    error: recentError,
  } = useQuery<CartResponseType[]>({
    queryKey: ["cart-admin-recent"],
    queryFn: async () => {
      const token = await getToken();
      const response = await axios.get<CartResponseType[]>(
        `${serviceUrl}/api/v1/cart/admin/recent?limit=25`,
        {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          timeout: 10000,
        },
      );
      return response.data;
    },
    refetchInterval: 15000,
  });

  const stats: CartAdminStats = statsData || {
    activeCarts: 0,
    convertedCarts: 0,
    expiredCarts: 0,
    abandonedCarts: 0,
    totalPipelineValue: 0,
    averageItemsPerCart: 0,
  };

  const recentCarts: CartResponseType[] = recentCartsData || [];
  const isRefreshing = isStatsRefetching || isRecentRefetching;

  const handleRefresh = () => {
    refetchStats();
    refetchRecent();
  };

  const totalCartsTracked =
    stats.activeCarts +
    stats.convertedCarts +
    stats.expiredCarts +
    stats.abandonedCarts;

  const conversionRate =
    totalCartsTracked > 0
      ? ((stats.convertedCarts / totalCartsTracked) * 100).toFixed(1)
      : "0.0";

  return (
    <div className="flex flex-col gap-6 p-2">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-secondary/50 p-6 rounded-xl border border-border/50">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <ShoppingCart className="w-6 h-6 text-primary" />
            Shopping Carts & Funnel Analytics
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Authoritative MongoDB persistence, Redis TTL cache invalidation, and
            Kafka lifecycle events queried via React Query &amp; Axios from{" "}
            <code>cart-service</code> (:8009).
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-lg border border-border bg-background hover:bg-muted transition text-foreground disabled:opacity-60 cursor-pointer"
            title="Refresh cart data"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin text-primary" : ""}`}
            />
            <span>{isRefreshing ? "Refreshing..." : "Refresh"}</span>
          </button>
          <Badge
            variant="outline"
            className="text-xs bg-background py-1.5 px-3"
          >
            Service Port: 8009
          </Badge>
          <Badge
            variant="default"
            className="text-xs py-1.5 px-3 bg-emerald-600 hover:bg-emerald-700"
          >
            TanStack Query + Axios
          </Badge>
        </div>
      </div>

      {/* ERROR NOTICE IF BACKEND IS UNREACHABLE */}
      {(statsError || recentError) && (
        <div className="flex items-center gap-3 p-4 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-sm">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <div className="flex-1">
            <p className="font-medium">Cart Service Offline or Reconnecting</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Unable to reach <code>{serviceUrl}</code>. Ensure the service is
              running on port 8009.
            </p>
          </div>
          <button
            onClick={handleRefresh}
            className="text-xs underline font-semibold cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* METRIC CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active In-Progress Carts
            </CardTitle>
            <ShoppingCart className="w-4 h-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            {isStatsLoading ? (
              <div className="h-8 flex items-center">
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                <div className="text-2xl font-bold text-foreground">
                  {stats.activeCarts.toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  ${stats.totalPipelineValue.toFixed(2)} active pipeline value
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Converted Carts
            </CardTitle>
            <CheckCircle2 className="w-4 h-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            {isStatsLoading ? (
              <div className="h-8 flex items-center">
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                <div className="text-2xl font-bold text-foreground">
                  {stats.convertedCarts.toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {conversionRate}% overall checkout conversion
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Expired / Abandoned
            </CardTitle>
            <Clock className="w-4 h-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            {isStatsLoading ? (
              <div className="h-8 flex items-center">
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                <div className="text-2xl font-bold text-foreground">
                  {(stats.expiredCarts + stats.abandonedCarts).toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Reaped by Redis sorted set &amp; worker
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Average Cart Depth
            </CardTitle>
            <Layers className="w-4 h-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            {isStatsLoading ? (
              <div className="h-8 flex items-center">
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                <div className="text-2xl font-bold text-foreground">
                  {stats.averageItemsPerCart}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Items per active shopping cart
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* RECENT CARTS TABLE */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Recent Shopping Carts</CardTitle>
              <CardDescription>
                Live snapshot of active and historic customer carts in MongoDB
                fetched via Axios
              </CardDescription>
            </div>
            <Badge variant="secondary">
              Showing {recentCarts.length} recent
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cart ID</TableHead>
                  <TableHead>Owner Identity</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead>Grand Total</TableHead>
                  <TableHead>Coupons Applied</TableHead>
                  <TableHead>Expires At</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isRecentLoading ? (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="text-center py-8 text-muted-foreground"
                    >
                      <div className="flex items-center justify-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Loading shopping carts...</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : recentCarts.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="text-center py-8 text-muted-foreground"
                    >
                      No active or historic carts found. Carts will appear as
                      shoppers browse and add items.
                    </TableCell>
                  </TableRow>
                ) : (
                  recentCarts.map((c) => {
                    const statusVariant =
                      c.status === "active"
                        ? "default"
                        : c.status === "converted"
                          ? "outline"
                          : "secondary";

                    const isUser = !!c.userId;
                    const identityDisplay = isUser
                      ? `User: ${c.userId?.substring(0, 14)}...`
                      : `Guest: ${c.guestToken?.substring(0, 14)}...`;

                    return (
                      <TableRow key={c.id}>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {c.id.substring(0, 10)}...
                        </TableCell>
                        <TableCell>
                          <span className="text-xs font-medium text-foreground">
                            {identityDisplay}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={statusVariant}
                            className={`text-[11px] capitalize ${
                              c.status === "active"
                                ? "bg-emerald-600 hover:bg-emerald-700"
                                : c.status === "converted"
                                  ? "border-blue-500 text-blue-600"
                                  : ""
                            }`}
                          >
                            {c.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs">
                          {c.items?.reduce((acc, i) => acc + i.quantity, 0) ||
                            0}{" "}
                          items
                        </TableCell>
                        <TableCell className="text-xs font-semibold text-foreground">
                          ${c.pricing?.grandTotal?.toFixed(2) || "0.00"}{" "}
                          {c.currency}
                        </TableCell>
                        <TableCell>
                          {c.coupons && c.coupons.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {c.coupons.map((coup) => (
                                <Badge
                                  key={coup.code}
                                  variant="outline"
                                  className="text-[10px] text-emerald-700 bg-emerald-50 border-emerald-200"
                                >
                                  {coup.code}
                                </Badge>
                              ))}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              —
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {c.expiresAt
                            ? new Date(c.expiresAt).toLocaleDateString()
                            : "—"}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* PROMOTIONAL COUPONS & ARCHITECTURE */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Tag className="w-4 h-4 text-emerald-500" />
              Active Promotional Coupons
            </CardTitle>
            <CardDescription>
              Configured discount promotions applied and calculated by{" "}
              <code>pricingService</code>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <span className="font-mono font-bold text-emerald-700">
                    SAVE10
                  </span>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    10% percentage discount on entire cart subtotal
                  </p>
                </div>
                <Badge variant="outline" className="text-xs">
                  Min. Order: $1,000
                </Badge>
              </div>

              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <span className="font-mono font-bold text-emerald-700">
                    WELCOME20
                  </span>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    20% discount on entire cart subtotal for new users
                  </p>
                </div>
                <Badge variant="outline" className="text-xs">
                  Min. Order: $2,500
                </Badge>
              </div>

              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <span className="font-mono font-bold text-emerald-700">
                    FREESHIP
                  </span>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    100% shipping fee waiver promotion
                  </p>
                </div>
                <Badge variant="outline" className="text-xs">
                  Fixed $250 off
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Database className="w-4 h-4 text-primary" />
              Event-Driven Pipeline &amp; Resilience
            </CardTitle>
            <CardDescription>
              Kafka event distribution and cross-service reactivity
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2.5 text-xs text-muted-foreground">
              <div className="flex items-start gap-2">
                <span className="font-semibold text-foreground shrink-0">
                  • Event Publisher:
                </span>
                <span>
                  Emits <code>cart.created</code>, <code>cart.updated</code>,{" "}
                  <code>cart.merged</code>, <code>cart.expired</code>,{" "}
                  <code>cart.cleared</code>.
                </span>
              </div>
              <div className="flex items-start gap-2">
                <span className="font-semibold text-foreground shrink-0">
                  • Event Consumer:
                </span>
                <span>
                  Subscribes to <code>product.updated</code>,{" "}
                  <code>product.deleted</code>, <code>inventory.adjusted</code>,
                  and <code>order.created</code>.
                </span>
              </div>
              <div className="flex items-start gap-2">
                <span className="font-semibold text-foreground shrink-0">
                  • Redis TTL Reaping:
                </span>
                <span>
                  Sorted set tracks expiration timestamps; recurring worker
                  reaps overdue carts automatically.
                </span>
              </div>
              <div className="flex items-start gap-2">
                <span className="font-semibold text-foreground shrink-0">
                  • Guest Merge:
                </span>
                <span>
                  Seamlessly merges anonymous guest items with authenticated
                  Clerk user accounts on login.
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default CartsAdminPage;
