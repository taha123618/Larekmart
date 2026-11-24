"use client";

import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@clerk/nextjs";
import Link from "next/link";
import { toast } from "react-toastify";
import {
  fetchAdminWishlistOverview,
  fetchAdminWishlists,
  type WishlistOverviewStats,
  type AdminWishlistsResponse,
  type AdminWishlistItem,
} from "@/services/wishlist.service";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Heart,
  TrendingDown,
  BellRing,
  Bookmark,
  Layers,
  Search,
  RefreshCw,
  ExternalLink,
  Loader2,
  Calendar,
  Lock,
  Globe,
  Share2,
  User,
  Copy,
  Check,
  Eye,
  Sparkles,
  X,
  PackageOpen,
} from "lucide-react";

export default function WishlistsAdminDashboardPage() {
  const { getToken } = useAuth();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [visibilityFilter, setVisibilityFilter] = useState<
    "ALL" | "PUBLIC" | "SHARED" | "PRIVATE"
  >("ALL");
  const [selectedWishlist, setSelectedWishlist] =
    useState<AdminWishlistItem | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const limit = 15;

  // 1. Fetch Overview Stats
  const {
    data: overview,
    isLoading: isOverviewLoading,
    refetch: refetchOverview,
    isRefetching: isOverviewRefetching,
  } = useQuery<WishlistOverviewStats>({
    queryKey: ["admin-wishlist-overview"],
    queryFn: async () => {
      const token = await getToken();
      if (!token) throw new Error("Unauthorized");
      return fetchAdminWishlistOverview(token);
    },
    staleTime: 30000,
  });

  // 2. Fetch Wishlists Directory
  const {
    data: wishlistsData,
    isLoading: isWishlistsLoading,
    refetch: refetchWishlists,
    isRefetching: isWishlistsRefetching,
  } = useQuery<AdminWishlistsResponse>({
    queryKey: ["admin-wishlists-list", page, limit, debouncedSearch],
    queryFn: async () => {
      const token = await getToken();
      if (!token) throw new Error("Unauthorized");
      return fetchAdminWishlists(token, {
        page,
        limit,
        search: debouncedSearch || undefined,
      });
    },
    staleTime: 15000,
  });

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setDebouncedSearch(search.trim());
    setPage(1);
  };

  const handleClearSearch = () => {
    setSearch("");
    setDebouncedSearch("");
    setPage(1);
  };

  const isRefreshing = isOverviewRefetching || isWishlistsRefetching;

  const handleRefresh = async () => {
    try {
      await Promise.all([refetchOverview(), refetchWishlists()]);
      toast.success("Wishlist metrics refreshed");
    } catch {
      toast.error("Failed to refresh wishlists");
    }
  };

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(text);
    toast.success(`${label} copied to clipboard`);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleInspect = (wishlist: AdminWishlistItem) => {
    setSelectedWishlist(wishlist);
    setIsSheetOpen(true);
  };

  // Client-side visibility filter for current page items
  const filteredItems = useMemo(() => {
    if (!wishlistsData?.items) return [];
    if (visibilityFilter === "ALL") return wishlistsData.items;
    return wishlistsData.items.filter(
      (item) => item.visibility === visibilityFilter,
    );
  }, [wishlistsData?.items, visibilityFilter]);

  return (
    <div className="flex flex-col gap-6">
      {/* Breadcrumb Navigation */}
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/">Dashboard</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink href="/reviews">
              Customer Feedback & Intent
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Customer Wishlists</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-5 rounded-xl border border-border/60 bg-card shadow-xs">
        <div className="flex items-center gap-3.5">
          <div className="p-2.5 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
            <Heart className="w-6 h-6 fill-rose-500/20" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                Customer Wishlists & Intent
              </h1>
              <Badge
                variant="outline"
                className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-[11px] font-semibold"
              >
                Live Sync
              </Badge>
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
              Monitor customer purchase intent, price drop alerts, restock
              demand, and saved product pipelines across storefronts.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="gap-2 cursor-pointer shadow-xs"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`}
            />
            <span>Refresh</span>
          </Button>
          <Button size="sm" asChild className="gap-2 cursor-pointer shadow-xs">
            <Link href="/products">
              <PackageOpen className="w-3.5 h-3.5" />
              <span>Catalog Products</span>
            </Link>
          </Button>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Wishlists */}
        <Card className="border-border/60 bg-card text-card-foreground shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Total Wishlists
            </CardTitle>
            <div className="p-1.5 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400">
              <Bookmark className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {isOverviewLoading ? (
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              ) : (
                (overview?.totalWishlists.toLocaleString() ?? "0")
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Active customer gift & desire lists
            </p>
          </CardContent>
        </Card>

        {/* Saved Products */}
        <Card className="border-border/60 bg-card text-card-foreground shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Saved Products
            </CardTitle>
            <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
              <Layers className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {isOverviewLoading ? (
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              ) : (
                (overview?.totalSavedItems.toLocaleString() ?? "0")
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Avg {overview?.averageItemsPerWishlist ?? 0} items per list
            </p>
          </CardContent>
        </Card>

        {/* Price Drop Alerts */}
        <Card className="border-border/60 bg-card text-card-foreground shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Price Drop Alerts
            </CardTitle>
            <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <TrendingDown className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {isOverviewLoading ? (
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              ) : (
                (overview?.priceDropAlertsCount.toLocaleString() ?? "0")
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Automated notifications delivered
            </p>
          </CardContent>
        </Card>

        {/* Restock Alerts */}
        <Card className="border-border/60 bg-card text-card-foreground shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Restock Alerts
            </CardTitle>
            <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <BellRing className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
              {isOverviewLoading ? (
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              ) : (
                (overview?.restockAlertsCount.toLocaleString() ?? "0")
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Back-in-stock notifications fired
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Top Saved Products Leaderboard */}
      {overview?.topSavedProducts && overview.topSavedProducts.length > 0 && (
        <Card className="border-border/60 bg-card text-card-foreground shadow-xs">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-500" />
                <CardTitle className="text-sm font-semibold tracking-tight text-foreground">
                  Most Desired Products Across Customers
                </CardTitle>
              </div>
              <Badge variant="outline" className="text-[10px] font-semibold">
                High Purchase Intent
              </Badge>
            </div>
            <CardDescription className="text-xs text-muted-foreground">
              Products appearing most frequently on customer wishlists, showing
              unfulfilled demand and promotion opportunities.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {overview.topSavedProducts.map((p, idx) => (
                <div
                  key={p.productId}
                  className="p-3 rounded-xl bg-muted/40 border border-border/60 flex flex-col justify-between hover:border-indigo-500/40 hover:bg-muted/70 transition-colors"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span
                      className={`size-5 rounded-full text-[10px] font-bold flex items-center justify-center ${
                        idx === 0
                          ? "bg-amber-500 text-white shadow-xs"
                          : idx === 1
                            ? "bg-slate-400 text-white shadow-xs"
                            : idx === 2
                              ? "bg-amber-700 text-white shadow-xs"
                              : "bg-muted text-muted-foreground"
                      }`}
                    >
                      #{idx + 1}
                    </span>
                    <Badge
                      variant="secondary"
                      className="text-[10px] font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"
                    >
                      {p.count} saves
                    </Badge>
                  </div>
                  <div className="text-xs font-semibold text-foreground truncate">
                    Product #{p.productId}
                  </div>
                  <Link
                    href={`/products`}
                    className="text-[11px] font-medium text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-1 mt-2"
                  >
                    <span>View Catalog</span>
                    <ExternalLink className="w-3 h-3" />
                  </Link>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Wishlists Directory Table Container */}
      <Card className="border-border/60 bg-card text-card-foreground shadow-xs">
        <CardHeader className="pb-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-base font-semibold text-foreground">
                Customer Wishlists Directory
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground mt-0.5">
                Browse, search, and audit customer and guest saved product lists
                in real time.
              </CardDescription>
            </div>

            {/* Filter & Search Toolbar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
              {/* Visibility Filter Pills */}
              <div className="flex items-center rounded-lg border border-border bg-muted/40 p-1 text-xs">
                {(["ALL", "PUBLIC", "SHARED", "PRIVATE"] as const).map(
                  (vis) => (
                    <button
                      key={vis}
                      onClick={() => setVisibilityFilter(vis)}
                      className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer text-[11px] ${
                        visibilityFilter === vis
                          ? "bg-background text-foreground shadow-xs font-semibold"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {vis === "ALL"
                        ? "All"
                        : vis.charAt(0) + vis.slice(1).toLowerCase()}
                    </button>
                  ),
                )}
              </div>

              {/* Search Form */}
              <form
                onSubmit={handleSearchSubmit}
                className="flex items-center gap-2"
              >
                <div className="relative w-full sm:w-64">
                  <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                  <Input
                    type="text"
                    placeholder="Search list name or user ID..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-8 pr-8 text-xs h-9 bg-background"
                  />
                  {search && (
                    <button
                      type="button"
                      onClick={handleClearSearch}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <Button
                  type="submit"
                  size="sm"
                  variant="secondary"
                  className="text-xs h-9 cursor-pointer"
                >
                  Search
                </Button>
              </form>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="rounded-none border-t border-border/60 overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow className="border-border/60">
                  <TableHead className="text-xs font-semibold text-muted-foreground">
                    Wishlist Name
                  </TableHead>
                  <TableHead className="text-xs font-semibold text-muted-foreground">
                    Owner / Account
                  </TableHead>
                  <TableHead className="text-xs font-semibold text-muted-foreground text-center">
                    Saved Items
                  </TableHead>
                  <TableHead className="text-xs font-semibold text-muted-foreground">
                    Visibility
                  </TableHead>
                  <TableHead className="text-xs font-semibold text-muted-foreground">
                    List Type
                  </TableHead>
                  <TableHead className="text-xs font-semibold text-muted-foreground">
                    Created Date
                  </TableHead>
                  <TableHead className="text-xs font-semibold text-muted-foreground text-right pr-4">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isWishlistsLoading ? (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="h-40 text-center text-xs text-muted-foreground"
                    >
                      <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-600" />
                      Loading customer wishlists directory...
                    </TableCell>
                  </TableRow>
                ) : filteredItems.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="h-40 text-center text-xs text-muted-foreground"
                    >
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Heart className="w-8 h-8 text-muted-foreground/40" />
                        <span className="font-semibold text-foreground">
                          No wishlists found
                        </span>
                        <span className="text-xs max-w-sm">
                          {debouncedSearch || visibilityFilter !== "ALL"
                            ? "No customer wishlists match the current search filters. Try adjusting your query."
                            : "There are currently no active customer wishlists registered in the system."}
                        </span>
                        {(debouncedSearch || visibilityFilter !== "ALL") && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              handleClearSearch();
                              setVisibilityFilter("ALL");
                            }}
                            className="mt-2 text-xs h-8 cursor-pointer"
                          >
                            Reset Filters
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredItems.map((row) => (
                    <TableRow
                      key={row.id}
                      className="border-border/60 hover:bg-muted/40 transition-colors"
                    >
                      {/* Name */}
                      <TableCell className="font-semibold text-xs text-foreground">
                        <div className="flex items-center gap-2">
                          <Bookmark className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                          <span className="truncate max-w-[180px]">
                            {row.name}
                          </span>
                        </div>
                      </TableCell>

                      {/* Owner */}
                      <TableCell className="text-xs">
                        {row.userId ? (
                          <div className="flex items-center gap-1.5">
                            <Link
                              href={`/users/${row.userId}`}
                              className="font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 font-mono text-[11px]"
                            >
                              <User className="w-3 h-3" />
                              <span>{row.userId.slice(0, 14)}...</span>
                            </Link>
                            <button
                              type="button"
                              onClick={() => handleCopy(row.userId!, "User ID")}
                              title="Copy User ID"
                              className="text-muted-foreground hover:text-foreground p-0.5 rounded cursor-pointer"
                            >
                              {copiedId === row.userId ? (
                                <Check className="w-3 h-3 text-emerald-500" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-[11px] font-mono">
                            Guest: {row.guestId?.substring(0, 12)}...
                          </span>
                        )}
                      </TableCell>

                      {/* Items */}
                      <TableCell className="text-xs font-bold text-center">
                        <Badge
                          variant="secondary"
                          className="text-[11px] font-bold px-2 py-0.5"
                        >
                          {row.itemCount}{" "}
                          {row.itemCount === 1 ? "item" : "items"}
                        </Badge>
                      </TableCell>

                      {/* Visibility */}
                      <TableCell className="text-xs">
                        {row.visibility === "PUBLIC" ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                            <Globe className="w-3 h-3" /> Public
                          </span>
                        ) : row.visibility === "SHARED" ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20">
                            <Share2 className="w-3 h-3" /> Shared
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-muted-foreground px-2 py-0.5 rounded-full bg-muted border border-border">
                            <Lock className="w-3 h-3" /> Private
                          </span>
                        )}
                      </TableCell>

                      {/* Type */}
                      <TableCell className="text-xs">
                        {row.isDefault ? (
                          <Badge className="bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 text-[10px] font-bold">
                            Default List
                          </Badge>
                        ) : (
                          <span className="text-[11px] text-muted-foreground">
                            Custom List
                          </span>
                        )}
                      </TableCell>

                      {/* Date */}
                      <TableCell className="text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {new Date(row.createdAt).toLocaleDateString("en-US", {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })}
                        </span>
                      </TableCell>

                      {/* Actions */}
                      <TableCell className="text-xs text-right pr-4">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleInspect(row)}
                            className="h-7 px-2 text-xs gap-1 cursor-pointer hover:bg-muted"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Inspect</span>
                          </Button>
                          {row.userId && (
                            <Button
                              variant="outline"
                              size="sm"
                              asChild
                              className="h-7 px-2 text-xs gap-1 cursor-pointer"
                            >
                              <Link href={`/users/${row.userId}`}>
                                <User className="w-3 h-3" />
                                <span>Owner</span>
                              </Link>
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Table Pagination */}
          {wishlistsData && wishlistsData.totalPages > 1 && (
            <div className="flex items-center justify-between p-4 border-t border-border/60">
              <span className="text-xs text-muted-foreground">
                Page {wishlistsData.page} of {wishlistsData.totalPages} (
                {wishlistsData.total.toLocaleString()} total wishlists)
              </span>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="text-xs h-8 cursor-pointer"
                >
                  Previous
                </Button>
                <div className="text-xs font-semibold px-2">
                  {page} / {wishlistsData.totalPages}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => p + 1)}
                  disabled={page >= wishlistsData.totalPages}
                  className="text-xs h-8 cursor-pointer"
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Wishlist Metadata Inspection Sheet */}
      {selectedWishlist && (
        <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
          <SheetContent className="sm:max-w-md overflow-y-auto">
            <SheetHeader className="pb-4 border-b border-border">
              <div className="flex items-center gap-2">
                <Bookmark className="w-5 h-5 text-rose-500" />
                <SheetTitle className="text-lg font-bold">
                  {selectedWishlist.name}
                </SheetTitle>
              </div>
              <SheetDescription className="text-xs text-muted-foreground">
                Detailed customer wishlist record and metadata inspection.
              </SheetDescription>
            </SheetHeader>

            <div className="space-y-4 py-4 text-xs">
              {/* Wishlist ID */}
              <div className="p-3 rounded-lg bg-muted/40 border border-border space-y-1">
                <div className="text-[11px] text-muted-foreground font-semibold">
                  Wishlist Identifier
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-foreground font-semibold">
                    {selectedWishlist.id}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      handleCopy(selectedWishlist.id, "Wishlist ID")
                    }
                    className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-foreground cursor-pointer"
                  >
                    {copiedId === selectedWishlist.id ? (
                      <Check className="w-3.5 h-3.5 text-emerald-500" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>

              {/* Status & Attributes */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-muted/40 border border-border space-y-1">
                  <div className="text-[11px] text-muted-foreground font-semibold">
                    Visibility
                  </div>
                  <div className="font-semibold text-foreground uppercase">
                    {selectedWishlist.visibility}
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-muted/40 border border-border space-y-1">
                  <div className="text-[11px] text-muted-foreground font-semibold">
                    List Type
                  </div>
                  <div className="font-semibold text-foreground">
                    {selectedWishlist.isDefault
                      ? "Default List"
                      : "Custom List"}
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-muted/40 border border-border space-y-1">
                  <div className="text-[11px] text-muted-foreground font-semibold">
                    Items Count
                  </div>
                  <div className="font-semibold text-foreground">
                    {selectedWishlist.itemCount} items
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-muted/40 border border-border space-y-1">
                  <div className="text-[11px] text-muted-foreground font-semibold">
                    Owner Status
                  </div>
                  <div className="font-semibold text-foreground">
                    {selectedWishlist.userId ? "Registered User" : "Guest User"}
                  </div>
                </div>
              </div>

              {/* Owner Account Details */}
              <div className="p-3 rounded-lg bg-muted/40 border border-border space-y-2">
                <div className="text-[11px] text-muted-foreground font-semibold">
                  Owner Account
                </div>
                {selectedWishlist.userId ? (
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-indigo-600 dark:text-indigo-400 font-semibold truncate max-w-[220px]">
                      {selectedWishlist.userId}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      asChild
                      className="h-7 text-xs cursor-pointer"
                    >
                      <Link href={`/users/${selectedWishlist.userId}`}>
                        Profile
                      </Link>
                    </Button>
                  </div>
                ) : (
                  <div className="font-mono text-muted-foreground text-[11px]">
                    Guest Session: {selectedWishlist.guestId}
                  </div>
                )}
              </div>

              {/* Timestamps */}
              <div className="p-3 rounded-lg bg-muted/40 border border-border space-y-2">
                <div className="text-[11px] text-muted-foreground font-semibold">
                  Timestamps
                </div>
                <div className="flex justify-between py-0.5 text-muted-foreground">
                  <span>Created:</span>
                  <span className="font-semibold text-foreground">
                    {new Date(selectedWishlist.createdAt).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between py-0.5 text-muted-foreground">
                  <span>Last Updated:</span>
                  <span className="font-semibold text-foreground">
                    {new Date(selectedWishlist.updatedAt).toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex flex-col gap-2">
                {selectedWishlist.userId && (
                  <Button
                    asChild
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer"
                  >
                    <Link href={`/users/${selectedWishlist.userId}`}>
                      <User className="w-4 h-4 mr-2" />
                      View Customer Profile & Addresses
                    </Link>
                  </Button>
                )}
                <Button
                  variant="outline"
                  onClick={() => setIsSheetOpen(false)}
                  className="w-full cursor-pointer"
                >
                  Close Inspection
                </Button>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      )}
    </div>
  );
}
