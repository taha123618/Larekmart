import { auth } from "@clerk/nextjs/server";
import {
  fetchAdminReviews,
  fetchReviewReports,
  fetchReviewSummaries,
  type AdminReviewItem,
  type AdminReviewReportItem,
  type AdminProductRatingSummaryItem,
} from "@/services/review.service";
import ReviewsDashboardClient from "./ReviewsDashboardClient";

export const dynamic = "force-dynamic";

export default async function ReviewsPage() {
  const { getToken } = await auth();
  const token = (await getToken()) || "";

  let initialReviews: AdminReviewItem[] = [];
  let initialReports: AdminReviewReportItem[] = [];
  let initialSummaries: AdminProductRatingSummaryItem[] = [];

  if (token) {
    try {
      const [revRes, repRes, sumRes] = await Promise.all([
        fetchAdminReviews(token, { limit: 100 }).catch(() => null),
        fetchReviewReports(token, { limit: 100 }).catch(() => null),
        fetchReviewSummaries(token, { limit: 100 }).catch(() => null),
      ]);

      if (revRes?.items) initialReviews = revRes.items;
      if (repRes?.items) initialReports = repRes.items;
      if (sumRes?.items) initialSummaries = sumRes.items;
    } catch (err) {
      console.error("Error fetching initial reviews in admin:", err);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="px-4 py-3 bg-secondary rounded-md">
        <h1 className="text-xl font-bold tracking-tight">
          Customer Reviews & Moderation
        </h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Moderate customer feedback, inspect reported reviews for abuse or
          spam, and maintain real-time product rating summary aggregates.
        </p>
      </div>

      <ReviewsDashboardClient
        initialReviews={initialReviews}
        initialReports={initialReports}
        initialSummaries={initialSummaries}
        token={token}
      />
    </div>
  );
}
