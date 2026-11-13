"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/nextjs";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
} from "@tanstack/react-table";
import {
  Building2,
  CheckCircle2,
  XCircle,
  Clock,
  Eye,
  FileText,
  Loader2,
  RefreshCw,
  Search,
  ExternalLink,
  ShieldCheck,
  ShieldX,
  AlertTriangle,
} from "lucide-react";
import { toast } from "react-toastify";

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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { DataTablePagination } from "@/components/TablePagination";
import { getApiGatewayUrl } from "@/services/gateway.service";
import {
  getPendingVendors,
  getVendorDocuments,
  verifyVendor,
  rejectVendor,
  fetchVerificationStats,
  type PendingVendorItem,
  type PendingVendorDocument,
} from "@/services/vendor-verification.service";

export default function VendorVerificationPage() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedVendor, setSelectedVendor] = useState<PendingVendorItem | null>(
    null,
  );
  const [lightboxImage, setLightboxImage] = useState<{
    url: string;
    title: string;
  } | null>(null);

  // Verification form state in Sheet
  const [decision, setDecision] = useState<"VERIFY" | "REJECT">("VERIFY");
  const [reason, setReason] = useState("");

  // Quick reject modal/state
  const [quickRejectVendor, setQuickRejectVendor] =
    useState<PendingVendorItem | null>(null);
  const [quickRejectReason, setQuickRejectReason] = useState("");

  // TanStack Queries
  const {
    data: vendorsData,
    isLoading: isLoadingVendors,
    refetch: refetchVendors,
    isRefetching,
  } = useQuery({
    queryKey: ["pending-vendors", searchQuery],
    queryFn: async () => {
      const token = await getToken();
      return getPendingVendors(token, { search: searchQuery || undefined });
    },
  });

  const { data: statsData, refetch: refetchStats } = useQuery({
    queryKey: ["vendor-verification-stats"],
    queryFn: async () => {
      const token = await getToken();
      return fetchVerificationStats(token);
    },
  });

  const { data: vendorDocs, isLoading: isLoadingDocs } = useQuery({
    queryKey: ["vendor-documents", selectedVendor?.id],
    queryFn: async () => {
      if (!selectedVendor?.id) return [];
      const token = await getToken();
      return getVendorDocuments(selectedVendor.id, token);
    },
    enabled: !!selectedVendor?.id,
  });

  // TanStack Mutations
  const verifyMutation = useMutation({
    mutationFn: async ({
      vendorId,
      reason,
    }: {
      vendorId: string;
      reason?: string;
    }) => {
      const token = await getToken();
      return verifyVendor(vendorId, { reason }, token);
    },
    onSuccess: () => {
      toast.success("Vendor has been successfully verified & approved!");
      setSelectedVendor(null);
      setReason("");
      queryClient.invalidateQueries({ queryKey: ["pending-vendors"] });
      queryClient.invalidateQueries({ queryKey: ["vendor-verification-stats"] });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to verify vendor");
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({
      vendorId,
      reason,
    }: {
      vendorId: string;
      reason: string;
    }) => {
      const token = await getToken();
      return rejectVendor(vendorId, { reason }, token);
    },
    onSuccess: () => {
      toast.success("Vendor application has been rejected.");
      setSelectedVendor(null);
      setQuickRejectVendor(null);
      setReason("");
      setQuickRejectReason("");
      queryClient.invalidateQueries({ queryKey: ["pending-vendors"] });
      queryClient.invalidateQueries({ queryKey: ["vendor-verification-stats"] });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to reject vendor");
    },
  });

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVendor) return;

    if (decision === "REJECT" && !reason.trim()) {
      toast.error("Rejection reason is mandatory when declining verification.");
      return;
    }

    if (decision === "VERIFY") {
      verifyMutation.mutate({
        vendorId: selectedVendor.id,
        reason: reason.trim() || undefined,
      });
    } else {
      rejectMutation.mutate({
        vendorId: selectedVendor.id,
        reason: reason.trim(),
      });
    }
  };

  const handleQuickApprove = (vendor: PendingVendorItem) => {
    verifyMutation.mutate({
      vendorId: vendor.id,
      reason: "Quick approved via verification dashboard",
    });
  };

  const handleQuickRejectSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickRejectVendor) return;
    if (!quickRejectReason.trim()) {
      toast.error("Rejection reason is required");
      return;
    }
    rejectMutation.mutate({
      vendorId: quickRejectVendor.id,
      reason: quickRejectReason.trim(),
    });
  };

  const allVendors = vendorsData?.vendors || [];
  const pendingCount = statsData?.pendingCount ?? allVendors.length;
  const verifiedThisWeek = statsData?.verifiedThisWeek ?? 0;
  const rejectedThisWeek = statsData?.rejectedThisWeek ?? 0;

  // TanStack Table columns definition
  const [sorting, setSorting] = useState<SortingState>([]);
  const columns: ColumnDef<PendingVendorItem>[] = [
    {
      accessorKey: "legalName",
      header: "Business Name",
      cell: ({ row }) => {
        const item = row.original;
        return (
          <div>
            <div className="font-semibold text-neutral-900 dark:text-neutral-100 flex items-center gap-1.5">
              <Building2 className="h-4 w-4 text-indigo-500" />
              {item.legalName}
            </div>
            {item.tradeName && (
              <div className="text-xs text-neutral-500">DBA: {item.tradeName}</div>
            )}
            <div className="text-xs text-neutral-400 font-mono mt-0.5">
              Reg: {item.registrationNumber} • {item.country}
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "ownerUserId",
      header: "Owner",
      cell: ({ row }) => {
        const item = row.original;
        return (
          <div className="text-xs">
            <span className="font-mono text-neutral-600 dark:text-neutral-300">
              {item.ownerUserId.slice(0, 14)}...
            </span>
            {item.businessProfile?.businessEmail && (
              <div className="text-neutral-400">
                {item.businessProfile.businessEmail}
              </div>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: "createdAt",
      header: "Submission Date",
      cell: ({ row }) => {
        const date = new Date(row.original.createdAt);
        return (
          <div className="text-xs text-neutral-600 dark:text-neutral-300">
            <div>{date.toLocaleDateString()}</div>
            <div className="text-neutral-400 text-[11px]">
              {date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </div>
          </div>
        );
      },
    },
    {
      id: "documents",
      header: "Documents",
      cell: ({ row }) => {
        const docs = row.original.documents || [];
        return (
          <div className="flex items-center gap-1 text-xs">
            <Badge variant="outline" className="text-xs font-mono">
              <FileText className="mr-1 h-3 w-3 text-neutral-500" />
              {docs.length} Doc{docs.length === 1 ? "" : "s"}
            </Badge>
          </div>
        );
      },
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        return (
          <Badge className="bg-amber-500 hover:bg-amber-600 text-white font-medium">
            <Clock className="mr-1 h-3 w-3" />
            {row.original.status.replace("_", " ")}
          </Badge>
        );
      },
    },
    {
      id: "actions",
      header: () => <div className="text-right">Actions</div>,
      cell: ({ row }) => {
        const vendor = row.original;
        return (
          <div className="flex items-center justify-end gap-1.5">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSelectedVendor(vendor);
                setDecision("VERIFY");
                setReason("");
              }}
              className="h-8 px-2.5 text-xs font-medium"
            >
              <Eye className="mr-1 h-3.5 w-3.5 text-neutral-500" />
              Review
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleQuickApprove(vendor)}
              disabled={verifyMutation.isPending}
              className="h-8 px-2 text-xs font-medium border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
              title="Quick Approve without opening sheet"
            >
              <CheckCircle2 className="mr-1 h-3.5 w-3.5 text-emerald-600" />
              Quick Approve
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setQuickRejectVendor(vendor);
                setQuickRejectReason("");
              }}
              disabled={rejectMutation.isPending}
              className="h-8 px-2 text-xs font-medium border-rose-500/30 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40"
              title="Quick Reject with mandatory note"
            >
              <XCircle className="mr-1 h-3.5 w-3.5 text-rose-600" />
              Quick Reject
            </Button>
          </div>
        );
      },
    },
  ];

  const table = useReactTable({
    data: allVendors,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: setSorting,
    state: {
      sorting,
    },
  });

  const getMediaUrl = (mediaFileId: string) => {
    const apiBase = getApiGatewayUrl();
    return `${apiBase}/api/v1/media/${mediaFileId}`;
  };

  const isImageMime = (mimeType?: string, fileName?: string) => {
    if (mimeType?.startsWith("image/")) return true;
    if (fileName?.match(/\.(jpg|jpeg|png|webp|gif|svg)$/i)) return true;
    return false;
  };

  return (
    <div className="space-y-6 pb-12 pt-4">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100 flex items-center gap-2.5">
            <ShieldCheck className="h-7 w-7 text-indigo-600 dark:text-indigo-400" />
            Seller & Vendor KYB Verification
          </h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            Authoritative merchant onboarding verification queue, business compliance review, and document validation.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              refetchVendors();
              refetchStats();
            }}
            disabled={isRefetching}
          >
            <RefreshCw
              className={`mr-2 h-4 w-4 ${isRefetching ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-neutral-200 dark:border-neutral-800 bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-neutral-600 dark:text-neutral-400">
              Pending Review
            </CardTitle>
            <Clock className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-amber-600 dark:text-amber-400">
              {pendingCount}
            </div>
            <p className="text-xs text-neutral-500 mt-1">
              Vendors requiring compliance sign-off
            </p>
          </CardContent>
        </Card>

        <Card className="border-neutral-200 dark:border-neutral-800 bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-neutral-600 dark:text-neutral-400">
              Verified This Week
            </CardTitle>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">
              {verifiedThisWeek}
            </div>
            <p className="text-xs text-neutral-500 mt-1">
              Approved businesses in the last 7 days
            </p>
          </CardContent>
        </Card>

        <Card className="border-neutral-200 dark:border-neutral-800 bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-neutral-600 dark:text-neutral-400">
              Rejected This Week
            </CardTitle>
            <XCircle className="h-4 w-4 text-rose-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-rose-600 dark:text-rose-400">
              {rejectedThisWeek}
            </div>
            <p className="text-xs text-neutral-500 mt-1">
              Incomplete or unverified applications
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Data Table */}
      <Card className="border-neutral-200 dark:border-neutral-800">
        <CardHeader className="p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-neutral-500" />
              <Input
                placeholder="Search pending vendors by name, reg #..."
                className="pl-8"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="text-xs text-neutral-500">
              Showing {allVendors.length} application(s) awaiting review
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoadingVendors ? (
            <div className="flex h-48 items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-neutral-400" />
            </div>
          ) : allVendors.length === 0 ? (
            <div className="p-12 text-center text-neutral-500 dark:text-neutral-400">
              <ShieldCheck className="mx-auto h-12 w-12 text-emerald-500 mb-2" />
              <p className="font-semibold text-neutral-800 dark:text-neutral-200">
                All caught up!
              </p>
              <p className="text-xs text-neutral-500 mt-1">
                There are no pending vendor KYB applications awaiting review.
              </p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  {table.getHeaderGroups().map((headerGroup) => (
                    <TableRow key={headerGroup.id}>
                      {headerGroup.headers.map((header) => (
                        <TableHead key={header.id}>
                          {header.isPlaceholder
                            ? null
                            : flexRender(
                                header.column.columnDef.header,
                                header.getContext(),
                              )}
                        </TableHead>
                      ))}
                    </TableRow>
                  ))}
                </TableHeader>
                <TableBody>
                  {table.getRowModel().rows.map((row) => (
                    <TableRow key={row.id}>
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id}>
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext(),
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <DataTablePagination table={table} />
            </>
          )}
        </CardContent>
      </Card>

      {/* Review & Detail Side Sheet */}
      <Sheet
        open={!!selectedVendor}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedVendor(null);
            setReason("");
          }
        }}
      >
        <SheetContent className="sm:max-w-xl overflow-y-auto w-full">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-indigo-600" />
              KYB Verification Review
            </SheetTitle>
            <SheetDescription>
              Inspect legal identity documents, company registration details, and make an official verification determination.
            </SheetDescription>
          </SheetHeader>

          {selectedVendor && (
            <div className="space-y-6 pt-6">
              {/* Profile Card */}
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-1.5">
                  <Building2 className="h-4 w-4 text-neutral-500" />
                  Vendor Profile
                </h3>
                <div className="grid grid-cols-2 gap-3 text-xs p-4 rounded-lg bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
                  <div>
                    <span className="text-neutral-400">Legal Business Name:</span>
                    <p className="font-semibold text-neutral-900 dark:text-neutral-100">
                      {selectedVendor.legalName}
                    </p>
                  </div>
                  <div>
                    <span className="text-neutral-400">Trade Name / DBA:</span>
                    <p className="font-semibold text-neutral-900 dark:text-neutral-100">
                      {selectedVendor.tradeName || "None"}
                    </p>
                  </div>
                  <div>
                    <span className="text-neutral-400">Registration Number:</span>
                    <p className="font-mono font-semibold text-neutral-900 dark:text-neutral-100">
                      {selectedVendor.registrationNumber}
                    </p>
                  </div>
                  <div>
                    <span className="text-neutral-400">Tax Identifier:</span>
                    <p className="font-mono font-semibold text-neutral-900 dark:text-neutral-100">
                      {selectedVendor.taxIdentifier}
                    </p>
                  </div>
                  <div>
                    <span className="text-neutral-400">Country:</span>
                    <p className="font-semibold text-neutral-900 dark:text-neutral-100">
                      {selectedVendor.country}
                    </p>
                  </div>
                  <div>
                    <span className="text-neutral-400">Organization Type:</span>
                    <p className="font-semibold text-neutral-900 dark:text-neutral-100">
                      {selectedVendor.organizationType}
                    </p>
                  </div>
                  <div>
                    <span className="text-neutral-400">Owner User ID:</span>
                    <p className="font-mono truncate text-neutral-900 dark:text-neutral-100">
                      {selectedVendor.ownerUserId}
                    </p>
                  </div>
                  <div>
                    <span className="text-neutral-400">Contact Email:</span>
                    <p className="font-semibold truncate text-neutral-900 dark:text-neutral-100">
                      {selectedVendor.businessProfile?.businessEmail || "N/A"}
                    </p>
                  </div>
                  {selectedVendor.businessProfile?.businessPhone && (
                    <div className="col-span-2">
                      <span className="text-neutral-400">Phone:</span>
                      <p className="font-semibold text-neutral-900 dark:text-neutral-100">
                        {selectedVendor.businessProfile.businessPhone}
                      </p>
                    </div>
                  )}
                  {selectedVendor.businessProfile?.registeredAddressLine1 && (
                    <div className="col-span-2 border-t border-neutral-200 dark:border-neutral-800 pt-2">
                      <span className="text-neutral-400">Registered Office Address:</span>
                      <p className="font-medium text-neutral-900 dark:text-neutral-100">
                        {selectedVendor.businessProfile.registeredAddressLine1},{" "}
                        {selectedVendor.businessProfile.city},{" "}
                        {selectedVendor.businessProfile.state}{" "}
                        {selectedVendor.businessProfile.postalCode}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Document List */}
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <FileText className="h-4 w-4 text-neutral-500" />
                    Uploaded Compliance Documents
                  </span>
                  <span className="text-xs font-normal text-neutral-400">
                    Click image to expand
                  </span>
                </h3>

                {isLoadingDocs ? (
                  <div className="flex h-24 items-center justify-center">
                    <Loader2 className="h-6 w-6 animate-spin text-neutral-400" />
                  </div>
                ) : (vendorDocs || selectedVendor.documents || []).length === 0 ? (
                  <div className="p-4 rounded-lg border border-dashed border-neutral-200 dark:border-neutral-800 text-center text-xs text-neutral-500">
                    No documents attached to this application.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {(vendorDocs || selectedVendor.documents || []).map(
                      (doc: PendingVendorDocument) => {
                        const isImg = isImageMime(doc.mimeType, doc.fileName);
                        const downloadUrl = getMediaUrl(doc.mediaFileId);

                        return (
                          <div
                            key={doc.id}
                            className="flex items-center justify-between p-3 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900"
                          >
                            <div className="space-y-0.5">
                              <div className="font-semibold text-xs text-neutral-900 dark:text-neutral-100">
                                {doc.documentType.replace(/_/g, " ")}
                              </div>
                              <div className="text-[11px] text-neutral-500 font-mono">
                                {doc.fileName} • {(doc.fileSize / 1024).toFixed(1)} KB
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {isImg ? (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 text-xs"
                                  onClick={() =>
                                    setLightboxImage({
                                      url: downloadUrl,
                                      title: doc.fileName,
                                    })
                                  }
                                >
                                  <Eye className="mr-1 h-3 w-3" />
                                  Preview
                                </Button>
                              ) : (
                                <a
                                  href={downloadUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center justify-center h-7 px-2.5 text-xs font-medium border border-input rounded-md bg-background hover:bg-accent hover:text-accent-foreground"
                                >
                                  <ExternalLink className="mr-1 h-3 w-3" />
                                  Open
                                </a>
                              )}
                              <Badge
                                variant={
                                  doc.verificationStatus === "ACCEPTED"
                                    ? "default"
                                    : "secondary"
                                }
                                className="text-[10px]"
                              >
                                {doc.verificationStatus}
                              </Badge>
                            </div>
                          </div>
                        );
                      },
                    )}
                  </div>
                )}
              </div>

              {/* Approval Form */}
              <form onSubmit={handleFormSubmit} className="space-y-4 pt-4 border-t border-neutral-200 dark:border-neutral-800">
                <div className="space-y-2">
                  <Label className="text-xs font-semibold">Verification Determination</Label>
                  <div className="flex items-center gap-6">
                    <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                      <input
                        type="radio"
                        name="decision"
                        value="VERIFY"
                        checked={decision === "VERIFY"}
                        onChange={() => setDecision("VERIFY")}
                        className="text-emerald-600 focus:ring-emerald-500"
                      />
                      <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2 className="h-4 w-4" />
                        Verify & Approve (KYB Cleared)
                      </span>
                    </label>
                    <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                      <input
                        type="radio"
                        name="decision"
                        value="REJECT"
                        checked={decision === "REJECT"}
                        onChange={() => setDecision("REJECT")}
                        className="text-rose-600 focus:ring-rose-500"
                      />
                      <span className="flex items-center gap-1 text-rose-600 dark:text-rose-400">
                        <XCircle className="h-4 w-4" />
                        Reject Application
                      </span>
                    </label>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="review-reason" className="text-xs font-semibold">
                      {decision === "REJECT" ? "Rejection Reason (Required)" : "Audit Review Notes (Optional)"}
                    </Label>
                    {decision === "REJECT" && (
                      <span className="text-[10px] text-rose-500 font-medium">Mandatory</span>
                    )}
                  </div>
                  <Textarea
                    id="review-reason"
                    rows={3}
                    placeholder={
                      decision === "REJECT"
                        ? "State reasons for rejection (e.g. illegible certificate, expired tax document)..."
                        : "Optional reviewer notes for compliance audit log..."
                    }
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="text-xs"
                    required={decision === "REJECT"}
                  />
                </div>

                <Button
                  type="submit"
                  disabled={
                    verifyMutation.isPending ||
                    rejectMutation.isPending ||
                    (decision === "REJECT" && !reason.trim())
                  }
                  className={`w-full ${
                    decision === "VERIFY"
                      ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                      : "bg-rose-600 hover:bg-rose-700 text-white"
                  }`}
                >
                  {(verifyMutation.isPending || rejectMutation.isPending) && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  {decision === "VERIFY"
                    ? "Confirm KYB Approval"
                    : "Confirm Application Rejection"}
                </Button>
              </form>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Quick Reject Dialog / Modal */}
      {quickRejectVendor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-xl bg-background p-6 shadow-xl border border-neutral-200 dark:border-neutral-800 space-y-4">
            <div className="flex items-center gap-2 text-rose-600">
              <ShieldX className="h-5 w-5" />
              <h3 className="font-bold text-base">Quick Reject Vendor Application</h3>
            </div>
            <p className="text-xs text-neutral-500">
              Are you sure you want to reject <strong>{quickRejectVendor.legalName}</strong>? Please provide an official rejection reason.
            </p>
            <form onSubmit={handleQuickRejectSubmit} className="space-y-4">
              <Textarea
                placeholder="Enter mandatory rejection reason..."
                rows={3}
                value={quickRejectReason}
                onChange={(e) => setQuickRejectReason(e.target.value)}
                className="text-xs"
                required
                autoFocus
              />
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setQuickRejectVendor(null)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="destructive"
                  size="sm"
                  disabled={rejectMutation.isPending || !quickRejectReason.trim()}
                >
                  {rejectMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Confirm Rejection
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Lightbox for document image preview */}
      {lightboxImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 cursor-pointer"
          onClick={() => setLightboxImage(null)}
        >
          <div
            className="relative max-w-3xl max-h-[90vh] bg-neutral-900 rounded-lg p-2 overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-2 border-b border-neutral-800 text-white text-xs">
              <span className="font-semibold truncate">{lightboxImage.title}</span>
              <Button
                variant="ghost"
                size="sm"
                className="text-neutral-400 hover:text-white h-6 px-2"
                onClick={() => setLightboxImage(null)}
              >
                Close ✕
              </Button>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={lightboxImage.url}
              alt={lightboxImage.title}
              className="max-h-[80vh] w-auto mx-auto object-contain rounded mt-2"
            />
          </div>
        </div>
      )}
    </div>
  );
}
