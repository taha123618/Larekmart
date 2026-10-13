# Review Service Frontend Integration Implementation Plan

- **Spec**: [`docs/superpowers/specs/2026-10-14-review-service-frontend-integration-design.md`](file:///Users/taha/projects/microservices-ecommerce/docs/superpowers/specs/2026-10-14-review-service-frontend-integration-design.md)
- **Target Workspaces**: `apps/client`, `apps/admin`
- **Output**: Full end-to-end user review experience (listing, verified submission with media attachments, voting, reporting) and admin moderation portal (pending queue, abuse reports, recalculate summaries).

---

## Proposed Tasks

### Task 1: Storefront Review Service Client (`apps/client`)
- Create `apps/client/src/services/review.service.ts`.
- Implement `fetchProductReviews`, `fetchProductRatingSummary`, `submitReview`, `voteReview`, `reportReview`.
- Type-check: `pnpm --filter client check-types`.

### Task 2: Storefront Write Review Modal (`apps/client`)
- Create `apps/client/src/components/WriteReviewModal.tsx`.
- Support 1-5 star selection, title, feedback, and image upload with preview using `media.service.ts`.
- Clear handling of Clerk authentication and verified buyer eligibility (403 errors).

### Task 3: Storefront ProductTabs Live Integration (`apps/client`)
- Update `apps/client/src/components/ProductTabs.tsx` to remove `localStorage` mocks.
- Render rating breakdown progress bars (1-5 stars) and average score.
- Render reviews list with verified buyer badges, image thumbnails, seller responses, helpful votes, and report modal.
- Verify: `pnpm --filter client check-types`.

### Task 4: Admin Review Service Client (`apps/admin`)
- Create `apps/admin/src/services/review.service.ts`.
- Implement `fetchPendingReviews`, `moderateReview`, `fetchReviewReports`, `recalculateRatingSummaries`.
- Type-check: `pnpm --filter admin check-types`.

### Task 5: Admin Customer Reviews Dashboard (`apps/admin`)
- Create `apps/admin/src/app/(dashboard)/reviews/page.tsx`.
- Implement KPI summary cards, Moderation Queue tab (Approve/Reject/Flag), Abuse Reports tab, and Product Summaries tab.
- Type-check: `pnpm --filter admin check-types`.

### Task 6: Admin Sidebar Navigation Integration (`apps/admin`)
- Update `apps/admin/src/components/AppSidebar.tsx` to add "Customer Reviews" navigation item with star icon.
- Type-check: `pnpm --filter admin check-types`.

### Task 7: Full Verification & Quality Gates
- Run `pnpm --filter client check-types` and `pnpm --filter admin check-types`.
- Run `pnpm lint`.
- Run build tests.
