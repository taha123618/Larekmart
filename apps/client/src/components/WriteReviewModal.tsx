"use client";

import React, { useState } from "react";
import { Star, X, UploadCloud, AlertCircle, Loader2 } from "lucide-react";
import { useAuth } from "@clerk/nextjs";
import { toast } from "react-toastify";
import Image from "next/image";
import { submitProductReview } from "@/services/review.service";
import {
  uploadReviewPhoto,
  type ReviewMediaUploadResult,
} from "@/services/media.service";

interface WriteReviewModalProps {
  productId: string;
  isOpen: boolean;
  onClose: () => void;
  onReviewSubmitted: () => void;
}

export default function WriteReviewModal({
  productId,
  isOpen,
  onClose,
  onReviewSubmitted,
}: WriteReviewModalProps) {
  const { isSignedIn, getToken } = useAuth();

  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [mediaList, setMediaList] = useState<ReviewMediaUploadResult[]>([]);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (!isSignedIn) {
      toast.info("Please sign in to upload review attachments.");
      return;
    }

    const file = files[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Only image attachments (JPEG, PNG, WebP) are allowed.");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error("Image file size must be under 10MB.");
      return;
    }

    setIsUploadingPhoto(true);
    try {
      const uploaded = await uploadReviewPhoto(file, productId, getToken);
      setMediaList((prev) => [...prev, uploaded]);
      toast.success("Photo attached successfully!");
    } catch (err: unknown) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Failed to upload photo attachment.",
      );
    } finally {
      setIsUploadingPhoto(false);
      e.target.value = "";
    }
  };

  const handleRemovePhoto = (index: number) => {
    setMediaList((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!isSignedIn) {
      setErrorMessage("You must be signed in to submit a review.");
      return;
    }

    if (!title.trim() || !content.trim()) {
      setErrorMessage("Please fill in both a headline and review details.");
      return;
    }

    setIsSubmitting(true);
    try {
      const token = await getToken();
      await submitProductReview(
        productId,
        {
          rating,
          title: title.trim(),
          content: content.trim(),
          media: mediaList.map((m, idx) => ({
            mediaId: m.mediaId,
            mediaUrl: m.mediaUrl,
            mediaType: m.mediaType,
            displayOrder: idx,
          })),
        },
        token,
      );

      toast.success("Thank you! Your verified review has been submitted.");
      onReviewSubmitted();
      onClose();
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to submit review.";
      setErrorMessage(msg);
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
      <div className="relative w-full max-w-xl max-h-[90vh] overflow-y-auto bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 sm:p-8">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h3 className="text-lg font-black text-slate-900 dark:text-white">
              Write a Product Review
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Only verified buyers who received this item can submit feedback.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error message alert */}
        {errorMessage && (
          <div className="mt-4 p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
            <div className="text-xs text-rose-700 dark:text-rose-300 font-medium leading-relaxed">
              {errorMessage}
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-5">
          {/* Rating picker */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-2">
              Overall Rating
            </label>
            <div className="flex items-center gap-1.5">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  onClick={() => setRating(star)}
                  className="p-1 text-slate-300 dark:text-slate-700 hover:scale-110 transition cursor-pointer"
                >
                  <Star
                    className={`w-7 h-7 ${
                      (hoverRating || rating) >= star
                        ? "fill-amber-400 text-amber-400"
                        : "text-slate-300 dark:text-slate-700"
                    }`}
                  />
                </button>
              ))}
              <span className="ml-3 text-sm font-bold text-slate-700 dark:text-slate-300">
                {rating} of 5 Stars
              </span>
            </div>
          </div>

          {/* Title input */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
              Review Headline
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Exceptional build quality, fits true to size"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-indigo-500 transition"
            />
          </div>

          {/* Written feedback textarea */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
              Written Feedback
            </label>
            <textarea
              rows={4}
              required
              placeholder="Share details about comfort, material, performance, or sizing..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full px-4 py-3 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-indigo-500 transition"
            />
          </div>

          {/* Photo upload section */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
              Add Photos (Optional)
            </label>
            <div className="flex flex-wrap gap-3 items-center">
              {mediaList.map((media, idx) => (
                <div
                  key={media.mediaId}
                  className="relative w-16 h-16 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 group"
                >
                  <Image
                    src={media.mediaUrl}
                    alt={`Attachment ${idx + 1}`}
                    fill
                    className="object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemovePhoto(idx)}
                    className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}

              {mediaList.length < 5 && (
                <label className="w-16 h-16 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-indigo-500 flex flex-col items-center justify-center text-slate-400 hover:text-indigo-500 transition cursor-pointer">
                  {isUploadingPhoto ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <UploadCloud className="w-5 h-5" />
                      <span className="text-[9px] font-bold mt-0.5">
                        Upload
                      </span>
                    </>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    disabled={isUploadingPhoto}
                    onChange={handlePhotoUpload}
                    className="hidden"
                  />
                </label>
              )}
            </div>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1.5">
              Attach up to 5 real photos of the product. Images are processed
              securely.
            </p>
          </div>

          {/* Footer buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-5 py-2.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white transition flex items-center gap-2 shadow-xs cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Submitting...</span>
                </>
              ) : (
                <span>Publish Review</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
