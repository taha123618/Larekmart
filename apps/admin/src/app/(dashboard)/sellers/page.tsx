"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/nextjs";
import {
  fetchAdminSellers,
  fetchAdminSellerDetails,
  updateAdminSellerStatus,
  fetchSystemSettings,
  type AdminSellerListItem,
} from "@/services/seller.service";
import type { SellerStatus } from "@repo/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Store,
  CheckCircle2,
  AlertTriangle,
  Ban,
  Search,
  RefreshCw,
  Eye,
  Loader2,
  TrendingUp,
  Clock,
  Users,
} from "lucide-react";
import { toast } from "react-toastify";

export default function SellersAdminPage() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  // Selected seller for details drawer
  const [selectedSellerId, setSelectedSellerId] = useState<string | null>(null);

  // Status Change Sheet state
  const [statusSeller, setStatusSeller] = useState<AdminSellerListItem | null>(
    null,
  );
  const [newStatus, setNewStatus] = useState<SellerStatus>("ACTIVE");
  const [statusReason, setStatusReason] = useState("");

  // 1. Query all sellers
  const {
    data: sellersData,
    isLoading: isLoadingSellers,
    refetch: refetchSellers,
  } = useQuery({
    queryKey: ["admin-sellers", statusFilter],
    queryFn: async () => {
      const token = await getToken();
      return fetchAdminSellers(
        statusFilter !== "ALL" ? { status: statusFilter } : undefined,
        token || undefined,
      );
    },
  });

  // 2. Query selected seller details
  const { data: selectedSellerDetails, isLoading: isLoadingDetails } = useQuery(
    {
      queryKey: ["admin-seller-details", selectedSellerId],
      queryFn: async () => {
        if (!selectedSellerId) return null;
        const token = await getToken();
        return fetchAdminSellerDetails(selectedSellerId, token || undefined);
      },
      enabled: !!selectedSellerId,
    },
  );

  // 3. Query system settings to detect if seller functionality is enabled
  const { data: systemSettings } = useQuery({
    queryKey: ["marketplace-system-settings"],
    queryFn: () => fetchSystemSettings().catch(() => null),
  });

  const isSellerEnabled = systemSettings?.isSellerEnabled ?? true;

  const statusMutation = useMutation({
    mutationFn: async ({
      id,
      status,
      reason,
    }: {
      id: string;
      status: SellerStatus;
      reason: string;
    }) => {
      const token = await getToken();
      return updateAdminSellerStatus(
        id,
        { status, reason },
        token || undefined,
      );
    },
    onSuccess: () => {
      toast.success("Seller account status updated successfully");
      setStatusSeller(null);
      setStatusReason("");
      queryClient.invalidateQueries({ queryKey: ["admin-sellers"] });
      if (selectedSellerId) {
        queryClient.invalidateQueries({
          queryKey: ["admin-seller-details", selectedSellerId],
        });
      }
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to update seller status");
    },
  });

  const allSellers = sellersData?.sellers || [];

  // Filter sellers by search query
  const filteredSellers = allSellers.filter((s) => {
    const q = searchQuery.toLowerCase();
    const storeName = s.store?.name?.toLowerCase() || "";
    const storeSlug = s.store?.slug?.toLowerCase() || "";
    const vendorId = s.vendorId?.toLowerCase() || "";
    return (
      storeName.includes(q) || storeSlug.includes(q) || vendorId.includes(q)
    );
  });

  // Counts
  const totalSellers = allSellers.length;
  const activeCount = allSellers.filter((s) => s.status === "ACTIVE").length;
  const onboardingCount = allSellers.filter(
    (s) => s.status === "ONBOARDING",
  ).length;
  const suspendedCount = allSellers.filter(
    (s) => s.status === "SUSPENDED",
  ).length;

  const getSellerStatusBadge = (status: SellerStatus | string) => {
    switch (status) {
      case "ACTIVE":
        return <Badge className="bg-emerald-600 text-white">ACTIVE</Badge>;
      case "ONBOARDING":
        return <Badge className="bg-amber-500 text-white">ONBOARDING</Badge>;
      case "SUSPENDED":
        return <Badge className="bg-rose-600 text-white">SUSPENDED</Badge>;
      case "INACTIVE":
        return <Badge variant="secondary">INACTIVE</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getStoreStatusBadge = (status?: string | null) => {
    switch (status) {
      case "ACTIVE":
        return (
          <Badge
            variant="outline"
            className="border-emerald-600 text-emerald-600"
          >
            STORE OPEN
          </Badge>
        );
      case "VACATION":
        return (
          <Badge variant="outline" className="border-amber-500 text-amber-500">
            VACATION
          </Badge>
        );
      case "MAINTENANCE":
        return (
          <Badge variant="outline" className="border-blue-500 text-blue-500">
            MAINTENANCE
          </Badge>
        );
      case "CLOSED":
        return <Badge variant="destructive">CLOSED</Badge>;
      default:
        return <Badge variant="outline">PENDING SETUP</Badge>;
    }
  };

  return (
    <div className="space-y-6 pb-12 pt-4">
      {/* Top Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
            <Store className="h-7 w-7 text-indigo-600 dark:text-indigo-400" />
            Seller & Storefront Management
          </h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            Marketplace seller storefronts, staff permissions, operational
            policies, and performance ratings.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetchSellers()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      {!isSellerEnabled && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-amber-900 dark:text-amber-200">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
            <div>
              <h3 className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                Marketplace & Seller Operations are Currently Disabled
              </h3>
              <p className="mt-1 text-xs text-amber-700/90 dark:text-amber-400/90">
                A Super Admin has toggled{" "}
                <code className="font-mono bg-amber-500/20 px-1 py-0.5 rounded">
                  isSellerEnabled = false
                </code>
                . Public storefronts and seller onboarding routes are blocked
                across the platform. All existing seller accounts and store
                configurations remain securely preserved in read-only audit
                mode. To resume operations, a Super Admin can toggle the feature
                on in{" "}
                <a
                  href="/settings"
                  className="underline font-semibold hover:text-amber-900 dark:hover:text-amber-100"
                >
                  Platform Settings
                </a>
                .
              </p>
            </div>
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-neutral-200 dark:border-neutral-800">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-neutral-600 dark:text-neutral-400">
              Total Sellers
            </CardTitle>
            <Store className="h-4 w-4 text-indigo-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
              {totalSellers}
            </div>
            <p className="text-xs text-neutral-500 mt-1">
              Merchant storefront accounts
            </p>
          </CardContent>
        </Card>

        <Card className="border-neutral-200 dark:border-neutral-800">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-neutral-600 dark:text-neutral-400">
              Active Storefronts
            </CardTitle>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {activeCount}
            </div>
            <p className="text-xs text-neutral-500 mt-1">
              Accepting customer orders
            </p>
          </CardContent>
        </Card>

        <Card className="border-neutral-200 dark:border-neutral-800">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-neutral-600 dark:text-neutral-400">
              Onboarding / Incomplete
            </CardTitle>
            <Clock className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
              {onboardingCount}
            </div>
            <p className="text-xs text-neutral-500 mt-1">
              Setting up store & policies
            </p>
          </CardContent>
        </Card>

        <Card className="border-neutral-200 dark:border-neutral-800">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-neutral-600 dark:text-neutral-400">
              Suspended Accounts
            </CardTitle>
            <AlertTriangle className="h-4 w-4 text-rose-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-rose-600 dark:text-rose-400">
              {suspendedCount}
            </div>
            <p className="text-xs text-neutral-500 mt-1">
              Policy violations or reviews
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Sellers Table */}
      <Card className="border-neutral-200 dark:border-neutral-800">
        <CardHeader className="p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-neutral-500" />
              <Input
                placeholder="Search by store name, slug, vendor ID..."
                className="pl-8"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-neutral-500">Filter status:</span>
              {["ALL", "ACTIVE", "ONBOARDING", "SUSPENDED", "INACTIVE"].map(
                (st) => (
                  <Button
                    key={st}
                    variant={statusFilter === st ? "default" : "outline"}
                    size="sm"
                    onClick={() => setStatusFilter(st)}
                  >
                    {st === "ALL" ? "All" : st}
                  </Button>
                ),
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoadingSellers ? (
            <div className="flex h-48 items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-neutral-400" />
            </div>
          ) : filteredSellers.length === 0 ? (
            <div className="p-12 text-center text-neutral-500 dark:text-neutral-400">
              No seller accounts found matching your search criteria.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Store Name / Slug</TableHead>
                  <TableHead>Parent Vendor ID</TableHead>
                  <TableHead>Currency</TableHead>
                  <TableHead>Storefront Status</TableHead>
                  <TableHead>Seller Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSellers.map((seller) => (
                  <TableRow key={seller.id}>
                    <TableCell>
                      <div className="font-semibold text-neutral-900 dark:text-neutral-100 flex items-center gap-1.5">
                        <Store className="h-4 w-4 text-neutral-500" />
                        {seller.store?.name || "Unnamed Store"}
                      </div>
                      {seller.store?.slug && (
                        <div className="text-xs font-mono text-neutral-500">
                          /stores/{seller.store.slug}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-xs">
                        {seller.vendorId.slice(0, 8)}...
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="font-semibold text-xs">
                        {seller.primaryCurrency}
                      </span>
                    </TableCell>
                    <TableCell>
                      {getStoreStatusBadge(seller.store?.status)}
                    </TableCell>
                    <TableCell>{getSellerStatusBadge(seller.status)}</TableCell>
                    <TableCell className="text-xs text-neutral-500">
                      {new Date(seller.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedSellerId(seller.id)}
                        title="View Storefront Details & Performance"
                      >
                        <Eye className="h-4 w-4 text-neutral-600 dark:text-neutral-300" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setStatusSeller(seller);
                          setNewStatus(
                            seller.status === "SUSPENDED"
                              ? "ACTIVE"
                              : "SUSPENDED",
                          );
                          setStatusReason("");
                        }}
                        title="Update Seller Status"
                      >
                        {seller.status === "SUSPENDED" ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        ) : (
                          <Ban className="h-4 w-4 text-rose-500" />
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* SELLER DETAILS & PERFORMANCE SHEET */}
      <Sheet
        open={!!selectedSellerId}
        onOpenChange={(open) => !open && setSelectedSellerId(null)}
      >
        <SheetContent className="sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Store className="h-5 w-5 text-indigo-600" />
              Seller Profile & Storefront
            </SheetTitle>
            <SheetDescription>
              Storefront configuration, policies, staff, and live performance
              metrics.
            </SheetDescription>
          </SheetHeader>

          {isLoadingDetails ? (
            <div className="flex h-64 items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-neutral-400" />
            </div>
          ) : selectedSellerDetails ? (
            <div className="space-y-6 pt-6">
              {/* Header Card */}
              <div className="flex items-center justify-between p-3 rounded-lg bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
                <div>
                  <div className="text-xs text-neutral-500">Account Status</div>
                  <div className="mt-1">
                    {getSellerStatusBadge(selectedSellerDetails.status)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-neutral-500">Store Status</div>
                  <div className="mt-1">
                    {getStoreStatusBadge(selectedSellerDetails.store?.status)}
                  </div>
                </div>
              </div>

              {/* Store Details */}
              <div className="space-y-2">
                <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-1.5">
                  <Store className="h-4 w-4 text-neutral-500" />
                  Storefront Branding & Identity
                </h3>
                <div className="space-y-2 text-xs p-3 rounded bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-neutral-400">Store Name:</span>
                      <p className="font-semibold text-sm">
                        {selectedSellerDetails.store?.name || "N/A"}
                      </p>
                    </div>
                    <div>
                      <span className="text-neutral-400">Public Slug:</span>
                      <p className="font-mono font-semibold">
                        {selectedSellerDetails.store?.slug || "N/A"}
                      </p>
                    </div>
                    <div>
                      <span className="text-neutral-400">Currency:</span>
                      <p className="font-semibold">
                        {selectedSellerDetails.primaryCurrency}
                      </p>
                    </div>
                    <div>
                      <span className="text-neutral-400">Clerk Owner ID:</span>
                      <p className="font-mono truncate">
                        {selectedSellerDetails.ownerUserId}
                      </p>
                    </div>
                  </div>
                  <div>
                    <span className="text-neutral-400">Description:</span>
                    <p className="font-normal mt-0.5 text-neutral-600 dark:text-neutral-300">
                      {selectedSellerDetails.store?.description ||
                        "No description provided."}
                    </p>
                  </div>
                </div>
              </div>

              {/* Performance Metrics Snapshot */}
              <div className="space-y-2">
                <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <TrendingUp className="h-4 w-4 text-emerald-500" />
                    Latest Performance Snapshot
                  </span>
                </h3>
                {selectedSellerDetails.latestPerformance ? (
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="p-2.5 rounded bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-center">
                      <div className="text-neutral-400">Seller Score</div>
                      <div className="text-lg font-bold text-emerald-600">
                        {selectedSellerDetails.latestPerformance.sellerScore.toFixed(
                          1,
                        )}
                        /100
                      </div>
                    </div>
                    <div className="p-2.5 rounded bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-center">
                      <div className="text-neutral-400">Fulfillment</div>
                      <div className="text-lg font-bold text-indigo-600">
                        {(
                          selectedSellerDetails.latestPerformance
                            .fulfillmentRate * 100
                        ).toFixed(0)}
                        %
                      </div>
                    </div>
                    <div className="p-2.5 rounded bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-center">
                      <div className="text-neutral-400">On-Time Rate</div>
                      <div className="text-lg font-bold text-blue-600">
                        {(
                          selectedSellerDetails.latestPerformance
                            .onTimeDeliveryRate * 100
                        ).toFixed(0)}
                        %
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 rounded border border-neutral-200 dark:border-neutral-800 text-center text-xs text-neutral-500">
                    No performance snapshot recorded yet.
                  </div>
                )}
              </div>

              {/* Store Policies */}
              <div className="space-y-2">
                <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
                  Store Policies ({selectedSellerDetails.policies?.length || 0})
                </h3>
                {selectedSellerDetails.policies &&
                selectedSellerDetails.policies.length > 0 ? (
                  <div className="space-y-2">
                    {selectedSellerDetails.policies.map((p) => (
                      <div
                        key={p.id}
                        className="p-2.5 rounded border border-neutral-200 dark:border-neutral-800 text-xs space-y-1"
                      >
                        <div className="flex items-center justify-between font-semibold">
                          <span>{p.policyType} Policy</span>
                          <span className="text-neutral-400 text-[10px]">
                            v{p.version}
                          </span>
                        </div>
                        <p className="text-neutral-600 dark:text-neutral-300 line-clamp-2">
                          {p.content}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-neutral-400 italic">
                    No custom policies configured.
                  </p>
                )}
              </div>

              {/* Staff Members */}
              <div className="space-y-2">
                <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-1.5">
                  <Users className="h-4 w-4 text-neutral-500" />
                  Staff Members ({selectedSellerDetails.staff?.length || 0})
                </h3>
                {selectedSellerDetails.staff &&
                selectedSellerDetails.staff.length > 0 ? (
                  <div className="space-y-1.5">
                    {selectedSellerDetails.staff.map((member) => (
                      <div
                        key={member.id}
                        className="flex items-center justify-between p-2 rounded bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-xs"
                      >
                        <div>
                          <span className="font-mono text-xs">
                            {member.userId}
                          </span>
                          <div className="text-[10px] text-neutral-400">
                            Role: {member.role}
                          </div>
                        </div>
                        <Badge variant="outline">{member.status}</Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-neutral-400 italic">
                    No additional staff members.
                  </p>
                )}
              </div>

              {/* Actions */}
              <div className="pt-4 border-t border-neutral-200 dark:border-neutral-800">
                <Button
                  variant={
                    selectedSellerDetails.status === "SUSPENDED"
                      ? "default"
                      : "destructive"
                  }
                  className="w-full"
                  onClick={() => {
                    setStatusSeller(selectedSellerDetails);
                    setNewStatus(
                      selectedSellerDetails.status === "SUSPENDED"
                        ? "ACTIVE"
                        : "SUSPENDED",
                    );
                    setStatusReason("");
                  }}
                >
                  {selectedSellerDetails.status === "SUSPENDED" ? (
                    <>
                      <CheckCircle2 className="mr-1.5 h-4 w-4" />
                      Reactivate Seller Account
                    </>
                  ) : (
                    <>
                      <Ban className="mr-1.5 h-4 w-4" />
                      Suspend Seller Account
                    </>
                  )}
                </Button>
              </div>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>

      {/* STATUS CHANGE DIALOG / SHEET */}
      <Sheet
        open={!!statusSeller}
        onOpenChange={(open) => !open && setStatusSeller(null)}
      >
        <SheetContent className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Update Seller Status</SheetTitle>
            <SheetDescription>
              Change status for storefront{" "}
              <span className="font-semibold">
                {statusSeller?.store?.name || statusSeller?.id}
              </span>
              .
            </SheetDescription>
          </SheetHeader>
          <div className="space-y-4 pt-4">
            <div>
              <label className="text-xs font-medium text-neutral-600 dark:text-neutral-400">
                Target Status
              </label>
              <div className="grid grid-cols-3 gap-2 mt-1">
                {(["ACTIVE", "SUSPENDED", "INACTIVE"] as SellerStatus[]).map(
                  (st) => (
                    <Button
                      key={st}
                      type="button"
                      variant={newStatus === st ? "default" : "outline"}
                      size="sm"
                      onClick={() => setNewStatus(st)}
                    >
                      {st}
                    </Button>
                  ),
                )}
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-neutral-600 dark:text-neutral-400">
                Audit Reason (Required)
              </label>
              <Input
                placeholder="e.g. Excessive cancellation rate, KYC review complete"
                value={statusReason}
                onChange={(e) => setStatusReason(e.target.value)}
                className="mt-1"
              />
            </div>

            <Button
              className="w-full mt-4"
              disabled={!statusReason.trim() || statusMutation.isPending}
              onClick={() => {
                if (!statusSeller) return;
                statusMutation.mutate({
                  id: statusSeller.id,
                  status: newStatus,
                  reason: statusReason,
                });
              }}
            >
              {statusMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Confirm Status Change
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
