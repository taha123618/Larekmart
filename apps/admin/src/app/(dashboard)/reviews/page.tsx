import { auth } from "@clerk/nextjs/server";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
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
      {/* Breadcrumb Navigation */}
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/">Dashboard</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink href="/reviews">Customer Care</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Product Reviews & Ratings</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Customer Reviews & Moderation
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Moderate customer feedback, inspect reported reviews for abuse or
            spam, and maintain real-time product rating summary aggregates.
          </p>
        </div>
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
