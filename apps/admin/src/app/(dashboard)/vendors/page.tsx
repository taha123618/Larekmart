"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/nextjs";
import {
  fetchAdminVendors,
  fetchAdminVendorDetails,
  verifyAdminVendor,
  updateAdminVendorStatus,
  verifyAdminDocument,
  fetchPendingVerifications,
  type AdminVendorListItem,
} from "@/services/vendor.service";
import { fetchSystemSettings } from "@/services/seller.service";
import type { VendorStatus } from "@repo/types";
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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Building2,
  ShieldCheck,
  AlertTriangle,
  Search,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Eye,
  Loader2,
  FileText,
  Clock,
  Ban,
  ArrowRight,
} from "lucide-react";
import { toast } from "react-toastify";

type ActiveTab = "vendors" | "verifications" | "documents";

export default function VendorsAdminPage() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<ActiveTab>("vendors");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  // Selected vendor for details drawer
  const [selectedVendorId, setSelectedVendorId] = useState<string | null>(null);

  // KYB Verification Sheet state
  const [kybVendor, setKybVendor] = useState<AdminVendorListItem | null>(null);
  const [kybDecision, setKybDecision] = useState<"APPROVED" | "REJECTED">(
    "APPROVED",
  );
  const [kybNotes, setKybNotes] = useState("");

  // Status Change Sheet state
  const [statusVendor, setStatusVendor] = useState<AdminVendorListItem | null>(
    null,
  );
  const [newStatus, setNewStatus] = useState<VendorStatus>("SUSPENDED");
  const [statusReason, setStatusReason] = useState("");

  // 1. Query all vendors
  const {
    data: vendorsData,
    isLoading: isLoadingVendors,
    refetch: refetchVendors,
  } = useQuery({
    queryKey: ["admin-vendors", statusFilter],
    queryFn: async () => {
      const token = await getToken();
      return fetchAdminVendors(
        statusFilter !== "ALL" ? { status: statusFilter } : undefined,
        token || undefined,
      );
    },
  });

  // 2. Query pending verifications
  const {
    data: pendingVerifications = [],
    isLoading: isLoadingVerifications,
    refetch: refetchVerifications,
  } = useQuery({
    queryKey: ["admin-pending-verifications"],
    queryFn: async () => {
      const token = await getToken();
      return fetchPendingVerifications(token || undefined);
    },
  });

  // 3. Query selected vendor details
  const { data: selectedVendorDetails, isLoading: isLoadingDetails } = useQuery(
    {
      queryKey: ["admin-vendor-details", selectedVendorId],
      queryFn: async () => {
        if (!selectedVendorId) return null;
        const token = await getToken();
        return fetchAdminVendorDetails(selectedVendorId, token || undefined);
      },
      enabled: !!selectedVendorId,
    },
  );

  // 4. Query system settings to detect if seller/vendor functionality is enabled
  const { data: systemSettings } = useQuery({
    queryKey: ["marketplace-system-settings"],
    queryFn: () => fetchSystemSettings().catch(() => null),
  });

  const isSellerEnabled = systemSettings?.isSellerEnabled ?? true;

  // Mutations
  const verifyMutation = useMutation({
    mutationFn: async ({
      id,
      status,
      notes,
    }: {
      id: string;
      status: "APPROVED" | "REJECTED";
      notes: string;
    }) => {
      const token = await getToken();
      return verifyAdminVendor(
        id,
        { status, reviewNotes: notes },
        token || undefined,
      );
    },
    onSuccess: () => {
      toast.success("Vendor KYB verification successfully processed");
      setKybVendor(null);
      setKybNotes("");
      queryClient.invalidateQueries({ queryKey: ["admin-vendors"] });
      queryClient.invalidateQueries({
        queryKey: ["admin-pending-verifications"],
      });
      if (selectedVendorId) {
        queryClient.invalidateQueries({
          queryKey: ["admin-vendor-details", selectedVendorId],
        });
      }
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to process KYB verification");
    },
  });

  const statusMutation = useMutation({
    mutationFn: async ({
      id,
      status,
      reason,
    }: {
      id: string;
      status: VendorStatus;
      reason: string;
    }) => {
      const token = await getToken();
      return updateAdminVendorStatus(
        id,
        { status, reason },
        token || undefined,
      );
    },
    onSuccess: () => {
      toast.success("Vendor operational status successfully updated");
      setStatusVendor(null);
      setStatusReason("");
      queryClient.invalidateQueries({ queryKey: ["admin-vendors"] });
      if (selectedVendorId) {
        queryClient.invalidateQueries({
          queryKey: ["admin-vendor-details", selectedVendorId],
        });
      }
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to update vendor status");
    },
  });

  const verifyDocMutation = useMutation({
    mutationFn: async ({
      vendorId,
      docId,
      status,
      rejectionReason,
    }: {
      vendorId: string;
      docId: string;
      status: "ACCEPTED" | "REJECTED";
      rejectionReason?: string;
    }) => {
      const token = await getToken();
      return verifyAdminDocument(
        vendorId,
        docId,
        { status, rejectionReason },
        token || undefined,
      );
    },
    onSuccess: () => {
      toast.success("Document verification updated");
      if (selectedVendorId) {
        queryClient.invalidateQueries({
          queryKey: ["admin-vendor-details", selectedVendorId],
        });
      }
      queryClient.invalidateQueries({ queryKey: ["admin-vendors"] });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to verify document");
    },
  });

  const allVendors = vendorsData?.vendors || [];

  // Filter vendors by search query
  const filteredVendors = allVendors.filter((v) => {
    const q = searchQuery.toLowerCase();
    return (
      v.legalName.toLowerCase().includes(q) ||
      (v.tradeName && v.tradeName.toLowerCase().includes(q)) ||
      v.registrationNumber.toLowerCase().includes(q) ||
      v.country.toLowerCase().includes(q)
    );
  });

  // Calculate high-level summary counts
  const totalVendors = allVendors.length;
  const verifiedCount = allVendors.filter(
    (v) => v.status === "VERIFIED",
  ).length;
  const pendingCount = allVendors.filter(
    (v) => v.status === "PENDING_VERIFICATION" || v.status === "DRAFT",
  ).length;
  const suspendedCount = allVendors.filter(
    (v) => v.status === "SUSPENDED",
  ).length;

  const getStatusBadge = (status: VendorStatus | string) => {
    switch (status) {
      case "VERIFIED":
        return <Badge className="bg-emerald-600 text-white">VERIFIED</Badge>;
      case "PENDING_VERIFICATION":
        return <Badge className="bg-amber-500 text-white">PENDING KYB</Badge>;
      case "DRAFT":
        return <Badge variant="secondary">DRAFT</Badge>;
      case "REJECTED":
        return <Badge variant="destructive">REJECTED</Badge>;
      case "SUSPENDED":
        return <Badge className="bg-rose-600 text-white">SUSPENDED</Badge>;
      case "TERMINATED":
        return <Badge variant="destructive">TERMINATED</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6 pb-12 pt-4">
      {/* Top Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
            <Building2 className="h-7 w-7 text-indigo-600 dark:text-indigo-400" />
            Vendor & Business KYB Management
          </h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            Authoritative legal business entities, merchant KYB compliance, and
            verification workflows.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              refetchVendors();
              refetchVerifications();
            }}
          >
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
                Marketplace & Vendor Operations are Currently Disabled
              </h3>
              <p className="mt-1 text-xs text-amber-700/90 dark:text-amber-400/90">
                A Super Admin has toggled{" "}
                <code className="font-mono bg-amber-500/20 px-1 py-0.5 rounded">
                  isSellerEnabled = false
                </code>
                . Merchant onboarding and seller storefronts are suspended
                across the platform. Legal vendor organizations, business
                profiles, and KYB documents remain intact in read-only audit
                mode. A Super Admin can reactivate operations anytime in{" "}
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
              Total Organizations
            </CardTitle>
            <Building2 className="h-4 w-4 text-indigo-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
              {totalVendors}
            </div>
            <p className="text-xs text-neutral-500 mt-1">
              Across all jurisdictions
            </p>
          </CardContent>
        </Card>

        <Card className="border-neutral-200 dark:border-neutral-800">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-neutral-600 dark:text-neutral-400">
              KYB Verification Queue
            </CardTitle>
            <Clock className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
              {pendingCount}
            </div>
            <p className="text-xs text-neutral-500 mt-1">
              Awaiting compliance review
            </p>
          </CardContent>
        </Card>

        <Card className="border-neutral-200 dark:border-neutral-800">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-neutral-600 dark:text-neutral-400">
              Verified Entities
            </CardTitle>
            <ShieldCheck className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {verifiedCount}
            </div>
            <p className="text-xs text-neutral-500 mt-1">
              Fully approved businesses
            </p>
          </CardContent>
        </Card>

        <Card className="border-neutral-200 dark:border-neutral-800">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-neutral-600 dark:text-neutral-400">
              Suspended / At Risk
            </CardTitle>
            <AlertTriangle className="h-4 w-4 text-rose-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-rose-600 dark:text-rose-400">
              {suspendedCount}
            </div>
            <p className="text-xs text-neutral-500 mt-1">
              Flagged or suspended
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-neutral-200 dark:border-neutral-800 gap-2">
        <Button
          variant={activeTab === "vendors" ? "default" : "outline"}
          onClick={() => setActiveTab("vendors")}
          className="rounded-b-none"
        >
          <Building2 className="mr-2 h-4 w-4" />
          All Vendors ({totalVendors})
        </Button>
        <Button
          variant={activeTab === "verifications" ? "default" : "outline"}
          onClick={() => setActiveTab("verifications")}
          className="rounded-b-none"
        >
          <ShieldCheck className="mr-2 h-4 w-4" />
          Pending KYB Queue ({pendingVerifications.length})
        </Button>
      </div>

      {/* TAB 1: ALL VENDORS */}
      {activeTab === "vendors" && (
        <Card className="border-neutral-200 dark:border-neutral-800">
          <CardHeader className="p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-neutral-500" />
                <Input
                  placeholder="Search by legal name, registration #, country..."
                  className="pl-8"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-neutral-500">Filter status:</span>
                {[
                  "ALL",
                  "PENDING_VERIFICATION",
                  "VERIFIED",
                  "SUSPENDED",
                  "DRAFT",
                ].map((st) => (
                  <Button
                    key={st}
                    variant={statusFilter === st ? "default" : "outline"}
                    size="sm"
                    onClick={() => setStatusFilter(st)}
                  >
                    {st === "ALL" ? "All" : st.replace("_", " ")}
                  </Button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {isLoadingVendors ? (
              <div className="flex h-48 items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-neutral-400" />
              </div>
            ) : filteredVendors.length === 0 ? (
              <div className="p-12 text-center text-neutral-500 dark:text-neutral-400">
                No vendors found matching your search criteria.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Legal Organization</TableHead>
                    <TableHead>Reg. Number / Tax ID</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Country</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Registered</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredVendors.map((vendor) => (
                    <TableRow key={vendor.id}>
                      <TableCell>
                        <div className="font-semibold text-neutral-900 dark:text-neutral-100">
                          {vendor.legalName}
                        </div>
                        {vendor.tradeName && (
                          <div className="text-xs text-neutral-500">
                            DBA: {vendor.tradeName}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="font-mono text-xs">
                          {vendor.registrationNumber}
                        </div>
                        <div className="text-xs text-neutral-400">
                          Tax: {vendor.taxIdentifier}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs font-medium px-2 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800">
                          {vendor.organizationType}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="font-semibold text-xs">
                          {vendor.country}
                        </span>
                      </TableCell>
                      <TableCell>{getStatusBadge(vendor.status)}</TableCell>
                      <TableCell className="text-xs text-neutral-500">
                        {new Date(vendor.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right space-x-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedVendorId(vendor.id)}
                          title="View Profile Details"
                        >
                          <Eye className="h-4 w-4 text-neutral-600 dark:text-neutral-300" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setKybVendor(vendor);
                            setKybNotes("");
                            setKybDecision("APPROVED");
                          }}
                          title="Perform KYB Verification"
                        >
                          <ShieldCheck className="h-4 w-4 text-emerald-600" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setStatusVendor(vendor);
                            setNewStatus(
                              vendor.status === "SUSPENDED"
                                ? "VERIFIED"
                                : "SUSPENDED",
                            );
                            setStatusReason("");
                          }}
                          title="Change Operational Status"
                        >
                          <Ban className="h-4 w-4 text-rose-500" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* TAB 2: PENDING KYB QUEUE */}
      {activeTab === "verifications" && (
        <Card className="border-neutral-200 dark:border-neutral-800">
          <CardHeader>
            <CardTitle>Pending KYB Verification Queue</CardTitle>
            <CardDescription>
              Review business registration certificates, tax identifiers, and
              compliance dossiers.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {isLoadingVerifications ? (
              <div className="flex h-48 items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-neutral-400" />
              </div>
            ) : pendingVerifications.length === 0 ? (
              <div className="p-12 text-center text-neutral-500">
                <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500 mb-2" />
                <p className="font-medium">
                  No pending KYB verifications in queue!
                </p>
                <p className="text-xs text-neutral-400 mt-1">
                  All submitted business profiles have been reviewed.
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Verification ID</TableHead>
                    <TableHead>Vendor ID</TableHead>
                    <TableHead>Workflow</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead className="text-right">Review Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingVerifications.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-mono text-xs">
                        {item.id.slice(0, 8)}...
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {item.vendorId}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{item.workflowType}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className="bg-amber-500 text-white">
                          {item.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-neutral-500">
                        {new Date(item.submittedAt).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          onClick={() => {
                            setSelectedVendorId(item.vendorId);
                          }}
                        >
                          Review Dossier{" "}
                          <ArrowRight className="ml-1 h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* VENDOR DETAILS SHEET */}
      <Sheet
        open={!!selectedVendorId}
        onOpenChange={(open) => !open && setSelectedVendorId(null)}
      >
        <SheetContent className="sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-indigo-600" />
              Vendor Entity Profile
            </SheetTitle>
            <SheetDescription>
              Legal organization record, compliance documents, and authorization
              structure.
            </SheetDescription>
          </SheetHeader>

          {isLoadingDetails ? (
            <div className="flex h-64 items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-neutral-400" />
            </div>
          ) : selectedVendorDetails ? (
            <div className="space-y-6 pt-6">
              {/* Status Header */}
              <div className="flex items-center justify-between p-3 rounded-lg bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
                <div>
                  <div className="text-xs text-neutral-500">Current Status</div>
                  <div className="mt-1">
                    {getStatusBadge(selectedVendorDetails.status)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-neutral-500">
                    Organization Type
                  </div>
                  <div className="text-sm font-semibold mt-1">
                    {selectedVendorDetails.organizationType}
                  </div>
                </div>
              </div>

              {/* Legal Information */}
              <div className="space-y-2">
                <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-1.5">
                  <FileText className="h-4 w-4 text-neutral-500" />
                  Legal Identity
                </h3>
                <div className="grid grid-cols-2 gap-2 text-xs p-3 rounded bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
                  <div>
                    <span className="text-neutral-400">Legal Name:</span>
                    <p className="font-semibold">
                      {selectedVendorDetails.legalName}
                    </p>
                  </div>
                  <div>
                    <span className="text-neutral-400">Trade Name (DBA):</span>
                    <p className="font-semibold">
                      {selectedVendorDetails.tradeName || "None"}
                    </p>
                  </div>
                  <div>
                    <span className="text-neutral-400">Registration #:</span>
                    <p className="font-mono font-semibold">
                      {selectedVendorDetails.registrationNumber}
                    </p>
                  </div>
                  <div>
                    <span className="text-neutral-400">Tax Identifier:</span>
                    <p className="font-mono font-semibold">
                      {selectedVendorDetails.taxIdentifier}
                    </p>
                  </div>
                  <div>
                    <span className="text-neutral-400">
                      Country of Registration:
                    </span>
                    <p className="font-semibold">
                      {selectedVendorDetails.country}
                    </p>
                  </div>
                  <div>
                    <span className="text-neutral-400">Clerk Owner ID:</span>
                    <p className="font-mono">
                      {selectedVendorDetails.ownerUserId}
                    </p>
                  </div>
                </div>
              </div>

              {/* Business Profile Details */}
              {selectedVendorDetails.businessProfile && (
                <div className="space-y-2">
                  <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
                    Business Profile & Representative
                  </h3>
                  <div className="space-y-1.5 text-xs p-3 rounded bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <span className="text-neutral-400">Industry:</span>
                        <p className="font-semibold">
                          {
                            selectedVendorDetails.businessProfile
                              .industryCategory
                          }
                        </p>
                      </div>
                      <div>
                        <span className="text-neutral-400">Website:</span>
                        <p className="font-semibold truncate">
                          {selectedVendorDetails.businessProfile.websiteUrl ||
                            "N/A"}
                        </p>
                      </div>
                      <div>
                        <span className="text-neutral-400">
                          Business Email:
                        </span>
                        <p className="font-semibold">
                          {selectedVendorDetails.businessProfile.businessEmail}
                        </p>
                      </div>
                      <div>
                        <span className="text-neutral-400">
                          Business Phone:
                        </span>
                        <p className="font-semibold">
                          {selectedVendorDetails.businessProfile.businessPhone}
                        </p>
                      </div>
                    </div>
                    <div className="pt-2 border-t border-neutral-200 dark:border-neutral-800">
                      <span className="text-neutral-400">
                        Registered Office Address:
                      </span>
                      <p className="font-medium">
                        {
                          selectedVendorDetails.businessProfile
                            .registeredAddressLine1
                        }
                        , {selectedVendorDetails.businessProfile.city},{" "}
                        {selectedVendorDetails.businessProfile.state}{" "}
                        {selectedVendorDetails.businessProfile.postalCode},{" "}
                        {selectedVendorDetails.businessProfile.country}
                      </p>
                    </div>
                    <div className="pt-2 border-t border-neutral-200 dark:border-neutral-800">
                      <span className="text-neutral-400">
                        Authorized Representative:
                      </span>
                      <p className="font-semibold">
                        {
                          selectedVendorDetails.businessProfile
                            .authorizedRepresentativeName
                        }{" "}
                        (
                        {
                          selectedVendorDetails.businessProfile
                            .authorizedRepresentativeRole
                        }
                        )
                      </p>
                      <p className="text-neutral-500">
                        {
                          selectedVendorDetails.businessProfile
                            .authorizedRepresentativeEmail
                        }{" "}
                        •{" "}
                        {
                          selectedVendorDetails.businessProfile
                            .authorizedRepresentativePhone
                        }
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Compliance Documents */}
              <div className="space-y-2">
                <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100 flex items-center justify-between">
                  <span>
                    Compliance Documents (
                    {selectedVendorDetails.documents?.length || 0})
                  </span>
                </h3>
                {selectedVendorDetails.documents &&
                selectedVendorDetails.documents.length > 0 ? (
                  <div className="space-y-2">
                    {selectedVendorDetails.documents.map((doc) => (
                      <div
                        key={doc.id}
                        className="flex items-center justify-between p-2.5 rounded border border-neutral-200 dark:border-neutral-800 text-xs"
                      >
                        <div>
                          <div className="font-semibold">
                            {doc.documentType.replace(/_/g, " ")}
                          </div>
                          <div className="text-neutral-500">
                            {doc.fileName} • {(doc.fileSize / 1024).toFixed(1)}{" "}
                            KB
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge
                            className={
                              doc.verificationStatus === "ACCEPTED"
                                ? "bg-emerald-600 text-white"
                                : doc.verificationStatus === "REJECTED"
                                  ? "bg-rose-600 text-white"
                                  : "bg-amber-500 text-white"
                            }
                          >
                            {doc.verificationStatus}
                          </Badge>
                          {doc.verificationStatus === "PENDING" && (
                            <div className="flex items-center gap-1">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 px-2 text-emerald-600"
                                onClick={() =>
                                  verifyDocMutation.mutate({
                                    vendorId: selectedVendorDetails.id,
                                    docId: doc.id,
                                    status: "ACCEPTED",
                                  })
                                }
                              >
                                Accept
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 px-2 text-rose-600"
                                onClick={() =>
                                  verifyDocMutation.mutate({
                                    vendorId: selectedVendorDetails.id,
                                    docId: doc.id,
                                    status: "REJECTED",
                                    rejectionReason:
                                      "Incomplete or unreadable document",
                                  })
                                }
                              >
                                Reject
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-neutral-400 italic">
                    No documents uploaded yet.
                  </p>
                )}
              </div>

              {/* Quick Actions */}
              <div className="flex gap-2 pt-4 border-t border-neutral-200 dark:border-neutral-800">
                <Button
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={() => {
                    setKybVendor(selectedVendorDetails);
                    setKybDecision("APPROVED");
                    setKybNotes("");
                  }}
                >
                  <ShieldCheck className="mr-1.5 h-4 w-4" />
                  Approve KYB
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1"
                  onClick={() => {
                    setKybVendor(selectedVendorDetails);
                    setKybDecision("REJECTED");
                    setKybNotes("");
                  }}
                >
                  <XCircle className="mr-1.5 h-4 w-4" />
                  Reject KYB
                </Button>
              </div>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>

      {/* KYB VERIFICATION DECISION DIALOG / SHEET */}
      <Sheet
        open={!!kybVendor}
        onOpenChange={(open) => !open && setKybVendor(null)}
      >
        <SheetContent className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle>
              {kybDecision === "APPROVED" ? "Approve" : "Reject"} Vendor KYB
            </SheetTitle>
            <SheetDescription>
              Review compliance verification for{" "}
              <span className="font-semibold">{kybVendor?.legalName}</span>.
            </SheetDescription>
          </SheetHeader>
          <div className="space-y-4 pt-4">
            <div>
              <label className="text-xs font-medium text-neutral-600 dark:text-neutral-400">
                Decision
              </label>
              <div className="grid grid-cols-2 gap-2 mt-1">
                <Button
                  type="button"
                  variant={kybDecision === "APPROVED" ? "default" : "outline"}
                  onClick={() => setKybDecision("APPROVED")}
                  className={kybDecision === "APPROVED" ? "bg-emerald-600" : ""}
                >
                  <CheckCircle2 className="mr-1.5 h-4 w-4" />
                  Approve
                </Button>
                <Button
                  type="button"
                  variant={
                    kybDecision === "REJECTED" ? "destructive" : "outline"
                  }
                  onClick={() => setKybDecision("REJECTED")}
                >
                  <XCircle className="mr-1.5 h-4 w-4" />
                  Reject
                </Button>
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-neutral-600 dark:text-neutral-400">
                Compliance Review Notes
              </label>
              <Input
                placeholder={
                  kybDecision === "APPROVED"
                    ? "Verified against state business registry"
                    : "Tax ID mismatch or blurry certificate"
                }
                value={kybNotes}
                onChange={(e) => setKybNotes(e.target.value)}
                className="mt-1"
              />
            </div>

            <Button
              className="w-full mt-4"
              disabled={verifyMutation.isPending}
              onClick={() => {
                if (!kybVendor) return;
                verifyMutation.mutate({
                  id: kybVendor.id,
                  status: kybDecision,
                  notes: kybNotes || "Review complete",
                });
              }}
            >
              {verifyMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Confirm {kybDecision}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* STATUS CHANGE SHEET */}
      <Sheet
        open={!!statusVendor}
        onOpenChange={(open) => !open && setStatusVendor(null)}
      >
        <SheetContent className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Update Operational Status</SheetTitle>
            <SheetDescription>
              Change status for{" "}
              <span className="font-semibold">{statusVendor?.legalName}</span>.
            </SheetDescription>
          </SheetHeader>
          <div className="space-y-4 pt-4">
            <div>
              <label className="text-xs font-medium text-neutral-600 dark:text-neutral-400">
                Select Target Status
              </label>
              <div className="grid grid-cols-3 gap-2 mt-1">
                {(
                  ["VERIFIED", "SUSPENDED", "TERMINATED"] as VendorStatus[]
                ).map((st) => (
                  <Button
                    key={st}
                    type="button"
                    variant={newStatus === st ? "default" : "outline"}
                    size="sm"
                    onClick={() => setNewStatus(st)}
                  >
                    {st}
                  </Button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-neutral-600 dark:text-neutral-400">
                Reason for change (Required)
              </label>
              <Input
                placeholder="e.g. Compliance audit failure, Merchant requested reinstatement"
                value={statusReason}
                onChange={(e) => setStatusReason(e.target.value)}
                className="mt-1"
              />
            </div>

            <Button
              className="w-full mt-4"
              disabled={!statusReason.trim() || statusMutation.isPending}
              onClick={() => {
                if (!statusVendor) return;
                statusMutation.mutate({
                  id: statusVendor.id,
                  status: newStatus,
                  reason: statusReason,
                });
              }}
            >
              {statusMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Apply Status Change
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
