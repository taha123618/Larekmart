"use client";

import { useState, useCallback } from "react";
import {
  AdminReviewItem,
  AdminReviewReportItem,
  AdminProductRatingSummaryItem,
  fetchAdminReviews,
  fetchReviewReports,
  fetchReviewSummaries,
  recalculateReviewSummaries,
} from "@/services/review.service";
import ReviewsStatsCards from "@/components/ReviewsStatsCards";
import ReviewsDataTable from "@/components/ReviewsDataTable";
import { toast } from "react-toastify";

interface ReviewsDashboardClientProps {
  initialReviews: AdminReviewItem[];
  initialReports: AdminReviewReportItem[];
  initialSummaries: AdminProductRatingSummaryItem[];
  token: string;
}

export default function ReviewsDashboardClient({
  initialReviews,
  initialReports,
  initialSummaries,
  token,
}: ReviewsDashboardClientProps) {
  const [reviews, setReviews] = useState<AdminReviewItem[]>(initialReviews);
  const [reports, setReports] = useState<AdminReviewReportItem[]>(initialReports);
  const [summaries, setSummaries] =
    useState<AdminProductRatingSummaryItem[]>(initialSummaries);
  const [isRecalculating, setIsRecalculating] = useState(false);

  const refreshData = useCallback(async () => {
    try {
      const [revRes, repRes, sumRes] = await Promise.all([
        fetchAdminReviews(token, { limit: 100 }),
        fetchReviewReports(token, { limit: 100 }),
        fetchReviewSummaries(token, { limit: 100 }),
      ]);

      if (revRes?.items) setReviews(revRes.items);
      if (repRes?.items) setReports(repRes.items);
      if (sumRes?.items) setSummaries(sumRes.items);
    } catch {
      toast.error("Failed to refresh reviews data");
    }
  }, [token]);

  const handleRecalculateAll = async () => {
    setIsRecalculating(true);
    try {
      const res = await recalculateReviewSummaries(token);
      if (res.success) {
        toast.success(
          `Successfully recalculated summaries (${res.recalculatedCount ?? 0} products synced)`,
        );
        await refreshData();
      } else {
        toast.error(res.message || "Failed to recalculate summaries");
      }
    } catch {
      toast.error("Error triggering recalculation");
    } finally {
      setIsRecalculating(false);
    }
  };

  const pendingCount = reviews.filter((r) => r.status === "PENDING").length;
  const approvedCount = reviews.filter((r) => r.status === "APPROVED").length;
  const flaggedCount = reviews.filter((r) => r.status === "FLAGGED").length;

  return (
    <div className="flex flex-col gap-6">
      <ReviewsStatsCards
        totalReviews={reviews.length}
        pendingCount={pendingCount}
        approvedCount={approvedCount}
        flaggedCount={flaggedCount}
        totalReports={reports.length}
        isRecalculating={isRecalculating}
        onRecalculateAll={handleRecalculateAll}
      />

      <ReviewsDataTable
        initialReviews={reviews}
        initialReports={reports}
        initialSummaries={summaries}
        token={token}
        onRefresh={refreshData}
      />
    </div>
  );
}
