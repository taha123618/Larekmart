/* eslint-disable @next/next/no-img-element */
"use client";

import React, { useMemo } from "react";
import { motion } from "framer-motion";
import {
  Sparkles,
  Star,
  ArrowUpRight,
  ShieldCheck,
  Truck,
  PackageCheck,
  CheckCircle2,
} from "lucide-react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";

interface Review {
  id?: string;
  name: string;
  role: string;
  quote: string;
  avatar: string;
  initials: string;
  rating: number;
  itemPurchased?: string;
}

interface RawReviewItem {
  id?: string;
  author?: string;
  reviewerName?: string;
  name?: string;
  content?: string;
  comment?: string;
  reviewText?: string;
  avatarUrl?: string;
  rating?: number | string;
  itemPurchased?: string;
  productName?: string;
}

/**
 * Fallback reviews shown when no dynamic approved reviews exist in the database.
 */
const DEFAULT_REVIEWS: Review[] = [
  {
    name: "Alex Rivera",
    role: "Verified Buyer • New York, USA",
    itemPurchased: "Urban Velocity Waterproof Jacket",
    quote:
      "Ordered on Tuesday and it landed on my doorstep by Thursday. Quality and water-repellency are top-notch, exactly as described. The escrow buyer protection gave me complete confidence.",
    avatar:
      "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200",
    initials: "AR",
    rating: 5,
  },
  {
    name: "Sarah Chen",
    role: "Verified Buyer • Toronto, Canada",
    itemPurchased: "CloudGlide Carbon Running Shoes",
    quote:
      "The cushioning and fit are incredible. I took them out for a 10K run the same afternoon. Customer support also answered my tracking enquiry in under 3 minutes.",
    avatar:
      "https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&q=80&w=200",
    initials: "SC",
    rating: 5,
  },
  {
    name: "Marcus Thorne",
    role: "Verified Buyer • London, UK",
    itemPurchased: "Chronograph Titanium Watch",
    quote:
      "I was skeptical ordering luxury goods online, but the authenticity certificate and build quality blew me away. Seamless Stripe checkout and instant confirmation.",
    avatar:
      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=200",
    initials: "MT",
    rating: 5,
  },
  {
    name: "Elena Rodriguez",
    role: "Verified Buyer • Madrid, Spain",
    itemPurchased: "Commuter Roll-Top Backpack",
    quote:
      "Super practical compartments and completely weatherproof material. The 30-day return policy gave me total peace of mind, but I am keeping it forever!",
    avatar:
      "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=200",
    initials: "ER",
    rating: 5,
  },
  {
    name: "David Park",
    role: "Verified Buyer • Seoul, South Korea",
    itemPurchased: "Spatial Sound ANC Headphones",
    quote:
      "Active noise cancellation easily matches brands costing twice as much. Delivery from the overseas warehouse was surprisingly fast with zero customs hassle.",
    avatar:
      "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=200",
    initials: "DP",
    rating: 5,
  },
  {
    name: "Maya Lin",
    role: "Verified Buyer • Sydney, Australia",
    itemPurchased: "Heavyweight Boxy Graphic Tee",
    quote:
      "Thick, durable organic cotton with a modern silhouette that retains its shape after machine washing. Larekmart's flash deals are legitimately unbeatable.",
    avatar:
      "https://images.unsplash.com/photo-1534751516642-a1714f5a5467?auto=format&fit=crop&q=80&w=200",
    initials: "ML",
    rating: 5,
  },
];

/**
 * Fetches admin-approved reviews from the backend.
 */
async function fetchApprovedReviews(): Promise<Review[]> {
  try {
    const { data: body } = await axios.get<{
      success: boolean;
      reviews?: RawReviewItem[];
      data?: { reviews?: RawReviewItem[] };
    }>("/api/reviews/approved", {
      params: { limit: 20 },
      timeout: 3000,
    });

    const rawList: RawReviewItem[] = Array.isArray(body?.reviews)
      ? body.reviews
      : Array.isArray(body?.data?.reviews)
        ? body.data.reviews
        : [];

    if (rawList.length === 0) return [];

    return rawList
      .filter((r) => (r.content || r.comment || r.reviewText || "").trim())
      .map((r) => {
        const reviewerName: string = (
          r.author ||
          r.reviewerName ||
          r.name ||
          "Verified Customer"
        ).trim();
        const initials = reviewerName
          .split(" ")
          .map((n: string) => n[0] ?? "")
          .join("")
          .slice(0, 2)
          .toUpperCase();

        const rawRating =
          typeof r.rating === "number" ? r.rating : Number(r.rating);
        const rating: number = rawRating >= 1 && rawRating <= 5 ? rawRating : 5;

        return {
          id: r.id,
          name: reviewerName,
          role: "Verified Marketplace Buyer",
          itemPurchased: r.itemPurchased || r.productName,
          quote: (r.content || r.comment || r.reviewText || "").trim(),
          avatar:
            r.avatarUrl ||
            `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(reviewerName)}`,
          initials,
          rating,
        };
      });
  } catch {
    return [];
  }
}

export default function Testimonials() {
  const { data: apiReviews = [] } = useQuery<Review[]>({
    queryKey: ["approved-testimonials"],
    queryFn: fetchApprovedReviews,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: false,
  });

  const uniqueReviews = useMemo<Review[]>(() => {
    const source: Review[] =
      apiReviews.length > 0 ? apiReviews : DEFAULT_REVIEWS;
    const seen = new Set<string>();
    const result: Review[] = [];

    for (const item of source) {
      if (!item.quote?.trim()) continue;
      const key = item.id
        ? `id::${item.id}`
        : `${item.name.toLowerCase().trim()}:::${item.quote.toLowerCase().trim().slice(0, 60)}`;
      if (!seen.has(key)) {
        seen.add(key);
        result.push(item);
      }
    }

    return result;
  }, [apiReviews]);

  return (
    <section
      id="testimonials"
      className="w-full my-16 py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden bg-white/40 dark:bg-slate-900/40 rounded-3xl border border-slate-200/80 dark:border-slate-800/80 backdrop-blur-xl"
    >
      {/* Ambient background glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-indigo-500/10 blur-[120px] rounded-full pointer-events-none -z-10" />

      <div className="max-w-7xl mx-auto relative z-10">
        {/* Top Header Row */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-10 lg:mb-14 gap-6">
          <div className="max-w-2xl">
            {/* Section Tag Row */}
            <div className="flex items-center gap-2 mb-4">
              <div className="w-9 h-9 rounded-full border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-center shadow-xs">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{
                    duration: 8,
                    repeat: Infinity,
                    ease: "linear",
                  }}
                >
                  <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                </motion.div>
              </div>

              <div className="px-3 py-1 rounded-full border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-center shadow-xs">
                <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                  Customer Social Proof
                </span>
              </div>
            </div>

            {/* Main Heading */}
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-slate-900 dark:text-white tracking-tight leading-snug">
              Loved by Over 500,000+ Shoppers{" "}
              <br className="hidden sm:inline" />
              <span className="bg-gradient-to-r from-indigo-600 via-purple-600 to-rose-600 dark:from-indigo-400 dark:via-purple-300 dark:to-rose-400 bg-clip-text text-transparent">
                Worldwide Across 120+ Countries
              </span>
            </h2>
          </div>

          <div className="max-w-xs md:text-right pb-1">
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
              Real verified feedback from global buyers shopping for top
              fashion, footwear, electronics, and lifestyle goods.
            </p>
          </div>
        </div>

        {/* Three-Column Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8 items-stretch mb-8">
          {/* Left Column — Stats / Conversion Card */}
          <div className="flex flex-col bg-white dark:bg-slate-900/80 backdrop-blur-xl p-6 sm:p-8 rounded-3xl border border-slate-200/80 dark:border-slate-800/80 shadow-md relative overflow-hidden group">
            {/* Rating Row */}
            <div className="flex items-start gap-3.5 mb-6">
              <div className="flex items-baseline gap-1">
                <span className="text-5xl font-black text-slate-900 dark:text-white leading-none font-mono">
                  4.9
                </span>
                <span className="text-base text-slate-400 font-normal">/5</span>
              </div>
              <div className="pt-1 text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
                Based on{" "}
                <span className="font-bold text-slate-900 dark:text-white">
                  45,000+ verified
                </span>
                <br />
                global customer reviews
              </div>
            </div>

            {/* Rating stars strip */}
            <div className="flex items-center gap-1 text-amber-400 mb-6">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="w-4 h-4 fill-amber-400" />
              ))}
              <span className="text-xs text-slate-500 ml-2 font-medium">
                98% 5-Star Ratings
              </span>
            </div>

            {/* Feature Highlights */}
            <div className="space-y-3.5 mb-8">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 shrink-0">
                  <Truck className="w-4 h-4" />
                </div>
                <span className="text-xs sm:text-sm text-slate-800 dark:text-slate-200 font-medium">
                  99.8% On-time express delivery dispatch
                </span>
              </div>

              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 shrink-0">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <span className="text-xs sm:text-sm text-slate-800 dark:text-slate-200 font-medium">
                  100% Escrow buyer protection guarantee
                </span>
              </div>

              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 shrink-0">
                  <PackageCheck className="w-4 h-4" />
                </div>
                <span className="text-xs sm:text-sm text-slate-800 dark:text-slate-200 font-medium">
                  500,000+ Authentic orders delivered safely
                </span>
              </div>
            </div>

            {/* CTA Block */}
            <div className="mt-auto pt-6 border-t border-slate-100 dark:border-slate-800">
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">
                Ready to find your next favorite item?
              </p>
              <p className="text-sm font-bold text-slate-900 dark:text-white mb-4">
                Shop with $20 off using code LAREK20
              </p>
              <div className="flex items-center gap-2 group/cta">
                <Link
                  href="/products"
                  className="flex-1 py-3 px-5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-xs font-bold rounded-xl transition-all duration-200 active:scale-95 shadow-md shadow-indigo-500/20 text-center"
                >
                  Start Shopping Now
                </Link>
                <Link
                  href="/products"
                  aria-label="Start Shopping Now"
                  className="w-10 h-10 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl flex items-center justify-center transition-all duration-200 shadow-md group-hover/cta:translate-x-0.5 active:scale-95 shrink-0"
                >
                  <ArrowUpRight size={16} />
                </Link>
              </div>
            </div>
          </div>

          {/* Center Column — Customer Spotlight Hero Card */}
          <div className="flex min-h-[420px] lg:h-full">
            <div className="relative w-full h-full rounded-3xl overflow-hidden group shadow-md border border-slate-200/80 dark:border-slate-800/80 flex bg-slate-900">
              <img
                src="https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&q=80&w=1000"
                alt="Happy customer shopping on Larekmart"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
              />

              {/* Tag pill at top of photo */}
              <div className="absolute top-5 left-5 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-950/80 backdrop-blur-md border border-white/10 text-[11px] font-bold text-white">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                VERIFIED BUYER SPOTLIGHT
              </div>

              {/* Seamless gradient overlay */}
              <div className="absolute inset-x-0 bottom-0 h-[65%] bg-gradient-to-t from-black/95 via-black/60 to-transparent pointer-events-none" />

              {/* Caption Overlay */}
              <div className="absolute bottom-6 left-6 right-6 text-white">
                <div className="flex items-center gap-1 text-amber-400 mb-2">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-3.5 h-3.5 fill-amber-400" />
                  ))}
                </div>
                <p className="text-sm sm:text-base font-medium leading-relaxed mb-2 text-white/95">
                  &ldquo;Larekmart is easily the smoothest marketplace I&apos;ve
                  shopped on. Authentic sneakers, lightning-fast delivery, and
                  crystal-clear tracking from checkout to doorstep.&rdquo;
                </p>
                <p className="text-xs text-white/70 font-semibold tracking-wide flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Jessica Taylor — Verified Buyer in San Francisco</span>
                </p>
              </div>
            </div>
          </div>

          {/* Right Column — Smooth Vertical Review Feed */}
          <div className="flex flex-col gap-4 max-h-[520px] overflow-y-auto no-scrollbar pr-1">
            {uniqueReviews.slice(0, 4).map((review, idx) => (
              <div
                key={review.id || idx}
                className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900/80 backdrop-blur-md border border-slate-200/80 dark:border-slate-800/80 shadow-xs hover:border-indigo-500/40 transition-colors"
              >
                <div className="flex items-center justify-between mb-2.5">
                  <div className="flex items-center gap-2.5">
                    <img
                      src={review.avatar}
                      alt={review.name}
                      className="w-8 h-8 rounded-full object-cover border border-slate-200 dark:border-slate-700"
                    />
                    <div>
                      <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1">
                        <span>{review.name}</span>
                        <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {review.role}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center text-amber-400">
                    {[...Array(review.rating)].map((_, i) => (
                      <Star key={i} className="w-3 h-3 fill-amber-400" />
                    ))}
                  </div>
                </div>

                {review.itemPurchased && (
                  <div className="text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold mb-1.5 bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 rounded-md inline-block">
                    Purchased: {review.itemPurchased}
                  </div>
                )}

                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed italic">
                  &ldquo;{review.quote}&rdquo;
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
