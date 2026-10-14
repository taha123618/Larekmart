# Review Service Frontend Integration Implementation Plan

- **Spec**: [`docs/superpowers/specs/2026-10-14-review-service-frontend-integration-design.md`](file:///Users/taha/projects/microservices-ecommerce/docs/superpowers/specs/2026-10-14-review-service-frontend-integration-design.md)
- **Target Workspaces**: `apps/client`, `apps/admin`
- **Output**: Full end-to-end user review experience (listing, verified submission with media attachments, voting, reporting) and admin moderation portal (pending queue, abuse reports, recalculate summaries).

---

## Tasks & Execution Status

- [x] **Task 1: Storefront Review Service Client (`apps/client`)**
  - Created `apps/client/src/services/review.service.ts`.
  - Implemented `fetchProductReviews`, `fetchProductRatingSummary`, `submitProductReview`, `voteProductReview`, `reportProductReview`.
  - Added `uploadReviewPhoto` helper in `apps/client/src/services/media.service.ts`.
  - Type-check: `pnpm --filter client check-types` passed.

- [x] **Task 2: Storefront Write Review Modal (`apps/client`)**
  - Created `apps/client/src/components/WriteReviewModal.tsx`.
  - 1-5 star selector, headline, review feedback, photo upload with presigned URLs & preview.
  - Verified buyer eligibility check, Clerk authentication, error alerts.

- [x] **Task 3: Storefront ProductTabs Live Integration (`apps/client`)**
  - Updated `apps/client/src/components/ProductTabs.tsx` to remove mock `localStorage`.
  - Real-time rating breakdown bars with percentage calculations and aggregate ratings.
  - Reviews list with verified buyer badges, image thumbnail preview lightbox modal, helpful/unhelpful voting, official seller responses, and abuse reporting modal.

- [x] **Task 4: Admin Review Service Client (`apps/admin`)**
  - Created `apps/admin/src/services/review.service.ts`.
  - Implemented `fetchAdminReviews`, `moderateReview`, `fetchReviewReports`, `fetchReviewSummaries`, `recalculateReviewSummaries`.

- [x] **Task 5: Admin Customer Reviews Dashboard (`apps/admin`)**
  - Created `apps/admin/src/app/(dashboard)/reviews/page.tsx` and `ReviewsDashboardClient.tsx`.
  - Created `ReviewsStatsCards.tsx` with KPI metrics and global recalculate trigger.
  - Created `ReviewsDataTable.tsx` with Moderation Queue (Approve / Reject modal with reason / Flag), Abuse Reports tab, and Catalog Summaries tab.

- [x] **Task 6: Admin Sidebar Navigation Integration (`apps/admin`)**
  - Updated `apps/admin/src/components/AppSidebar.tsx` to add "Customer Reviews" navigation link under "Customer Feedback" sidebar group.

- [x] **Task 7: Full Verification & Quality Gates**
  - `pnpm --filter client check-types` ➔ Passed (0 errors).
  - `pnpm --filter admin check-types` ➔ Passed (0 errors).
  - `pnpm --filter review-service check-types` ➔ Passed (0 errors).
  - `pnpm --filter review-service test` ➔ Passed (All 5 suites passed).
  - `pnpm --filter admin lint` ➔ Passed (0 errors, 0 warnings).
  - `pnpm --filter client lint` ➔ Passed (0 errors).
  - `pnpm --filter client build` ➔ Passed (Turbopack production build).
  - `pnpm --filter admin build` ➔ Passed (Optimized production build with `/reviews`).
