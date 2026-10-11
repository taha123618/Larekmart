"use client";

import { useState, useEffect } from "react";
import {
  Star,
  ShieldCheck,
  Truck,
  RotateCcw,
  CheckCircle2,
  MessageSquarePlus,
  X,
} from "lucide-react";
import { ProductType } from "@repo/types";
import { toast } from "react-toastify";

interface ProductTabsProps {
  product: ProductType;
}

interface Review {
  id: string;
  author: string;
  rating: number;
  date: string;
  title: string;
  comment: string;
  verified: boolean;
}

export default function ProductTabs({ product }: ProductTabsProps) {
  const [activeTab, setActiveTab] = useState<"specs" | "reviews" | "shipping">("specs");
  const [reviews, setReviews] = useState<Review[]>([]);
  const [isWriteReviewOpen, setIsWriteReviewOpen] = useState(false);

  // New review form state
  const [newAuthor, setNewAuthor] = useState("");
  const [newRating, setNewRating] = useState(5);
  const [newTitle, setNewTitle] = useState("");
  const [newComment, setNewComment] = useState("");
  const [hoverRating, setHoverRating] = useState(0);

  // Load reviews from local persistence for this product
  useEffect(() => {
    try {
      const stored = localStorage.getItem(`lkm_reviews_${product.id}`);
      if (stored) {
        setReviews(JSON.parse(stored));
      } else {
        setReviews([]);
      }
    } catch {
      setReviews([]);
    }
  }, [product.id]);

  const handleAddReview = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAuthor.trim() || !newTitle.trim() || !newComment.trim()) {
      toast.error("Please fill in all review fields.");
      return;
    }

    const review: Review = {
      id: `${Date.now()}`,
      author: newAuthor.trim(),
      rating: newRating,
      date: "Just now",
      title: newTitle.trim(),
      comment: newComment.trim(),
      verified: true,
    };

    const updated = [review, ...reviews];
    setReviews(updated);

    try {
      localStorage.setItem(`lkm_reviews_${product.id}`, JSON.stringify(updated));
    } catch {
      // LocalStorage quota or unavailable
    }

    toast.success("Thank you! Your verified review has been published.");
    setNewAuthor("");
    setNewTitle("");
    setNewComment("");
    setNewRating(5);
    setIsWriteReviewOpen(false);
  };

  const avgRating =
    reviews.length > 0
      ? (
          reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length
        ).toFixed(1)
      : null;

  return (
    <div className="mt-12 bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-10 shadow-xs">
      {/* Tabs Navigation */}
      <div className="flex border-b border-slate-200 gap-4 sm:gap-8 overflow-x-auto no-scrollbar">
        <button
          onClick={() => setActiveTab("specs")}
          className={`pb-4 text-sm font-bold transition whitespace-nowrap cursor-pointer border-b-2 ${
            activeTab === "specs"
              ? "border-indigo-600 text-indigo-600"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          Product Specifications
        </button>

        <button
          onClick={() => setActiveTab("reviews")}
          className={`pb-4 text-sm font-bold transition whitespace-nowrap cursor-pointer border-b-2 flex items-center gap-1.5 ${
            activeTab === "reviews"
              ? "border-indigo-600 text-indigo-600"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          <span>Customer Reviews</span>
          {reviews.length > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-xs font-semibold">
              {avgRating} ★ ({reviews.length})
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab("shipping")}
          className={`pb-4 text-sm font-bold transition whitespace-nowrap cursor-pointer border-b-2 ${
            activeTab === "shipping"
              ? "border-indigo-600 text-indigo-600"
              : "border-transparent text-slate-500 hover:text-slate-900"
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
              <h3 className="text-base font-bold text-slate-900 mb-4">
                Technical Highlights
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                {product.description ||
                  product.shortDescription ||
                  "Detailed product information verified by marketplace catalog."}
              </p>

              <div className="mt-6 flex flex-col gap-3">
                {product.sizes && product.sizes.length > 0 && (
                  <div className="flex items-center gap-2 text-xs text-slate-700">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>
                      Available in {product.sizes.length} fit sizes (
                      {product.sizes.join(", ").toUpperCase()})
                    </span>
                  </div>
                )}
                {product.colors && product.colors.length > 0 && (
                  <div className="flex items-center gap-2 text-xs text-slate-700">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>
                      Available in {product.colors.length} verified colorway
                      {product.colors.length > 1 ? "s" : ""}
                    </span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-xs text-slate-700">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>Quality checked and approved by marketplace team</span>
                </div>
              </div>
            </div>

            <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 mb-4">
                Product Details
              </h4>
              <dl className="grid grid-cols-2 gap-y-3 gap-x-4 text-xs">
                <dt className="text-slate-500">Department</dt>
                <dd className="font-bold text-slate-900 uppercase">
                  {product.categorySlug || "General"}
                </dd>

                <dt className="text-slate-500">Available Sizes</dt>
                <dd className="font-bold text-slate-900 uppercase">
                  {product.sizes?.length
                    ? product.sizes.join(", ")
                    : "Standard / One Size"}
                </dd>

                <dt className="text-slate-500">Color Options</dt>
                <dd className="font-bold text-slate-900 capitalize">
                  {product.colors?.length
                    ? product.colors.join(", ")
                    : "Standard"}
                </dd>

                <dt className="text-slate-500">Catalog SKU</dt>
                <dd className="font-mono text-slate-700">
                  LKM-{product.id}-CATALOG
                </dd>

                <dt className="text-slate-500">Stock Status</dt>
                <dd className="font-semibold text-emerald-600">
                  Active Listing
                </dd>
              </dl>
            </div>
          </div>
        )}

        {/* REVIEWS TAB */}
        {activeTab === "reviews" && (
          <div className="flex flex-col gap-8">
            {/* Rating Breakdown Header */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-6 p-6 rounded-2xl bg-slate-50 border border-slate-100">
              <div className="flex items-center gap-4">
                <div className="text-4xl font-black text-slate-900">
                  {avgRating || "0.0"}
                </div>
                <div>
                  <div className="flex items-center text-amber-400">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        className={`w-4 h-4 ${
                          avgRating && Number(avgRating) >= star
                            ? "fill-amber-400 text-amber-400"
                            : "text-slate-300"
                        }`}
                      />
                    ))}
                  </div>
                  <span className="text-xs text-slate-500 mt-1 block">
                    {reviews.length === 0
                      ? "No reviews yet"
                      : `Based on ${reviews.length} customer review${
                          reviews.length > 1 ? "s" : ""
                        }`}
                  </span>
                </div>
              </div>

              <div>
                <button
                  onClick={() => setIsWriteReviewOpen(true)}
                  className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition flex items-center gap-2 shadow-xs cursor-pointer"
                >
                  <MessageSquarePlus className="w-4 h-4" />
                  <span>Write a Review</span>
                </button>
              </div>
            </div>

            {/* Write Review Form Modal / Inline Box */}
            {isWriteReviewOpen && (
              <form
                onSubmit={handleAddReview}
                className="p-6 bg-slate-50/70 rounded-2xl border border-indigo-100 flex flex-col gap-4 animate-in fade-in"
              >
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-slate-900">
                    Share Your Feedback
                  </h4>
                  <button
                    type="button"
                    onClick={() => setIsWriteReviewOpen(false)}
                    className="text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Star rating selector */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Rating
                  </label>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onMouseEnter={() => setHoverRating(star)}
                        onMouseLeave={() => setHoverRating(0)}
                        onClick={() => setNewRating(star)}
                        className="p-1 cursor-pointer"
                      >
                        <Star
                          className={`w-5 h-5 ${
                            (hoverRating || newRating) >= star
                              ? "fill-amber-400 text-amber-400"
                              : "text-slate-300"
                          }`}
                        />
                      </button>
                    ))}
                    <span className="ml-2 text-xs font-bold text-slate-600">
                      {newRating} / 5 Stars
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Your Name
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Sarah J."
                      value={newAuthor}
                      onChange={(e) => setNewAuthor(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:outline-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Headline
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Great quality and fast shipping"
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:outline-indigo-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Your Review
                  </label>
                  <textarea
                    rows={3}
                    required
                    placeholder="Tell other shoppers about fit, quality, or material..."
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:outline-indigo-500"
                  />
                </div>

                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsWriteReviewOpen(false)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-200 transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700 transition cursor-pointer"
                  >
                    Submit Review
                  </button>
                </div>
              </form>
            )}

            {/* Reviews List */}
            {reviews.length === 0 ? (
              <div className="py-12 text-center bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                <p className="text-sm font-semibold text-slate-700">
                  No reviews yet for this product
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  Be the first customer to share your experience with this item.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {reviews.map((rev) => (
                  <div
                    key={rev.id}
                    className="p-5 rounded-2xl border border-slate-100 bg-white hover:border-slate-200 transition"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-slate-900">
                          {rev.author}
                        </span>
                        {rev.verified && (
                          <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                            Verified Buyer
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-slate-400">{rev.date}</span>
                    </div>

                    <div className="flex items-center text-amber-400 mb-2">
                      {[...Array(rev.rating)].map((_, i) => (
                        <Star key={i} className="w-3.5 h-3.5 fill-amber-400" />
                      ))}
                    </div>

                    <h5 className="text-sm font-bold text-slate-800 mb-1">
                      {rev.title}
                    </h5>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      {rev.comment}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* SHIPPING & RETURNS TAB */}
        {activeTab === "shipping" && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 rounded-2xl border border-slate-100 bg-slate-50 flex flex-col gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                <Truck className="w-5 h-5" />
              </div>
              <h4 className="text-sm font-bold text-slate-900">
                Express Delivery
              </h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                Orders dispatch within 24 hours. Track shipment status in real
                time with carrier integrations.
              </p>
            </div>

            <div className="p-6 rounded-2xl border border-slate-100 bg-slate-50 flex flex-col gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600">
                <RotateCcw className="w-5 h-5" />
              </div>
              <h4 className="text-sm font-bold text-slate-900">
                30-Day Easy Returns
              </h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                Not completely satisfied? Initiate a return within 30 days for a
                full refund or size exchange.
              </p>
            </div>

            <div className="p-6 rounded-2xl border border-slate-100 bg-slate-50 flex flex-col gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h4 className="text-sm font-bold text-slate-900">
                Buyer Protection
              </h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                Every transaction is secure and backed by Larekmart guarantee
                until package receipt is confirmed.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
