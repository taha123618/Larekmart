"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/nextjs";
import {
  fetchAdminPromotionOverview,
  fetchAdminPromotions,
  createAdminPromotion,
  deactivateAdminPromotion,
  createAdminCoupon,
  type AdminPromotionsResponse,
} from "@/services/promotion.service";
import type {
  Promotion,
  PromotionOverviewResponse,
  CreatePromotionInput,
  PromotionType,
} from "@repo/types";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
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
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Tag,
  Ticket,
  DollarSign,
  TrendingUp,
  Search,
  RefreshCw,
  Plus,
  Loader2,
  Calendar,
  AlertCircle,
  Percent,
  CheckCircle2,
  XCircle,
  Clock,
  Sparkles,
} from "lucide-react";

export default function PromotionsAdminDashboardPage() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [typeFilter, setTypeFilter] = useState<string>("ALL");
  const [page, setPage] = useState(1);
  const limit = 15;

  // New Promotion Form State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [promoName, setPromoName] = useState("");
  const [promoDesc, setPromoDesc] = useState("");
  const [promoType, setPromoType] = useState<PromotionType>("PERCENTAGE");
  const [discountValue, setDiscountValue] = useState(10);
  const [minSpend, setMinSpend] = useState(0);
  const [budgetLimit, setBudgetLimit] = useState(1000);
  const [isStackable, setIsStackable] = useState(false);
  const [startDate, setStartDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [endDate, setEndDate] = useState(
    new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
  );

  // New Coupon Form State
  const [selectedPromoForCoupon, setSelectedPromoForCoupon] =
    useState<Promotion | null>(null);
  const [couponCode, setCouponCode] = useState("");
  const [maxCouponRedemptions, setMaxCouponRedemptions] = useState<
    number | undefined
  >();

  // 1. Fetch Overview Stats
  const {
    data: overview,
    isLoading: isOverviewLoading,
    refetch: refetchOverview,
    isRefetching: isOverviewRefetching,
  } = useQuery<PromotionOverviewResponse>({
    queryKey: ["admin-promotions-overview"],
    queryFn: async () => {
      const token = await getToken();
      if (!token) throw new Error("Unauthorized");
      return fetchAdminPromotionOverview(token);
    },
    staleTime: 30000,
  });

  // 2. Fetch Promotions Directory
  const {
    data: promotionsData,
    isLoading: isPromotionsLoading,
    refetch: refetchPromotions,
    isRefetching: isPromotionsRefetching,
  } = useQuery<AdminPromotionsResponse>({
    queryKey: [
      "admin-promotions-list",
      page,
      limit,
      statusFilter,
      typeFilter,
      debouncedSearch,
    ],
    queryFn: async () => {
      const token = await getToken();
      if (!token) throw new Error("Unauthorized");
      return fetchAdminPromotions(token, {
        page,
        limit,
        status: statusFilter === "ALL" ? undefined : statusFilter,
        type: typeFilter === "ALL" ? undefined : typeFilter,
        search: debouncedSearch || undefined,
      });
    },
  });

  // Mutations
  const createPromoMutation = useMutation({
    mutationFn: async (input: CreatePromotionInput) => {
      const token = await getToken();
      if (!token) throw new Error("Unauthorized");
      return createAdminPromotion(token, input);
    },
    onSuccess: () => {
      setIsCreateOpen(false);
      resetPromoForm();
      queryClient.invalidateQueries({ queryKey: ["admin-promotions-list"] });
      queryClient.invalidateQueries({
        queryKey: ["admin-promotions-overview"],
      });
    },
  });

  const deactivatePromoMutation = useMutation({
    mutationFn: async (id: string) => {
      const token = await getToken();
      if (!token) throw new Error("Unauthorized");
      return deactivateAdminPromotion(token, id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-promotions-list"] });
      queryClient.invalidateQueries({
        queryKey: ["admin-promotions-overview"],
      });
    },
  });

  const createCouponMutation = useMutation({
    mutationFn: async ({
      promoId,
      code,
      maxRedemptions,
    }: {
      promoId: string;
      code: string;
      maxRedemptions?: number;
    }) => {
      const token = await getToken();
      if (!token) throw new Error("Unauthorized");
      return createAdminCoupon(token, promoId, {
        code,
        maxRedemptions,
      });
    },
    onSuccess: () => {
      setSelectedPromoForCoupon(null);
      setCouponCode("");
      queryClient.invalidateQueries({ queryKey: ["admin-promotions-list"] });
      queryClient.invalidateQueries({
        queryKey: ["admin-promotions-overview"],
      });
    },
  });

  const resetPromoForm = () => {
    setPromoName("");
    setPromoDesc("");
    setPromoType("PERCENTAGE");
    setDiscountValue(10);
    setMinSpend(0);
    setBudgetLimit(1000);
    setIsStackable(false);
  };

  const handleCreatePromo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!promoName.trim()) return;

    createPromoMutation.mutate({
      name: promoName.trim(),
      description: promoDesc.trim() || undefined,
      type: promoType,
      discountValue: Number(discountValue),
      startDate: new Date(startDate).toISOString(),
      endDate: new Date(endDate).toISOString(),
      priority: 0,
      isStackable,
      rules: {
        minOrderAmount: Number(minSpend) || 0,
        customerSegment: "ALL",
        maxPerCustomer: 1,
      },
      budget: budgetLimit
        ? {
            totalBudget: Number(budgetLimit),
            currency: "USD",
          }
        : undefined,
    });
  };

  const handleCreateCoupon = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPromoForCoupon || !couponCode.trim()) return;

    createCouponMutation.mutate({
      promoId: selectedPromoForCoupon.id,
      code: couponCode.trim().toUpperCase(),
      maxRedemptions: maxCouponRedemptions
        ? Number(maxCouponRedemptions)
        : undefined,
    });
  };

  const isRefreshing = isOverviewRefetching || isPromotionsRefetching;

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Tag className="h-6 w-6 text-primary" />
            <span>Campaigns & Promotions Engine</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Authoritative management for marketing campaigns, coupons, discount
            eligibility, budgets & checkout reservations.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              refetchOverview();
              refetchPromotions();
            }}
            disabled={isRefreshing}
            className="gap-2"
          >
            <RefreshCw
              className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>

          <Sheet open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <SheetTrigger asChild>
              <Button size="sm" className="gap-2">
                <Plus className="h-4 w-4" />
                New Promotion
              </Button>
            </SheetTrigger>
            <SheetContent className="sm:max-w-lg overflow-y-auto">
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  Create Promotion Campaign
                </SheetTitle>
                <SheetDescription>
                  Configure discount rules, scheduling, eligibility, and
                  promotional budget caps.
                </SheetDescription>
              </SheetHeader>

              <form onSubmit={handleCreatePromo} className="space-y-4 py-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground uppercase">
                    Campaign Name *
                  </label>
                  <Input
                    placeholder="e.g. Summer Super Sale 2026"
                    value={promoName}
                    onChange={(e) => setPromoName(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground uppercase">
                    Description
                  </label>
                  <Input
                    placeholder="Brief description for internal governance"
                    value={promoDesc}
                    onChange={(e) => setPromoDesc(e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-muted-foreground uppercase">
                      Discount Type
                    </label>
                    <select
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={promoType}
                      onChange={(e) =>
                        setPromoType(e.target.value as PromotionType)
                      }
                    >
                      <option value="PERCENTAGE">Percentage (%)</option>
                      <option value="FIXED_AMOUNT">Fixed Amount ($)</option>
                      <option value="FREE_SHIPPING">Free Shipping</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-muted-foreground uppercase">
                      Discount Value
                    </label>
                    <Input
                      type="number"
                      min="0"
                      step="any"
                      value={discountValue}
                      onChange={(e) => setDiscountValue(Number(e.target.value))}
                      disabled={promoType === "FREE_SHIPPING"}
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-muted-foreground uppercase">
                      Min Order Spend ($)
                    </label>
                    <Input
                      type="number"
                      min="0"
                      step="any"
                      value={minSpend}
                      onChange={(e) => setMinSpend(Number(e.target.value))}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-muted-foreground uppercase">
                      Budget Cap ($)
                    </label>
                    <Input
                      type="number"
                      min="1"
                      step="any"
                      value={budgetLimit}
                      onChange={(e) => setBudgetLimit(Number(e.target.value))}
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-muted-foreground uppercase">
                      Start Date
                    </label>
                    <Input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-muted-foreground uppercase">
                      End Date
                    </label>
                    <Input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <input
                    type="checkbox"
                    id="stackable"
                    checked={isStackable}
                    onChange={(e) => setIsStackable(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-primary"
                  />
                  <label htmlFor="stackable" className="text-sm font-medium">
                    Allow stacking with other coupons
                  </label>
                </div>

                <div className="pt-4 flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsCreateOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={createPromoMutation.isPending}
                    className="gap-2"
                  >
                    {createPromoMutation.isPending && (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    )}
                    Create Campaign
                  </Button>
                </div>
              </form>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {/* Overview KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">
              Active Promotions
            </CardTitle>
            <Tag className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isOverviewLoading ? (
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              ) : (
                (overview?.activePromotions.toLocaleString() ?? 0)
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Out of {overview?.totalPromotions ?? 0} total campaigns
            </p>
          </CardContent>
        </Card>

        <Card className="border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">
              Coupons Issued
            </CardTitle>
            <Ticket className="h-4 w-4 text-sky-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isOverviewLoading ? (
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              ) : (
                (overview?.totalCoupons.toLocaleString() ?? 0)
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Unique discount codes active
            </p>
          </CardContent>
        </Card>

        <Card className="border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">
              Discounts Awarded
            </CardTitle>
            <DollarSign className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isOverviewLoading ? (
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              ) : (
                `$${(overview?.totalDiscountGiven ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Lifetime savings delivered
            </p>
          </CardContent>
        </Card>

        <Card className="border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">
              Total Redemptions
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-violet-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isOverviewLoading ? (
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              ) : (
                (overview?.totalRedemptions.toLocaleString() ?? 0)
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {overview?.activeReservationsCount ?? 0} checkout holds in-flight
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Promotions Table Card */}
      <Card className="border shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-lg font-semibold">
                Promotions & Campaigns
              </CardTitle>
              <CardDescription>
                Browse, monitor budgets, generate coupon codes, and pause or
                deactivate promotional campaigns.
              </CardDescription>
            </div>

            {/* Filter and Search Bar */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative min-w-[200px]">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search campaigns..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setDebouncedSearch(e.target.value);
                    setPage(1);
                  }}
                  className="pl-8 h-9 text-sm"
                />
              </div>

              <select
                className="h-9 rounded-md border border-input bg-background px-3 text-xs"
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
              >
                <option value="ALL">All Statuses</option>
                <option value="ACTIVE">Active</option>
                <option value="DRAFT">Draft</option>
                <option value="PAUSED">Paused</option>
                <option value="EXPIRED">Expired</option>
                <option value="DEACTIVATED">Deactivated</option>
              </select>

              <select
                className="h-9 rounded-md border border-input bg-background px-3 text-xs"
                value={typeFilter}
                onChange={(e) => {
                  setTypeFilter(e.target.value);
                  setPage(1);
                }}
              >
                <option value="ALL">All Types</option>
                <option value="PERCENTAGE">Percentage</option>
                <option value="FIXED_AMOUNT">Fixed Amount</option>
                <option value="FREE_SHIPPING">Free Shipping</option>
              </select>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="border-t">
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow>
                  <TableHead className="w-[240px]">Campaign</TableHead>
                  <TableHead>Type & Discount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Budget Usage</TableHead>
                  <TableHead>Redemptions</TableHead>
                  <TableHead>Validity</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {isPromotionsLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-40 text-center">
                      <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                        <span>Loading promotion campaigns...</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : !promotionsData?.items ||
                  promotionsData.items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-40 text-center">
                      <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
                        <AlertCircle className="h-6 w-6" />
                        <span>
                          No promotion campaigns found matching criteria.
                        </span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  promotionsData.items.map((row) => {
                    const budget = row.budget;
                    const spent = budget?.spentAmount ?? 0;
                    const total = budget?.totalBudget ?? 1;
                    const pct = Math.min(
                      100,
                      Math.round((spent / total) * 100),
                    );

                    return (
                      <TableRow key={row.id}>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-semibold text-sm">
                              {row.name}
                            </span>
                            {row.description && (
                              <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                                {row.description}
                              </span>
                            )}
                            <div className="flex items-center gap-1 mt-1 text-[11px] text-muted-foreground">
                              {row.coupons && row.coupons.length > 0 ? (
                                <Badge
                                  variant="outline"
                                  className="text-[10px] py-0 px-1.5 h-4"
                                >
                                  {row.coupons.length} coupon
                                  {row.coupons.length > 1 ? "s" : ""}
                                </Badge>
                              ) : (
                                <span className="italic">Automatic deal</span>
                              )}
                              {row.isStackable && (
                                <Badge
                                  variant="secondary"
                                  className="text-[10px] py-0 px-1.5 h-4"
                                >
                                  Stackable
                                </Badge>
                              )}
                            </div>
                          </div>
                        </TableCell>

                        <TableCell>
                          <div className="flex items-center gap-2">
                            {row.type === "PERCENTAGE" && (
                              <Badge className="bg-emerald-600/10 text-emerald-700 hover:bg-emerald-600/20 border-emerald-300">
                                <Percent className="h-3 w-3 mr-1" />
                                {row.discountValue}% OFF
                              </Badge>
                            )}
                            {row.type === "FIXED_AMOUNT" && (
                              <Badge className="bg-blue-600/10 text-blue-700 hover:bg-blue-600/20 border-blue-300">
                                <DollarSign className="h-3 w-3 mr-0.5" />$
                                {row.discountValue} OFF
                              </Badge>
                            )}
                            {row.type === "FREE_SHIPPING" && (
                              <Badge className="bg-purple-600/10 text-purple-700 hover:bg-purple-600/20 border-purple-300">
                                Free Shipping
                              </Badge>
                            )}
                          </div>
                          {row.rules?.minOrderAmount ? (
                            <span className="text-[11px] text-muted-foreground block mt-1">
                              Min spend: ${row.rules.minOrderAmount}
                            </span>
                          ) : null}
                        </TableCell>

                        <TableCell>
                          {row.status === "ACTIVE" && (
                            <Badge className="bg-emerald-500/15 text-emerald-700 border-emerald-300 flex items-center w-fit gap-1">
                              <CheckCircle2 className="h-3 w-3" /> Active
                            </Badge>
                          )}
                          {row.status === "DRAFT" && (
                            <Badge
                              variant="outline"
                              className="text-amber-600 border-amber-300 flex items-center w-fit gap-1"
                            >
                              <Clock className="h-3 w-3" /> Draft
                            </Badge>
                          )}
                          {row.status === "DEACTIVATED" && (
                            <Badge
                              variant="destructive"
                              className="flex items-center w-fit gap-1"
                            >
                              <XCircle className="h-3 w-3" /> Deactivated
                            </Badge>
                          )}
                          {row.status === "EXPIRED" && (
                            <Badge
                              variant="secondary"
                              className="flex items-center w-fit gap-1"
                            >
                              Expired
                            </Badge>
                          )}
                        </TableCell>

                        <TableCell className="w-[180px]">
                          {budget ? (
                            <div className="space-y-1">
                              <div className="flex justify-between text-[11px]">
                                <span>${spent.toFixed(2)}</span>
                                <span className="text-muted-foreground">
                                  ${budget.totalBudget}
                                </span>
                              </div>
                              <Progress value={pct} className="h-1.5" />
                              <span className="text-[10px] text-muted-foreground">
                                {pct}% consumed
                              </span>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              Uncapped
                            </span>
                          )}
                        </TableCell>

                        <TableCell>
                          <div className="font-medium text-sm">
                            {row.rules?.usageCount ?? 0}
                          </div>
                          {row.rules?.globalLimit && (
                            <span className="text-[10px] text-muted-foreground">
                              limit {row.rules.globalLimit}
                            </span>
                          )}
                        </TableCell>

                        <TableCell className="text-xs text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            <span>
                              {new Date(row.startDate).toLocaleDateString()}
                            </span>
                          </div>
                          <div>
                            to {new Date(row.endDate).toLocaleDateString()}
                          </div>
                        </TableCell>

                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 text-xs gap-1"
                              onClick={() => {
                                setSelectedPromoForCoupon(row);
                                setCouponCode(
                                  `${row.name
                                    .replace(/[^a-zA-Z0-9]/g, "")
                                    .slice(0, 8)
                                    .toUpperCase()}`,
                                );
                              }}
                            >
                              <Ticket className="h-3.5 w-3.5" />
                              Add Code
                            </Button>

                            {row.status === "ACTIVE" && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 text-xs text-destructive hover:bg-destructive/10"
                                onClick={() =>
                                  deactivatePromoMutation.mutate(row.id)
                                }
                                disabled={deactivatePromoMutation.isPending}
                              >
                                Deactivate
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {promotionsData && promotionsData.totalPages > 1 && (
            <div className="flex items-center justify-between p-4 border-t text-sm text-muted-foreground">
              <div>
                Page {promotionsData.page} of {promotionsData.totalPages} (
                {promotionsData.total} campaigns)
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => p + 1)}
                  disabled={page >= promotionsData.totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Coupon Modal */}
      {selectedPromoForCoupon && (
        <Sheet
          open={!!selectedPromoForCoupon}
          onOpenChange={() => setSelectedPromoForCoupon(null)}
        >
          <SheetContent className="sm:max-w-md">
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2">
                <Ticket className="h-5 w-5 text-primary" />
                Add Coupon Code
              </SheetTitle>
              <SheetDescription>
                Issue a custom coupon code tied to campaign:{" "}
                <strong>{selectedPromoForCoupon.name}</strong>.
              </SheetDescription>
            </SheetHeader>

            <form onSubmit={handleCreateCoupon} className="space-y-4 py-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground uppercase">
                  Coupon Code *
                </label>
                <Input
                  placeholder="e.g. SUMMER50"
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                  required
                />
                <p className="text-[11px] text-muted-foreground">
                  Must be uppercase alphanumeric, hyphens, or underscores.
                </p>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground uppercase">
                  Max Redemptions (Optional)
                </label>
                <Input
                  type="number"
                  min="1"
                  placeholder="Leave empty for unlimited"
                  value={maxCouponRedemptions ?? ""}
                  onChange={(e) =>
                    setMaxCouponRedemptions(
                      e.target.value ? Number(e.target.value) : undefined,
                    )
                  }
                />
              </div>

              <div className="pt-4 flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setSelectedPromoForCoupon(null)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createCouponMutation.isPending}
                  className="gap-2"
                >
                  {createCouponMutation.isPending && (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  )}
                  Create Coupon
                </Button>
              </div>
            </form>
          </SheetContent>
        </Sheet>
      )}
    </div>
  );
}
