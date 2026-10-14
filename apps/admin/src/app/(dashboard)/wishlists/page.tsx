"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@clerk/nextjs";
import {
  fetchAdminWishlistOverview,
  fetchAdminWishlists,
  type WishlistOverviewStats,
  type AdminWishlistsResponse,
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
} from "lucide-react";
import Link from "next/link";

export default function WishlistsAdminDashboardPage() {
  const { getToken } = useAuth();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
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
    setDebouncedSearch(search);
    setPage(1);
  };

  const isRefreshing = isOverviewRefetching || isWishlistsRefetching;

  return (
    <div className="space-y-8 p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
            <span className="p-2 rounded-2xl bg-rose-50 dark:bg-rose-950/60 text-rose-500">
              <Heart className="w-6 h-6 fill-rose-500" />
            </span>
            <span>Customer Wishlists & Intent</span>
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Monitor customer desire metrics, price drop engagement, restock
            demand, and saved product pipelines
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            refetchOverview();
            refetchWishlists();
          }}
          disabled={isRefreshing}
          className="gap-2 cursor-pointer shadow-sm"
        >
          <RefreshCw
            className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`}
          />
          <span>Refresh</span>
        </Button>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <Card className="border-slate-200/80 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-900/60 backdrop-blur-xl">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Total Wishlists
            </CardTitle>
            <Bookmark className="w-4 h-4 text-rose-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-slate-900 dark:text-white">
              {isOverviewLoading ? (
                <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
              ) : (
                (overview?.totalWishlists.toLocaleString() ?? 0)
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Active customer gift & desire lists
            </p>
          </CardContent>
        </Card>

        <Card className="border-slate-200/80 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-900/60 backdrop-blur-xl">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Saved Products
            </CardTitle>
            <Layers className="w-4 h-4 text-indigo-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-slate-900 dark:text-white">
              {isOverviewLoading ? (
                <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
              ) : (
                (overview?.totalSavedItems.toLocaleString() ?? 0)
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Avg {overview?.averageItemsPerWishlist ?? 0} items per list
            </p>
          </CardContent>
        </Card>

        <Card className="border-slate-200/80 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-900/60 backdrop-blur-xl">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Price Drop Alerts
            </CardTitle>
            <TrendingDown className="w-4 h-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-slate-900 dark:text-white">
              {isOverviewLoading ? (
                <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
              ) : (
                (overview?.priceDropAlertsCount.toLocaleString() ?? 0)
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Automated notifications delivered
            </p>
          </CardContent>
        </Card>

        <Card className="border-slate-200/80 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-900/60 backdrop-blur-xl">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Restock Alerts
            </CardTitle>
            <BellRing className="w-4 h-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-slate-900 dark:text-white">
              {isOverviewLoading ? (
                <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
              ) : (
                (overview?.restockAlertsCount.toLocaleString() ?? 0)
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Back-in-stock notifications fired
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Top Saved Products Leaderboard */}
      {overview?.topSavedProducts && overview.topSavedProducts.length > 0 && (
        <Card className="border-slate-200/80 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-900/60 backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Heart className="w-4 h-4 text-rose-500" />
              <span>Most Desired Products Across All Customers</span>
            </CardTitle>
            <CardDescription className="text-xs text-slate-500">
              Products appearing most frequently on customer wishlists (high
              intent to purchase)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {overview.topSavedProducts.map((p, idx) => (
                <div
                  key={p.productId}
                  className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 flex flex-col justify-between"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-[10px] font-black flex items-center justify-center">
                      #{idx + 1}
                    </span>
                    <Badge
                      variant="secondary"
                      className="text-[10px] font-black"
                    >
                      {p.count} saves
                    </Badge>
                  </div>
                  <div className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                    Product #{p.productId}
                  </div>
                  <Link
                    href={`/products`}
                    className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-1 mt-1"
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

      {/* Wishlists Directory Table */}
      <Card className="border-slate-200/80 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-900/60 backdrop-blur-xl">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <CardTitle className="text-base font-bold text-slate-900 dark:text-white">
              Customer Wishlists Directory
            </CardTitle>
            <CardDescription className="text-xs text-slate-500">
              Browse, search, and audit all customer and guest wishlists
            </CardDescription>
          </div>

          <form
            onSubmit={handleSearchSubmit}
            className="flex items-center gap-2 max-w-sm w-full"
          >
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                type="text"
                placeholder="Search user, guest or list name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 text-xs h-9"
              />
            </div>
            <Button
              type="submit"
              size="sm"
              variant="secondary"
              className="text-xs h-9 cursor-pointer"
            >
              Filter
            </Button>
          </form>
        </CardHeader>
        <CardContent>
          <div className="rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden">
            <Table>
              <TableHeader className="bg-slate-50 dark:bg-slate-900/90">
                <TableRow>
                  <TableHead className="text-xs font-bold">
                    Wishlist Name
                  </TableHead>
                  <TableHead className="text-xs font-bold">
                    Owner / User ID
                  </TableHead>
                  <TableHead className="text-xs font-bold text-center">
                    Items
                  </TableHead>
                  <TableHead className="text-xs font-bold">
                    Visibility
                  </TableHead>
                  <TableHead className="text-xs font-bold">Default</TableHead>
                  <TableHead className="text-xs font-bold">
                    Created Date
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isWishlistsLoading ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="h-32 text-center text-xs text-slate-400"
                    >
                      <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-indigo-500" />
                      Loading customer wishlists...
                    </TableCell>
                  </TableRow>
                ) : !wishlistsData?.items ||
                  wishlistsData.items.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="h-32 text-center text-xs text-slate-400"
                    >
                      No customer wishlists found matching criteria.
                    </TableCell>
                  </TableRow>
                ) : (
                  wishlistsData.items.map((row) => (
                    <TableRow
                      key={row.id}
                      className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40"
                    >
                      <TableCell className="font-bold text-xs text-slate-900 dark:text-white">
                        <div className="flex items-center gap-2">
                          <Bookmark className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                          <span>{row.name}</span>
                        </div>
                      </TableCell>

                      <TableCell className="text-xs font-mono text-slate-600 dark:text-slate-400">
                        {row.userId ? (
                          <span className="text-indigo-600 dark:text-indigo-400 font-semibold">
                            {row.userId}
                          </span>
                        ) : (
                          <span className="text-slate-400">
                            Guest: {row.guestId?.substring(0, 16)}...
                          </span>
                        )}
                      </TableCell>

                      <TableCell className="text-xs font-black text-center text-slate-800 dark:text-slate-200">
                        <Badge
                          variant="secondary"
                          className="text-[11px] font-bold"
                        >
                          {row.itemCount}
                        </Badge>
                      </TableCell>

                      <TableCell className="text-xs">
                        {row.visibility === "PUBLIC" ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                            <Globe className="w-3 h-3" /> Public
                          </span>
                        ) : row.visibility === "SHARED" ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 dark:text-indigo-400">
                            <Share2 className="w-3 h-3" /> Shared
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500">
                            <Lock className="w-3 h-3" /> Private
                          </span>
                        )}
                      </TableCell>

                      <TableCell className="text-xs">
                        {row.isDefault ? (
                          <Badge className="bg-rose-500 text-white text-[10px] font-black">
                            Default
                          </Badge>
                        ) : (
                          <span className="text-[11px] text-slate-400">
                            Custom
                          </span>
                        )}
                      </TableCell>

                      <TableCell className="text-xs text-slate-500 dark:text-slate-400">
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {new Date(row.createdAt).toLocaleDateString()}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {wishlistsData && wishlistsData.totalPages > 1 && (
            <div className="flex items-center justify-between pt-4">
              <span className="text-xs text-slate-500">
                Page {wishlistsData.page} of {wishlistsData.totalPages} (
                {wishlistsData.total} wishlists)
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
    </div>
  );
}
