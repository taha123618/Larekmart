"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth, useUser } from "@clerk/nextjs";
import {
  fetchSystemSettings,
  updateSystemSettings,
  fetchAdminDelegations,
  grantAdminDelegation,
  revokeAdminDelegation,
  type UpdateAdminSystemSettingsInput,
} from "@/services/seller.service";
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
  ShieldAlert,
  ShieldCheck,
  Store,
  RefreshCw,
  AlertTriangle,
  Lock,
  Layers,
  Database,
  Radio,
  CheckCircle2,
  XCircle,
  UserCheck,
  Trash2,
  Sliders,
  Megaphone,
} from "lucide-react";
import { toast } from "react-toastify";

export default function SettingsAdminPage() {
  const { getToken } = useAuth();
  const { user } = useUser();
  const queryClient = useQueryClient();

  // Super Admin qualification verification
  const userRole = user?.publicMetadata?.role as string | undefined;
  const isSuperAdminFlag = user?.publicMetadata?.isSuperAdmin as
    | boolean
    | undefined;
  const isSuperAdmin = userRole === "super_admin" || isSuperAdminFlag === true;

  // Query platform system settings
  const {
    data: settings,
    isLoading,
    isRefetching,
    refetch,
    error,
  } = useQuery({
    queryKey: ["admin", "system-settings"],
    queryFn: async () => {
      const token = await getToken();
      return fetchSystemSettings(token || undefined);
    },
  });

  // Mutation for updating system settings
  const updateMutation = useMutation({
    mutationFn: async (input: boolean | UpdateAdminSystemSettingsInput) => {
      const token = await getToken();
      return updateSystemSettings(input, token || undefined);
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["admin", "system-settings"], data.settings);
      toast.success(data.message || "System settings updated successfully!");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to update system settings.");
    },
  });

  const [maintenanceText, setMaintenanceText] = useState("");
  const isSellerEnabled = settings?.isSellerEnabled ?? true;
  const isSellerRegistrationOpen = settings?.isSellerRegistrationOpen ?? true;
  const isStorefrontsActive = settings?.isStorefrontsActive ?? true;

  // Delegated Manage Admins state & queries
  const [newAdminUserId, setNewAdminUserId] = useState("");

  const {
    data: delegations = [],
    isLoading: isLoadingDelegations,
    refetch: refetchDelegations,
  } = useQuery({
    queryKey: ["admin", "delegations"],
    queryFn: async () => {
      const token = await getToken();
      return fetchAdminDelegations(token || undefined);
    },
    enabled: isSuperAdmin,
  });

  const grantMutation = useMutation({
    mutationFn: async (userId: string) => {
      const token = await getToken();
      return grantAdminDelegation(userId, token || undefined);
    },
    onSuccess: () => {
      setNewAdminUserId("");
      refetchDelegations();
      toast.success("Manage Admin delegation granted successfully!");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to grant delegation");
    },
  });

  const revokeMutation = useMutation({
    mutationFn: async (userId: string) => {
      const token = await getToken();
      return revokeAdminDelegation(userId, token || undefined);
    },
    onSuccess: () => {
      refetchDelegations();
      toast.success("Manage Admin delegation revoked successfully!");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to revoke delegation");
    },
  });

  return (
    <div className="space-y-6 max-w-6xl mx-auto py-4">
      {/* Page Title & Breadcrumb */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-gray-200 dark:border-gray-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
              Platform System Settings
            </h1>
            {isSuperAdmin ? (
              <Badge className="bg-emerald-600/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-xs">
                Super Admin Access
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className="text-amber-600 border-amber-500/20 text-xs"
              >
                Restricted Admin View
              </Badge>
            )}
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Global governance, ecosystem toggles, and multi-tenant marketplace
            configuration.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isLoading || isRefetching}
          className="flex items-center gap-2"
        >
          <RefreshCw
            className={`w-4 h-4 ${isRefetching ? "animate-spin" : ""}`}
          />
          Refresh
        </Button>
      </div>

      {/* Super Admin Access Warning Banner if not Super Admin */}
      {!isSuperAdmin && (
        <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-900/50">
          <CardContent className="flex items-start gap-3 p-4">
            <ShieldAlert className="w-5 h-5 text-amber-600 dark:text-amber-500 shrink-0 mt-0.5" />
            <div className="text-sm">
              <span className="font-semibold text-amber-900 dark:text-amber-300">
                Super Admin Permission Required:
              </span>{" "}
              <span className="text-amber-800 dark:text-amber-400">
                You are authenticated as an Administrator, but changing
                project-wide marketplace governance settings is strictly
                restricted to designated <strong>Super Admins</strong>. Contact
                your system owner to grant super-admin access.
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error Banner */}
      {error && (
        <Card className="border-rose-200 bg-rose-50 dark:bg-rose-950/20 dark:border-rose-900/50">
          <CardContent className="flex items-center gap-3 p-4 text-rose-700 dark:text-rose-400 text-sm">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <span>
              {(error as Error).message ||
                "Failed to load system settings from server."}
            </span>
          </CardContent>
        </Card>
      )}

      {/* Main Setting Card: Seller & Vendor Ecosystem */}
      <Card className="border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
        <CardHeader className="bg-gray-50/50 dark:bg-zinc-900/50 border-b border-gray-200 dark:border-gray-800">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Store className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <CardTitle className="text-lg">
                  Seller & Vendor Marketplace Feature
                </CardTitle>
              </div>
              <CardDescription>
                Authoritative project-wide switch controlling multi-tenant
                merchant onboarding, public storefronts, and seller operations.
              </CardDescription>
            </div>

            <div className="flex items-center gap-3">
              {isLoading ? (
                <div className="h-6 w-20 bg-gray-200 dark:bg-zinc-800 animate-pulse rounded" />
              ) : isSellerEnabled ? (
                <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white flex items-center gap-1.5 px-3 py-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Ecosystem Active
                </Badge>
              ) : (
                <Badge
                  variant="destructive"
                  className="flex items-center gap-1.5 px-3 py-1"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  Ecosystem Disabled
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-6 space-y-6">
          {/* Status & Control Panel */}
          <div className="bg-white dark:bg-zinc-900 rounded-lg p-5 border border-gray-200 dark:border-gray-800 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-1.5 max-w-xl">
              <div className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <span>Setting Key:</span>
                <code className="text-xs bg-gray-100 dark:bg-zinc-800 px-2 py-0.5 rounded text-indigo-600 dark:text-indigo-400 font-mono">
                  isSellerEnabled
                </code>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {isSellerEnabled
                  ? "Marketplace features are currently ENABLED across the platform. Eligible users with verified credentials can register stores, browse merchant stores, and operate marketplace listings."
                  : "Marketplace features are currently DISABLED project-wide. All merchant registration, seller navigation, storefront pages, and API actions are blocked. Existing data is fully preserved."}
              </p>
            </div>

            <div className="flex items-center gap-4 shrink-0">
              <Button
                variant={isSellerEnabled ? "destructive" : "default"}
                size="lg"
                disabled={
                  !isSuperAdmin || isLoading || updateMutation.isPending
                }
                onClick={() => updateMutation.mutate(!isSellerEnabled)}
                className={`font-semibold shadow-sm min-w-[170px] ${
                  !isSellerEnabled
                    ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                    : ""
                }`}
              >
                {updateMutation.isPending ? (
                  <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                ) : isSuperAdmin ? (
                  isSellerEnabled ? (
                    <XCircle className="w-4 h-4 mr-2" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                  )
                ) : (
                  <Lock className="w-4 h-4 mr-2" />
                )}
                {isSellerEnabled ? "Disable Marketplace" : "Enable Marketplace"}
              </Button>
            </div>
          </div>

          {/* Behavior Breakdown Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-lg border border-gray-200 dark:border-gray-800 p-4 bg-gray-50/50 dark:bg-zinc-900/30 space-y-2.5">
              <div className="flex items-center gap-2 text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 className="w-4 h-4" />
                <span>When Enabled</span>
              </div>
              <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-1.5 list-disc pl-4">
                <li>
                  Displays &ldquo;Become a Seller&rdquo; wizard and storefront
                  navigation in client header/footer.
                </li>
                <li>
                  Allows users with{" "}
                  <code className="bg-gray-200 dark:bg-zinc-800 px-1 rounded">
                    isSeller: true
                  </code>{" "}
                  to onboard and manage stores.
                </li>
                <li>
                  Activates public storefront URLs (
                  <code className="bg-gray-200 dark:bg-zinc-800 px-1 rounded">
                    /stores/:slug
                  </code>
                  ) and merchant policies.
                </li>
                <li>
                  Permits vendor KYB submission and multi-staff management.
                </li>
              </ul>
            </div>

            <div className="rounded-lg border border-gray-200 dark:border-gray-800 p-4 bg-gray-50/50 dark:bg-zinc-900/30 space-y-2.5">
              <div className="flex items-center gap-2 text-sm font-semibold text-rose-700 dark:text-rose-400">
                <XCircle className="w-4 h-4" />
                <span>When Disabled</span>
              </div>
              <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-1.5 list-disc pl-4">
                <li>
                  Hides all seller and vendor navigation links throughout the
                  customer storefront and admin dashboard.
                </li>
                <li>
                  Direct URLs and API calls to seller routes are blocked with
                  HTTP 403 Forbidden.
                </li>
                <li>
                  Shows an informative disabled state explaining that the seller
                  program is temporarily paused.
                </li>
                <li>
                  All database records, stores, staff, and policies are safely
                  preserved for re-activation.
                </li>
              </ul>
            </div>
          </div>

          {/* Granular Operational Sub-Controls */}
          <div className="pt-4 border-t border-gray-200 dark:border-gray-800 space-y-4">
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                Granular Marketplace Operational Controls
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Sub-Switch 1: Registration Open */}
              <div className="p-4 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-zinc-900 flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      Seller Onboarding & Registration
                    </span>
                    <Badge
                      variant={
                        isSellerRegistrationOpen ? "default" : "secondary"
                      }
                      className="text-[10px]"
                    >
                      {isSellerRegistrationOpen ? "Open" : "Paused"}
                    </Badge>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Controls whether new merchants can submit KYB applications
                    via &ldquo;Become a Seller&rdquo;.
                  </p>
                </div>
                <Button
                  size="sm"
                  variant={isSellerRegistrationOpen ? "outline" : "default"}
                  disabled={
                    !isSuperAdmin ||
                    !isSellerEnabled ||
                    updateMutation.isPending
                  }
                  onClick={() =>
                    updateMutation.mutate({
                      isSellerRegistrationOpen: !isSellerRegistrationOpen,
                    })
                  }
                  className="shrink-0"
                >
                  {!isSuperAdmin && <Lock className="w-3.5 h-3.5 mr-1" />}
                  {isSellerRegistrationOpen
                    ? "Pause Onboarding"
                    : "Open Onboarding"}
                </Button>
              </div>

              {/* Sub-Switch 2: Storefronts Active */}
              <div className="p-4 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-zinc-900 flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      Marketplace Storefronts & Purchasing
                    </span>
                    <Badge
                      variant={isStorefrontsActive ? "default" : "secondary"}
                      className="text-[10px]"
                    >
                      {isStorefrontsActive ? "Active" : "Paused"}
                    </Badge>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Controls customer browsing and ordering across seller stores
                    (/stores/:slug).
                  </p>
                </div>
                <Button
                  size="sm"
                  variant={isStorefrontsActive ? "outline" : "default"}
                  disabled={
                    !isSuperAdmin ||
                    !isSellerEnabled ||
                    updateMutation.isPending
                  }
                  onClick={() =>
                    updateMutation.mutate({
                      isStorefrontsActive: !isStorefrontsActive,
                    })
                  }
                  className="shrink-0"
                >
                  {!isSuperAdmin && <Lock className="w-3.5 h-3.5 mr-1" />}
                  {isStorefrontsActive ? "Pause Stores" : "Activate Stores"}
                </Button>
              </div>
            </div>

            {/* Sub-Control 3: Maintenance Announcement Message */}
            <div className="p-4 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-zinc-900 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Megaphone className="w-4 h-4 text-amber-500" />
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    Marketplace Maintenance Announcement
                  </span>
                </div>
                <span className="text-xs text-gray-500">
                  Displayed on storefront banners when operations are paused
                </span>
              </div>
              <div className="flex gap-2">
                <Input
                  value={maintenanceText || settings?.maintenanceMessage || ""}
                  onChange={(e) => setMaintenanceText(e.target.value)}
                  placeholder="e.g. Marketplace seller operations are temporarily paused for scheduled maintenance."
                  disabled={!isSuperAdmin || updateMutation.isPending}
                  className="text-xs"
                />
                <Button
                  size="sm"
                  disabled={!isSuperAdmin || updateMutation.isPending}
                  onClick={() =>
                    updateMutation.mutate({
                      maintenanceMessage:
                        maintenanceText ||
                        settings?.maintenanceMessage ||
                        "Marketplace seller operations are temporarily paused for routine maintenance.",
                    })
                  }
                >
                  {!isSuperAdmin && <Lock className="w-3.5 h-3.5 mr-1" />}
                  Save Announcement
                </Button>
              </div>
            </div>
          </div>

          {/* Metadata Audit Trail */}
          <div className="pt-4 border-t border-gray-200 dark:border-gray-800 flex flex-wrap items-center justify-between gap-4 text-xs text-gray-500">
            <div className="flex items-center gap-4">
              <span>
                <strong>Last Updated:</strong>{" "}
                {settings?.updatedAt
                  ? new Date(settings.updatedAt).toLocaleString()
                  : "Initial deployment"}
              </span>
              <span>•</span>
              <span>
                <strong>Updated By:</strong> {settings?.updatedBy || "system"}
              </span>
            </div>
            <div>
              <span>
                <strong>Storage Authority:</strong> PostgreSQL (
                <code className="font-mono">larekmart_seller_db</code>) + Redis
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* DELEGATED MANAGE ADMINS (SELLER VERIFICATION) */}
      <Card className="border border-gray-200 dark:border-gray-800 shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <CardTitle className="text-lg">
                  Delegated Manage Admins (Seller Verification)
                </CardTitle>
              </div>
              <CardDescription>
                Designate specific administrators with authority to verify
                sellers, inspect KYB records, and activate storefronts.
              </CardDescription>
            </div>
            <Badge variant="outline" className="text-xs">
              {delegations.length} Active Delegations
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {isSuperAdmin ? (
            <>
              {/* Grant New Delegation Form */}
              <div className="p-4 rounded-xl bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-gray-800 space-y-3">
                <div className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                  Grant Seller Verification Permission to an Administrator
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Input
                    placeholder="Enter Admin Clerk User ID (e.g. user_2abc123...)"
                    value={newAdminUserId}
                    onChange={(e) => setNewAdminUserId(e.target.value.trim())}
                    className="flex-1 bg-white dark:bg-zinc-800 font-mono text-xs"
                  />
                  <Button
                    size="sm"
                    disabled={!newAdminUserId || grantMutation.isPending}
                    onClick={() => grantMutation.mutate(newAdminUserId)}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium"
                  >
                    <UserCheck className="w-4 h-4 mr-1.5" />
                    {grantMutation.isPending
                      ? "Granting..."
                      : "Grant Manage Admin"}
                  </Button>
                </div>
                <p className="text-[11px] text-gray-500">
                  Admins granted this delegation gain authority to approve,
                  reject, suspend, and verify marketplace sellers and KYB
                  vendors without requiring platform-wide Super Admin access.
                </p>
              </div>

              {/* Delegations Table */}
              {isLoadingDelegations ? (
                <div className="text-xs text-gray-500 py-4 text-center">
                  Loading active delegations...
                </div>
              ) : delegations.length === 0 ? (
                <div className="text-center py-6 border border-dashed rounded-xl border-gray-200 dark:border-gray-800 text-xs text-gray-400">
                  No additional Manage Admins delegated. Only Super Admins
                  currently have verification authority.
                </div>
              ) : (
                <div className="divide-y divide-gray-200 dark:divide-gray-800 border rounded-xl overflow-hidden text-xs">
                  {delegations.map((del) => (
                    <div
                      key={del.id}
                      className="p-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-zinc-900/50 transition-colors"
                    >
                      <div className="space-y-0.5">
                        <div className="font-mono font-medium text-gray-900 dark:text-gray-100 flex items-center gap-2">
                          <span>{del.adminUserId}</span>
                          <Badge
                            variant="outline"
                            className="text-[10px] bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800"
                          >
                            manage_sellers
                          </Badge>
                        </div>
                        <div className="text-[11px] text-gray-400">
                          Granted by {del.grantedByUserId} on{" "}
                          {new Date(del.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={revokeMutation.isPending}
                        onClick={() => revokeMutation.mutate(del.adminUserId)}
                        className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30 h-8 px-2.5"
                      >
                        <Trash2 className="w-3.5 h-3.5 mr-1" />
                        Revoke
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="p-4 rounded-xl bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-gray-800 text-xs text-gray-500">
              Only a Super Admin can view, grant, or revoke Manage Admin seller
              verification permissions.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Infrastructure Diagnostics Card */}
      <Card className="border border-gray-200 dark:border-gray-800 shadow-sm">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            <CardTitle className="text-base">
              Ecosystem Governance Architecture
            </CardTitle>
          </div>
          <CardDescription>
            Multi-service synchronization, persistence, and caching posture.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div className="p-3 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-zinc-900 space-y-1">
              <div className="font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-1.5">
                <Database className="w-4 h-4 text-blue-500" />
                PostgreSQL Ledger
              </div>
              <p className="text-gray-500">
                Primary persistence in{" "}
                <code className="bg-gray-100 dark:bg-zinc-800 px-1 rounded">
                  system_settings
                </code>{" "}
                with ACID transactions.
              </p>
            </div>

            <div className="p-3 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-zinc-900 space-y-1">
              <div className="font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-1.5">
                <Radio className="w-4 h-4 text-amber-500" />
                Redis Cache Layer
              </div>
              <p className="text-gray-500">
                Sub-millisecond query evaluation via{" "}
                <code className="bg-gray-100 dark:bg-zinc-800 px-1 rounded">
                  marketplace:system_settings
                </code>{" "}
                with 60s TTL.
              </p>
            </div>

            <div className="p-3 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-zinc-900 space-y-1">
              <div className="font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                Edge Perimeter Guard
              </div>
              <p className="text-gray-500">
                Enforced by API Gateway & seller-service preHandler middleware.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
