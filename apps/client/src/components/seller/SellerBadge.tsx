"use client";

import Link from "next/link";
import { Store, ShieldCheck, Star } from "lucide-react";

interface SellerBadgeProps {
  storeName?: string;
  storeSlug?: string;
  rating?: number;
  isVerified?: boolean;
  className?: string;
}

export function SellerBadge({
  storeName = "Larekmart Official Store",
  storeSlug = "larekmart-official",
  rating = 4.9,
  isVerified = true,
  className = "",
}: SellerBadgeProps) {
  return (
    <div
      className={`inline-flex items-center gap-2 p-2 rounded-lg bg-neutral-100/80 dark:bg-neutral-900/80 border border-neutral-200/80 dark:border-neutral-800 text-xs transition-colors hover:border-indigo-400 dark:hover:border-indigo-500 ${className}`}
    >
      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
        <Store className="h-3.5 w-3.5" />
      </div>

      <div className="flex flex-col">
        <div className="flex items-center gap-1">
          <span className="text-[11px] text-neutral-500 dark:text-neutral-400">
            Sold by
          </span>
          <Link
            href={`/stores/${storeSlug}`}
            className="font-semibold text-neutral-900 dark:text-neutral-100 hover:text-indigo-600 dark:hover:text-indigo-400 underline-offset-2 hover:underline"
          >
            {storeName}
          </Link>
          {isVerified && (
            <span title="Verified Marketplace Merchant">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-500 inline fill-emerald-500/20" />
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 text-[10px] text-neutral-500 dark:text-neutral-400">
          <span className="flex items-center text-amber-500 font-medium">
            <Star className="h-2.5 w-2.5 fill-amber-500 mr-0.5" />
            {rating.toFixed(1)}
          </span>
          <span>•</span>
          <span className="text-emerald-600 dark:text-emerald-400 font-medium">
            98% Positive
          </span>
        </div>
      </div>
    </div>
  );
}
