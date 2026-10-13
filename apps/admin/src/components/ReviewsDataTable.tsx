"use client";

import { useState } from "react";
import {
  AdminReviewItem,
  AdminReviewReportItem,
  AdminProductRatingSummaryItem,
  moderateReview,
  recalculateReviewSummaries,
} from "@/services/review.service";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import {
  Star,
  CheckCircle,
  XCircle,
  Flag,
  ShieldCheck,
  Search,
  RefreshCw,
  AlertOctagon,
} from "lucide-react";
import { toast } from "react-toastify";
import Image from "next/image";

interface ReviewsDataTableProps {
  initialReviews: AdminReviewItem[];
  initialReports: AdminReviewReportItem[];
  initialSummaries: AdminProductRatingSummaryItem[];
  token: string;
  onRefresh: () => void;
}

export default function ReviewsDataTable({
  initialReviews,
  initialReports,
  initialSummaries,
  token,
  onRefresh,
}: ReviewsDataTableProps) {
  const [activeTab, setActiveTab] = useState<
    "queue" | "reports" | "summaries"
  >("queue");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState<string | null>(null);

  // Rejection modal state
  const [rejectingReviewId, setRejectingReviewId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string>("");

  // Media preview modal state
  const [previewMediaUrl, setPreviewMediaUrl] = useState<string | null>(null);

  // Recalculating single summary
  const [recalculatingProductId, setRecalculatingProductId] = useState<string | null>(null);

  // Filter reviews
  const filteredReviews = initialReviews.filter((r) => {
    const matchesStatus =
      statusFilter === "ALL" ? true : r.status === statusFilter;
    const matchesSearch =
      searchQuery.trim() === ""
        ? true
        : r.productId.toLowerCase().includes(searchQuery.toLowerCase()) ||
          r.userId.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (r.title && r.title.toLowerCase().includes(searchQuery.toLowerCase())) ||
          r.content.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  // Handle Moderation Action
  const handleModerate = async (
    reviewId: string,
    action: "APPROVE" | "REJECT" | "FLAG" | "ANONYMIZE",
    reason: string = "Approved by moderator",
  ) => {
    setIsProcessing(reviewId);
    try {
      const res = await moderateReview(reviewId, action, reason, token);
      if (res.success) {
        toast.success(`Review ${action.toLowerCase()}d successfully`);
        onRefresh();
      } else {
        toast.error(res.message || `Failed to ${action.toLowerCase()} review`);
      }
    } catch {
      toast.error("An unexpected error occurred during moderation");
    } finally {
      setIsProcessing(null);
      setRejectingReviewId(null);
      setRejectionReason("");
    }
  };

  // Handle single product recalculation
  const handleRecalculateProduct = async (productId: string) => {
    setRecalculatingProductId(productId);
    try {
      const res = await recalculateReviewSummaries(token, productId);
      if (res.success) {
        toast.success("Product rating summary updated");
        onRefresh();
      } else {
        toast.error(res.message || "Failed to update summary");
      }
    } catch {
      toast.error("Error recalculating summary");
    } finally {
      setRecalculatingProductId(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "APPROVED":
        return (
          <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800">
            Approved
          </Badge>
        );
      case "PENDING":
        return (
          <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-300 dark:border-amber-800">
            Pending
          </Badge>
        );
      case "REJECTED":
        return (
          <Badge className="bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border-rose-300 dark:border-rose-800">
            Rejected
          </Badge>
        );
      case "FLAGGED":
        return (
          <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 border-purple-300 dark:border-purple-800">
            Flagged
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-border pb-2">
        <button
          type="button"
          onClick={() => setActiveTab("queue")}
          className={`px-4 py-2 text-sm font-semibold rounded-md transition-all flex items-center gap-2 ${
            activeTab === "queue"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
        >
          <Star className="h-4 w-4" />
          Moderation Queue ({initialReviews.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("reports")}
          className={`px-4 py-2 text-sm font-semibold rounded-md transition-all flex items-center gap-2 ${
            activeTab === "reports"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
        >
          <AlertOctagon className="h-4 w-4" />
          Abuse Reports ({initialReports.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("summaries")}
          className={`px-4 py-2 text-sm font-semibold rounded-md transition-all flex items-center gap-2 ${
            activeTab === "summaries"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
        >
          <RefreshCw className="h-4 w-4" />
          Catalog Summaries ({initialSummaries.length})
        </button>
      </div>

      {/* TAB 1: MODERATION QUEUE */}
      {activeTab === "queue" && (
        <div className="space-y-4">
          {/* Controls Bar */}
          <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
            <div className="flex items-center gap-1.5 flex-wrap">
              {["ALL", "PENDING", "APPROVED", "REJECTED", "FLAGGED"].map(
                (st) => (
                  <Button
                    key={st}
                    size="sm"
                    variant={statusFilter === st ? "default" : "outline"}
                    className="text-xs h-8"
                    onClick={() => setStatusFilter(st)}
                  >
                    {st === "ALL"
                      ? "All Statuses"
                      : st.charAt(0) + st.slice(1).toLowerCase()}
                  </Button>
                ),
              )}
            </div>

            <div className="relative w-full md:w-72">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search productId, user, text..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 text-xs h-9"
              />
            </div>
          </div>

          {/* Table Container */}
          <div className="border border-border rounded-lg overflow-x-auto bg-card shadow-sm">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-xs font-semibold text-muted-foreground">
                  <th className="p-3 w-12 text-center">Rating</th>
                  <th className="p-3">Review & Content</th>
                  <th className="p-3">Product / User ID</th>
                  <th className="p-3">Media</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Date</th>
                  <th className="p-3 text-right">Moderation Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredReviews.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-muted-foreground">
                      No reviews found matching your filter criteria.
                    </td>
                  </tr>
                ) : (
                  filteredReviews.map((r) => (
                    <tr
                      key={r.id}
                      className="hover:bg-muted/30 transition-colors"
                    >
                      {/* Rating */}
                      <td className="p-3 text-center align-top">
                        <div className="flex items-center justify-center gap-1 font-bold text-amber-500">
                          <span>{r.rating}</span>
                          <Star className="h-3.5 w-3.5 fill-amber-500" />
                        </div>
                      </td>

                      {/* Review & Content */}
                      <td className="p-3 align-top max-w-sm">
                        <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                          {r.title && (
                            <span className="font-semibold text-foreground text-sm">
                              {r.title}
                            </span>
                          )}
                          {r.isVerifiedPurchase && (
                            <span className="inline-flex items-center gap-0.5 text-[11px] font-medium text-emerald-700 bg-emerald-50 dark:bg-emerald-950/60 dark:text-emerald-300 px-1.5 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                              <ShieldCheck className="h-3 w-3" />
                              Verified Buyer
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-3">
                          {r.content}
                        </p>
                        {r.moderationReason && (
                          <div className="mt-1.5 text-[11px] bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 p-1.5 rounded border border-rose-200 dark:border-rose-900">
                            <strong>Moderation Note:</strong> {r.moderationReason}
                          </div>
                        )}
                        <div className="flex items-center gap-3 mt-2 text-[11px] text-muted-foreground">
                          <span>Helpful: {r.helpfulCount}</span>
                          <span>•</span>
                          <span>Unhelpful: {r.unhelpfulCount}</span>
                        </div>
                      </td>

                      {/* Product / User ID */}
                      <td className="p-3 align-top text-xs text-muted-foreground">
                        <div className="font-mono text-[11px] text-foreground font-medium">
                          PID: {r.productId}
                        </div>
                        <div className="font-mono text-[11px] mt-0.5">
                          UID: {r.userId}
                        </div>
                        {r.orderId && (
                          <div className="font-mono text-[10px] text-muted-foreground/80 mt-0.5">
                            OID: {r.orderId}
                          </div>
                        )}
                      </td>

                      {/* Media */}
                      <td className="p-3 align-top">
                        {r.media && r.media.length > 0 ? (
                          <div className="flex items-center gap-1 flex-wrap">
                            {r.media.map((m) => (
                              <button
                                key={m.id}
                                type="button"
                                onClick={() => setPreviewMediaUrl(m.mediaUrl)}
                                className="relative w-8 h-8 rounded border border-border overflow-hidden hover:opacity-80 transition-opacity"
                              >
                                <Image
                                  src={m.mediaUrl}
                                  alt="Review photo"
                                  fill
                                  sizes="32px"
                                  className="object-cover"
                                />
                              </button>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground/50">—</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="p-3 align-top">
                        {getStatusBadge(r.status)}
                      </td>

                      {/* Date */}
                      <td className="p-3 align-top text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(r.createdAt).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </td>

                      {/* Moderation Actions */}
                      <td className="p-3 align-top text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {r.status !== "APPROVED" && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 px-2 text-xs text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950 border-emerald-300"
                              disabled={isProcessing === r.id}
                              onClick={() =>
                                handleModerate(
                                  r.id,
                                  "APPROVE",
                                  "Approved by Admin moderator",
                                )
                              }
                            >
                              <CheckCircle className="h-3.5 w-3.5 mr-1" />
                              Approve
                            </Button>
                          )}

                          {r.status !== "REJECTED" && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 px-2 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950 border-rose-300"
                              disabled={isProcessing === r.id}
                              onClick={() => {
                                setRejectingReviewId(r.id);
                                setRejectionReason("");
                              }}
                            >
                              <XCircle className="h-3.5 w-3.5 mr-1" />
                              Reject
                            </Button>
                          )}

                          {r.status !== "FLAGGED" && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 px-2 text-xs text-purple-600 hover:text-purple-700 hover:bg-purple-50 dark:hover:bg-purple-950 border-purple-300"
                              disabled={isProcessing === r.id}
                              onClick={() =>
                                handleModerate(
                                  r.id,
                                  "FLAG",
                                  "Flagged for abuse investigation",
                                )
                              }
                            >
                              <Flag className="h-3.5 w-3.5 mr-1" />
                              Flag
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: ABUSE REPORTS */}
      {activeTab === "reports" && (
        <div className="space-y-4">
          <div className="border border-border rounded-lg overflow-x-auto bg-card shadow-sm">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-xs font-semibold text-muted-foreground">
                  <th className="p-3">Reason</th>
                  <th className="p-3">Report Details</th>
                  <th className="p-3">Review Snippet</th>
                  <th className="p-3">Reporter UID</th>
                  <th className="p-3">Report Date</th>
                  <th className="p-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {initialReports.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-muted-foreground">
                      No active abuse reports filed by customers.
                    </td>
                  </tr>
                ) : (
                  initialReports.map((rp) => (
                    <tr
                      key={rp.id}
                      className="hover:bg-muted/30 transition-colors"
                    >
                      <td className="p-3 align-top">
                        <Badge className="bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border-rose-300">
                          {rp.reason}
                        </Badge>
                      </td>
                      <td className="p-3 align-top max-w-xs text-xs text-foreground">
                        {rp.details || (
                          <span className="text-muted-foreground italic">
                            No additional comment provided.
                          </span>
                        )}
                      </td>
                      <td className="p-3 align-top max-w-sm text-xs text-muted-foreground">
                        <div className="font-semibold text-foreground mb-0.5">
                          PID: {rp.productId || "—"}
                        </div>
                        <p className="line-clamp-2">
                          {rp.reviewContent || "Review content unavailable"}
                        </p>
                      </td>
                      <td className="p-3 align-top font-mono text-[11px] text-muted-foreground">
                        {rp.userId}
                      </td>
                      <td className="p-3 align-top text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(rp.createdAt).toLocaleDateString()}
                      </td>
                      <td className="p-3 align-top text-right whitespace-nowrap">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs text-rose-600 border-rose-300"
                          onClick={() => {
                            setRejectingReviewId(rp.reviewId);
                            setRejectionReason(
                              `Violates review guidelines: ${rp.reason}`,
                            );
                          }}
                        >
                          <XCircle className="h-3.5 w-3.5 mr-1" />
                          Reject Review
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: PRODUCT RATING SUMMARIES */}
      {activeTab === "summaries" && (
        <div className="space-y-4">
          <div className="border border-border rounded-lg overflow-x-auto bg-card shadow-sm">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-xs font-semibold text-muted-foreground">
                  <th className="p-3">Product ID</th>
                  <th className="p-3">Average Rating</th>
                  <th className="p-3">Total Reviews</th>
                  <th className="p-3">Verified Buyers</th>
                  <th className="p-3">Star Distribution (5★ to 1★)</th>
                  <th className="p-3">Last Calculated</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {initialSummaries.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-muted-foreground">
                      No calculated product summaries found. Click &quot;Recalculate All&quot; above to initialize.
                    </td>
                  </tr>
                ) : (
                  initialSummaries.map((s) => (
                    <tr
                      key={s.productId}
                      className="hover:bg-muted/30 transition-colors"
                    >
                      <td className="p-3 align-middle font-mono text-xs font-semibold text-foreground">
                        {s.productId}
                      </td>
                      <td className="p-3 align-middle">
                        <div className="flex items-center gap-1.5 font-bold text-foreground">
                          <Star className="h-4 w-4 fill-amber-500 text-amber-500" />
                          <span>{s.averageRating.toFixed(1)}</span>
                        </div>
                      </td>
                      <td className="p-3 align-middle text-xs font-medium text-muted-foreground">
                        {s.reviewCount} reviews
                      </td>
                      <td className="p-3 align-middle text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                        {s.verifiedCount} verified
                      </td>
                      <td className="p-3 align-middle min-w-[180px]">
                        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                          <span>5★:{s.fiveStarCount}</span>
                          <span>•</span>
                          <span>4★:{s.fourStarCount}</span>
                          <span>•</span>
                          <span>3★:{s.threeStarCount}</span>
                          <span>•</span>
                          <span>2★:{s.twoStarCount}</span>
                          <span>•</span>
                          <span>1★:{s.oneStarCount}</span>
                        </div>
                      </td>
                      <td className="p-3 align-middle text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(s.lastCalculatedAt).toLocaleDateString()}
                      </td>
                      <td className="p-3 align-middle text-right whitespace-nowrap">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          disabled={recalculatingProductId === s.productId}
                          onClick={() => handleRecalculateProduct(s.productId)}
                        >
                          <RefreshCw
                            className={`h-3 w-3 mr-1 ${
                              recalculatingProductId === s.productId
                                ? "animate-spin"
                                : ""
                            }`}
                          />
                          Sync
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* REJECTION REASON MODAL OVERLAY */}
      {rejectingReviewId && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div>
              <h3 className="text-lg font-bold text-foreground">
                Reject Product Review
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                Provide a reason for rejecting this review. This reason will be
                logged and published on Kafka for compliance audit.
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-foreground">
                Rejection Reason:
              </label>
              <textarea
                rows={3}
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="e.g. Contains offensive language, spam links, or off-topic advertising..."
                className="w-full text-xs p-2.5 rounded-md border border-input bg-background focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setRejectingReviewId(null)}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                disabled={
                  !rejectionReason.trim() || isProcessing === rejectingReviewId
                }
                onClick={() =>
                  handleModerate(
                    rejectingReviewId,
                    "REJECT",
                    rejectionReason.trim(),
                  )
                }
              >
                Confirm Rejection
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* MEDIA PREVIEW MODAL */}
      {previewMediaUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setPreviewMediaUrl(null)}
        >
          <div
            className="relative max-w-2xl max-h-[85vh] w-full h-[500px] bg-black rounded-lg overflow-hidden flex items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            <Image
              src={previewMediaUrl}
              alt="Review attachment preview"
              fill
              sizes="(max-width: 768px) 100vw, 672px"
              className="object-contain"
            />
            <button
              type="button"
              onClick={() => setPreviewMediaUrl(null)}
              className="absolute top-3 right-3 bg-white/20 hover:bg-white/40 text-white rounded-full p-1.5 transition-colors"
            >
              <XCircle className="h-6 w-6" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
