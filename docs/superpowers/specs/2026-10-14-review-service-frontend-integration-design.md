# Design Specification: Review Service Frontend Integration

## 1. Overview & Objectives

This specification defines the end-to-end integration of the **`review-service`** (:8014) into:
1. **Storefront (`apps/client`)**: Product review listing, 1-5 star rating breakdown, verified purchase enforcement, helpful voting, abuse reporting, and image-attached review submissions via `media-service`.
2. **Admin Dashboard (`apps/admin`)**: Dedicated moderation queue, abuse reports management, audit logging, and product rating summary recalculation.

All communication routes through the **API Gateway** (`:8090`).

---

## 2. Storefront Integration (`apps/client`)

### 2.1 Service Layer (`apps/client/src/services/review.service.ts`)
- Connects to `NEXT_PUBLIC_API_GATEWAY_URL` (default `http://localhost:8090`).
- Methods:
  - `fetchProductReviews(productId, query)`: `GET /api/v1/products/:productId/reviews` with pagination (`page`, `limit`) and sorting (`newest`, `highest_rating`, `lowest_rating`, `most_helpful`).
  - `fetchProductRatingSummary(productId)`: `GET /api/v1/products/:productId/rating-summary`.
  - `submitReview(productId, payload, token)`: `POST /api/v1/products/:productId/reviews` with `Authorization: Bearer <token>`.
  - `voteReview(reviewId, voteType, token)`: `POST /api/v1/reviews/:reviewId/votes` with `{ voteType: 'HELPFUL' | 'UNHELPFUL' }`.
  - `reportReview(reviewId, reason, details, token)`: `POST /api/v1/reviews/:reviewId/reports`.

### 2.2 Product Tabs & Review List (`apps/client/src/components/ProductTabs.tsx`)
- Removes local `localStorage` mock.
- Replaces with live state:
  - Rating summary banner with 5-star to 1-star visual percentage bars and average score.
  - Reviews list with pagination controls and sorting selector.
  - Badges: `Verified Buyer` badge displayed when `isVerifiedPurchase: true`.
  - Media display: renders thumbnails for attached images.
  - Seller response card: displays official seller feedback when present.
  - Helpful voting buttons (thumbs up / thumbs down) with optimistic UI updates.
  - Report button opening abuse reporting dialog.

### 2.3 Review Submission Dialog (`apps/client/src/components/WriteReviewModal.tsx`)
- Modal dialog with:
  - Interactive star picker (1–5).
  - Review title & detailed feedback input.
  - Image uploader integrating directly with `media-service` (`POST /api/v1/media/uploads` + presigned PUT + `POST /complete`), displaying image thumbnails before submitting.
  - Submission error banner specifically handling purchase eligibility rules:
    - `403`: "You must purchase and receive this item before writing a review."
    - `409`: "You have already submitted a review for this product."
    - `401`: "Please sign in to write a review."

---

## 3. Admin Portal Integration (`apps/admin`)

### 3.1 Service Layer (`apps/admin/src/services/review.service.ts`)
- Methods:
  - `fetchPendingReviews(params, token)`: `GET /api/v1/admin/reviews/pending`.
  - `moderateReview(reviewId, action, reason, token)`: `POST /api/v1/admin/reviews/:reviewId/moderate` (`APPROVE`, `REJECT`, `FLAG`).
  - `fetchReviewReports(token)`: `GET /api/v1/admin/reviews/reports`.
  - `recalculateRatingSummaries(token)`: `POST /api/v1/admin/reviews/recalculate-summaries`.

### 3.2 Reviews Management Dashboard (`apps/admin/src/app/(dashboard)/reviews/page.tsx`)
- Navigation: Add "Customer Reviews" to `apps/admin/src/components/AppSidebar.tsx`.
- KPI Summary Cards:
  - Total Reviews across marketplace
  - Pending Moderation Count
  - Active Abuse Reports Count
  - Average Customer Satisfaction Score
- Tabs:
  1. **Moderation Queue**: Reviews pending approval or flagged for inspection. Actions: `Approve` (green), `Reject` (red, with reason prompt), `Flag` (amber).
  2. **Abuse Reports**: Log of reported reviews with reason badge (`SPAM`, `OFFENSIVE`, `HARASSMENT`, `FAKE_REVIEW`, `OFF_TOPIC`), submitter notes, and quick action to approve/reject the target review.
  3. **Product Summaries**: Overview table showing total reviews, average score, and verified counts per product, with a button to trigger recalculation.

---

## 4. Verification & Testing Plan

1. **Client Type Checking**: `pnpm --filter client check-types`
2. **Admin Type Checking**: `pnpm --filter admin check-types`
3. **Admin & Client Linting**: `pnpm lint`
4. **Build Verification**: `pnpm --filter client build && pnpm --filter admin build`
5. **Interactive Verification**:
   - Verify storefront product page displays real reviews seeded in `larekmart_review_db`.
   - Verify helpful voting updates counts via API Gateway.
   - Verify admin reviews dashboard loads pending reviews and abuse reports.
