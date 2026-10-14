"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Star,
  ShieldCheck,
  Truck,
  RotateCcw,
  CheckCircle2,
  MessageSquarePlus,
  ThumbsUp,
  ThumbsDown,
  Flag,
  Filter,
  Check,
  X,
  Store,
  Loader2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import type {
  ProductType,
  ProductRatingSummary,
  ReviewSortOption,
  ReportReason,
} from "@repo/types";
import { toast } from "react-toastify";
import { useAuth } from "@clerk/nextjs";
import Image from "next/image";
import {
  fetchProductReviews,
  fetchProductRatingSummary,
  voteProductReview,
  reportProductReview,
  type PaginatedReviewsResponse,
} from "@/services/review.service";
import WriteReviewModal from "./WriteReviewModal";

interface ProductTabsProps {
  product: ProductType;
}

export default function ProductTabs({ product }: ProductTabsProps) {
  const { isSignedIn, getToken } = useAuth();

  const [activeTab, setActiveTab] = useState<"specs" | "reviews" | "shipping">(
    "specs",
  );

  // Review states
  const [reviewsData, setReviewsData] = useState<PaginatedReviewsResponse>({
    reviews: [],
    total: 0,
    page: 1,
    limit: 10,
    totalPages: 1,
  });
  const [summary, setSummary] = useState<ProductRatingSummary | null>(null);
  const [isLoadingReviews, setIsLoadingReviews] = useState(false);

  // Filters & sorting
  const [currentPage, setCurrentPage] = useState(1);
  const [currentSort, setCurrentSort] = useState<ReviewSortOption>("newest");
  const [ratingFilter, setRatingFilter] = useState<number | undefined>(
    undefined,
  );
  const [verifiedFilter, setVerifiedFilter] = useState(false);

  // Modals
  const [isWriteReviewOpen, setIsWriteReviewOpen] = useState(false);
  const [reportingReviewId, setReportingReviewId] = useState<string | null>(
    null,
  );
  const [reportReason, setReportReason] = useState<ReportReason>("SPAM");
  const [reportDetails, setReportDetails] = useState("");
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);

  // Voted tracking to prevent repeat clicking in same session
  const [votedReviews, setVotedReviews] = useState<
    Record<string, "HELPFUL" | "UNHELPFUL">
  >({});

  // 1. Load reviews & summary from review-service
  const loadReviews = useCallback(async () => {
    setIsLoadingReviews(true);
    try {
      const [revs, summ] = await Promise.all([
        fetchProductReviews(String(product.id), {
          page: currentPage,
          limit: 10,
          sort: currentSort,
          rating: ratingFilter,
          verifiedOnly: verifiedFilter,
        }),
        fetchProductRatingSummary(String(product.id)),
      ]);

      setReviewsData(revs);
      if (summ) setSummary(summ);
    } catch {
      // Gracefully keep current state if network error
    } finally {
      setIsLoadingReviews(false);
    }
  }, [product.id, currentPage, currentSort, ratingFilter, verifiedFilter]);

  useEffect(() => {
    if (activeTab === "reviews") {
      loadReviews();
    }
  }, [activeTab, loadReviews]);

  // Initial summary load to show rating badge on tab
  useEffect(() => {
    fetchProductRatingSummary(String(product.id)).then((data) => {
      if (data) setSummary(data);
    });
  }, [product.id]);

  // 2. Handle Helpful / Unhelpful Vote
  const handleVote = async (
    reviewId: string,
    voteType: "HELPFUL" | "UNHELPFUL",
  ) => {
    if (!isSignedIn) {
      toast.info("Please sign in to vote on reviews.");
      return;
    }

    if (votedReviews[reviewId]) {
      toast.info("You have already voted on this review.");
      return;
    }

    try {
      const token = await getToken();
      const res = await voteProductReview(reviewId, voteType, token);

      setVotedReviews((prev) => ({ ...prev, [reviewId]: voteType }));

      // Optimistically update counts in review list
      setReviewsData((prev) => ({
        ...prev,
        reviews: prev.reviews.map((r) =>
          r.id === reviewId
            ? {
                ...r,
                helpfulCount: res.helpfulCount,
                unhelpfulCount: res.unhelpfulCount,
              }
            : r,
        ),
      }));

      toast.success(
        voteType === "HELPFUL" ? "Marked as helpful" : "Feedback recorded",
      );
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : "Could not record vote.",
      );
    }
  };

  // 3. Handle Abuse Report Submission
  const handleSubmitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportingReviewId) return;

    if (!isSignedIn) {
      toast.info("Please sign in to report a review.");
      return;
    }

    setIsSubmittingReport(true);
    try {
      const token = await getToken();
      await reportProductReview(
        reportingReviewId,
        reportReason,
        reportDetails.trim() || undefined,
        token,
      );

      toast.success(
        "Thank you. Review has been submitted for moderation review.",
      );
      setReportingReviewId(null);
      setReportDetails("");
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : "Failed to submit report.",
      );
    } finally {
      setIsSubmittingReport(false);
    }
  };

  // Star breakdown calculation
  const totalReviews = summary?.reviewCount || reviewsData.total || 0;
  const avgRating = summary
    ? Number(summary.averageRating).toFixed(1)
    : reviewsData.reviews.length > 0
      ? (
          reviewsData.reviews.reduce((acc, r) => acc + r.rating, 0) /
          reviewsData.reviews.length
        ).toFixed(1)
      : "0.0";

  const getPercent = (count: number) => {
    if (!totalReviews || totalReviews === 0) return 0;
    return Math.round((count / totalReviews) * 100);
  };

  return (
    <div className="mt-12 bg-white dark:bg-slate-900/70 dark:backdrop-blur-xl rounded-3xl border border-slate-200/80 dark:border-slate-800/80 dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)] p-6 sm:p-10 shadow-xs">
      {/* Tabs Navigation */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 gap-4 sm:gap-8 overflow-x-auto no-scrollbar">
        <button
          onClick={() => setActiveTab("specs")}
          className={`pb-4 text-sm font-bold transition whitespace-nowrap cursor-pointer border-b-2 ${
            activeTab === "specs"
              ? "border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400"
              : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
          }`}
        >
          Product Specifications
        </button>

        <button
          onClick={() => setActiveTab("reviews")}
          className={`pb-4 text-sm font-bold transition whitespace-nowrap cursor-pointer border-b-2 flex items-center gap-1.5 ${
            activeTab === "reviews"
              ? "border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400"
              : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
          }`}
        >
          <span>Customer Reviews</span>
          {totalReviews > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold">
              {avgRating} ★ ({totalReviews})
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab("shipping")}
          className={`pb-4 text-sm font-bold transition whitespace-nowrap cursor-pointer border-b-2 ${
            activeTab === "shipping"
              ? "border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400"
              : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
          }`}
        >
          Delivery & Returns
        </button>
      </div>

      {/* Tab Panels */}
      <div className="mt-8">
        {/* SPECIFICATIONS TAB */}
        {activeTab === "specs" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white mb-4">
                Technical Highlights
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                {product.description ||
                  product.shortDescription ||
                  "Detailed product information verified by marketplace catalog."}
              </p>

              <div className="mt-6 flex flex-col gap-3">
                {product.sizes && product.sizes.length > 0 && (
                  <div className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>
                      Available in {product.sizes.length} fit sizes (
                      {product.sizes.join(", ").toUpperCase()})
                    </span>
                  </div>
                )}
                {product.colors && product.colors.length > 0 && (
                  <div className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>
                      Available in {product.colors.length} verified colorway
                      {product.colors.length > 1 ? "s" : ""}
                    </span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>Quality checked and approved by marketplace team</span>
                </div>
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/60 rounded-2xl p-6 border border-slate-100 dark:border-slate-800">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-4">
                Product Details
              </h4>
              <dl className="grid grid-cols-2 gap-y-3 gap-x-4 text-xs">
                <dt className="text-slate-500 dark:text-slate-400">
                  Department
                </dt>
                <dd className="font-bold text-slate-900 dark:text-white uppercase">
                  {product.categorySlug || "General"}
                </dd>

                <dt className="text-slate-500 dark:text-slate-400">
                  Available Sizes
                </dt>
                <dd className="font-bold text-slate-900 dark:text-white uppercase">
                  {product.sizes?.length
                    ? product.sizes.join(", ")
                    : "Standard / One Size"}
                </dd>

                <dt className="text-slate-500 dark:text-slate-400">
                  Color Options
                </dt>
                <dd className="font-bold text-slate-900 dark:text-white capitalize">
                  {product.colors?.length
                    ? product.colors.join(", ")
                    : "Standard"}
                </dd>

                <dt className="text-slate-500 dark:text-slate-400">
                  Catalog SKU
                </dt>
                <dd className="font-mono text-slate-700 dark:text-slate-300">
                  LKM-{product.id}-CATALOG
                </dd>

                <dt className="text-slate-500 dark:text-slate-400">
                  Stock Status
                </dt>
                <dd className="font-semibold text-emerald-600 dark:text-emerald-400">
                  Active Listing
                </dd>
              </dl>
            </div>
          </div>
        )}

        {/* CUSTOMER REVIEWS TAB */}
        {activeTab === "reviews" && (
          <div className="flex flex-col gap-8">
            {/* Rating Breakdown Banner */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 p-6 sm:p-8 rounded-3xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800">
              {/* Left Score Box */}
              <div className="lg:col-span-4 flex flex-col items-center sm:items-start justify-center border-b lg:border-b-0 lg:border-r border-slate-200 dark:border-slate-800 pb-6 lg:pb-0 lg:pr-8">
                <div className="text-5xl font-black text-slate-900 dark:text-white tracking-tight">
                  {avgRating}
                </div>
                <div className="flex items-center text-amber-400 my-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      className={`w-5 h-5 ${
                        Number(avgRating) >= star
                          ? "fill-amber-400 text-amber-400"
                          : "text-slate-300 dark:text-slate-700"
                      }`}
                    />
                  ))}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {totalReviews === 0
                    ? "No verified ratings yet"
                    : `Based on ${totalReviews} customer review${totalReviews > 1 ? "s" : ""}`}
                </p>
                {summary && summary.verifiedCount > 0 && (
                  <div className="mt-2 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{summary.verifiedCount} verified purchases</span>
                  </div>
                )}

                <button
                  onClick={() => setIsWriteReviewOpen(true)}
                  className="mt-6 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition flex items-center gap-2 shadow-xs cursor-pointer"
                >
                  <MessageSquarePlus className="w-4 h-4" />
                  <span>Write a Review</span>
                </button>
              </div>

              {/* Right Star Bars */}
              <div className="lg:col-span-8 flex flex-col justify-center gap-2.5">
                {[
                  { star: 5, count: summary?.fiveStarCount || 0 },
                  { star: 4, count: summary?.fourStarCount || 0 },
                  { star: 3, count: summary?.threeStarCount || 0 },
                  { star: 2, count: summary?.twoStarCount || 0 },
                  { star: 1, count: summary?.oneStarCount || 0 },
                ].map(({ star, count }) => {
                  const percent = getPercent(count);
                  const isFiltered = ratingFilter === star;

                  return (
                    <button
                      key={star}
                      onClick={() =>
                        setRatingFilter((prev) =>
                          prev === star ? undefined : star,
                        )
                      }
                      className={`flex items-center gap-3 text-xs w-full text-left p-1.5 rounded-xl transition cursor-pointer ${
                        isFiltered
                          ? "bg-indigo-50 dark:bg-indigo-950/40 font-bold"
                          : "hover:bg-slate-100/60 dark:hover:bg-slate-800/80"
                      }`}
                    >
                      <span className="w-12 font-bold text-slate-700 dark:text-slate-300">
                        {star} Stars
                      </span>
                      <div className="flex-1 h-2.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                        <div
                          className="h-full bg-amber-400 rounded-full transition-all duration-500"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                      <span className="w-10 text-right font-semibold text-slate-500 dark:text-slate-400">
                        {percent}%
                      </span>
                      <span className="w-8 text-right text-slate-400 text-[11px]">
                        ({count})
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Filter and Sort Toolbar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold text-slate-400 dark:text-slate-500 flex items-center gap-1 mr-1">
                  <Filter className="w-3.5 h-3.5" />
                  Filter:
                </span>
                <button
                  onClick={() => setRatingFilter(undefined)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                    ratingFilter === undefined
                      ? "bg-indigo-600 text-white"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200"
                  }`}
                >
                  All Stars
                </button>
                <button
                  onClick={() => setVerifiedFilter((prev) => !prev)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer ${
                    verifiedFilter
                      ? "bg-emerald-600 text-white"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200"
                  }`}
                >
                  {verifiedFilter && <Check className="w-3 h-3" />}
                  <span>Verified Only</span>
                </button>
              </div>

              {/* Sorting Selector */}
              <div className="flex items-center gap-2">
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  Sort By:
                </label>
                <select
                  value={currentSort}
                  onChange={(e) =>
                    setCurrentSort(e.target.value as ReviewSortOption)
                  }
                  className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-indigo-500 transition cursor-pointer"
                >
                  <option value="newest">Most Recent</option>
                  <option value="most_helpful">Most Helpful</option>
                  <option value="highest_rating">Highest Rating</option>
                  <option value="lowest_rating">Lowest Rating</option>
                </select>
              </div>
            </div>

            {/* Reviews List */}
            {isLoadingReviews ? (
              <div className="py-16 flex flex-col items-center justify-center gap-3 text-slate-400">
                <Loader2 className="w-7 h-7 animate-spin text-indigo-600" />
                <span className="text-xs font-medium">
                  Loading verified customer reviews...
                </span>
              </div>
            ) : reviewsData.reviews.length === 0 ? (
              <div className="py-16 text-center bg-slate-50/50 dark:bg-slate-800/30 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800 p-8">
                <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                  No reviews matching selected criteria
                </p>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                  Be the first verified buyer to share feedback on this product.
                </p>
                <button
                  onClick={() => setIsWriteReviewOpen(true)}
                  className="mt-5 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition inline-flex items-center gap-2 cursor-pointer"
                >
                  <MessageSquarePlus className="w-4 h-4" />
                  <span>Write the First Review</span>
                </button>
              </div>
            ) : (
              <div className="space-y-5">
                {reviewsData.reviews.map((rev) => (
                  <div
                    key={rev.id}
                    className="p-6 rounded-3xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900/90 hover:border-slate-300 dark:hover:border-slate-700 transition flex flex-col gap-3 shadow-2xs"
                  >
                    {/* Author & Header */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <span className="text-sm font-black text-slate-900 dark:text-white">
                          {rev.authorName}
                        </span>
                        {rev.isVerifiedPurchase && (
                          <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200/60 dark:border-emerald-800/60 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Verified Buyer</span>
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-slate-400 dark:text-slate-500 font-medium">
                        {new Date(rev.createdAt).toLocaleDateString(undefined, {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    </div>

                    {/* Star Rating */}
                    <div className="flex items-center text-amber-400">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star
                          key={s}
                          className={`w-4 h-4 ${
                            rev.rating >= s
                              ? "fill-amber-400 text-amber-400"
                              : "text-slate-300 dark:text-slate-700"
                          }`}
                        />
                      ))}
                    </div>

                    {/* Title & Body */}
                    <h5 className="text-sm font-bold text-slate-900 dark:text-white">
                      {rev.title}
                    </h5>
                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-line">
                      {rev.content}
                    </p>

                    {/* Photo Attachments */}
                    {rev.media && rev.media.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2.5">
                        {rev.media.map((med) => (
                          <a
                            key={med.id}
                            href={med.mediaUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="relative w-16 h-16 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 hover:scale-105 transition"
                          >
                            <Image
                              src={med.mediaUrl}
                              alt="Review attachment"
                              fill
                              className="object-cover"
                            />
                          </a>
                        ))}
                      </div>
                    )}

                    {/* Official Seller Response */}
                    {rev.sellerResponse && (
                      <div className="mt-3 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border-l-4 border-indigo-600 flex flex-col gap-1.5">
                        <div className="flex items-center gap-2 text-xs font-bold text-indigo-600 dark:text-indigo-400">
                          <Store className="w-3.5 h-3.5" />
                          <span>Official Seller Response</span>
                        </div>
                        <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed italic">
                          &quot;{rev.sellerResponse.content}&quot;
                        </p>
                      </div>
                    )}

                    {/* Voting & Reporting Action Row */}
                    <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800/60 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                      <div className="flex items-center gap-4">
                        <span className="text-[11px] font-semibold text-slate-400">
                          Was this review helpful?
                        </span>
                        <button
                          onClick={() => handleVote(rev.id, "HELPFUL")}
                          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition cursor-pointer ${
                            votedReviews[rev.id] === "HELPFUL"
                              ? "bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 font-bold"
                              : "hover:bg-slate-100 dark:hover:bg-slate-800"
                          }`}
                        >
                          <ThumbsUp className="w-3.5 h-3.5" />
                          <span>Yes ({rev.helpfulCount})</span>
                        </button>
                        <button
                          onClick={() => handleVote(rev.id, "UNHELPFUL")}
                          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition cursor-pointer ${
                            votedReviews[rev.id] === "UNHELPFUL"
                              ? "bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 font-bold"
                              : "hover:bg-slate-100 dark:hover:bg-slate-800"
                          }`}
                        >
                          <ThumbsDown className="w-3.5 h-3.5" />
                          <span>No ({rev.unhelpfulCount})</span>
                        </button>
                      </div>

                      <button
                        onClick={() => setReportingReviewId(rev.id)}
                        className="text-slate-400 hover:text-rose-500 transition flex items-center gap-1 cursor-pointer text-[11px]"
                      >
                        <Flag className="w-3 h-3" />
                        <span>Report</span>
                      </button>
                    </div>
                  </div>
                ))}

                {/* Pagination Controls */}
                {reviewsData.totalPages > 1 && (
                  <div className="flex items-center justify-center gap-3 pt-4">
                    <button
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 disabled:opacity-40 transition flex items-center gap-1 cursor-pointer"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                      <span>Previous</span>
                    </button>
                    <span className="text-xs font-bold text-slate-600 dark:text-slate-400">
                      Page {reviewsData.page} of {reviewsData.totalPages}
                    </span>
                    <button
                      onClick={() =>
                        setCurrentPage((p) =>
                          Math.min(reviewsData.totalPages, p + 1),
                        )
                      }
                      disabled={currentPage === reviewsData.totalPages}
                      className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 disabled:opacity-40 transition flex items-center gap-1 cursor-pointer"
                    >
                      <span>Next</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* SHIPPING & RETURNS TAB */}
        {activeTab === "shipping" && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex flex-col gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-100 dark:border-indigo-900/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                <Truck className="w-5 h-5" />
              </div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                Express Delivery
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Orders dispatch within 24 hours. Track shipment status in real
                time with carrier integrations.
              </p>
            </div>

            <div className="p-6 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex flex-col gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-100 dark:border-amber-900/60 flex items-center justify-center text-amber-600 dark:text-amber-400">
                <RotateCcw className="w-5 h-5" />
              </div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                30-Day Easy Returns
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Not completely satisfied? Initiate a return within 30 days for a
                full refund or size exchange.
              </p>
            </div>

            <div className="p-6 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex flex-col gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-100 dark:border-emerald-900/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                Buyer Protection
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Every transaction is secure and backed by Larekmart guarantee
                until package receipt is confirmed.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Write Review Modal */}
      <WriteReviewModal
        productId={String(product.id)}
        isOpen={isWriteReviewOpen}
        onClose={() => setIsWriteReviewOpen(false)}
        onReviewSubmitted={loadReviews}
      />

      {/* Report Review Abuse Modal */}
      {reportingReviewId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <form
            onSubmit={handleSubmitReport}
            className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 sm:p-7 flex flex-col gap-4"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-rose-600">
                <Flag className="w-5 h-5" />
                <h4 className="text-sm font-black text-slate-900 dark:text-white">
                  Report Inappropriate Review
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setReportingReviewId(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400">
              Help us maintain marketplace authenticity. What is wrong with this
              review?
            </p>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Reason
              </label>
              <select
                value={reportReason}
                onChange={(e) =>
                  setReportReason(e.target.value as ReportReason)
                }
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-indigo-500 transition cursor-pointer"
              >
                <option value="SPAM">Spam or Advertising</option>
                <option value="FAKE_REVIEW">Fake or Inauthentic Review</option>
                <option value="ABUSIVE">Offensive or Abusive Content</option>
                <option value="OFF_TOPIC">Not Related to This Product</option>
                <option value="OTHER">Other Issue</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Additional Details (Optional)
              </label>
              <textarea
                rows={3}
                placeholder="Explain why this review violates community standards..."
                value={reportDetails}
                onChange={(e) => setReportDetails(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-indigo-500 transition"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setReportingReviewId(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmittingReport}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isSubmittingReport ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <span>Submit Report</span>
                )}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
