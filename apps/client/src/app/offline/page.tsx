"use client";

import Link from "next/link";
import { WifiOff, RefreshCw, ShoppingBag } from "lucide-react";

export default function OfflinePage() {
  return (
    <main className="min-h-[70vh] flex items-center justify-center px-4 py-16">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="w-20 h-20 mx-auto rounded-full bg-amber-500/10 dark:bg-amber-500/20 flex items-center justify-center text-amber-500">
          <WifiOff className="w-10 h-10 animate-pulse" />
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
            You are currently offline
          </h1>
          <p className="text-slate-600 dark:text-slate-400 text-sm">
            It looks like your internet connection is down. Don&apos;t worry — your saved cart items
            are safe in your local storage.
          </p>
        </div>

        <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={() => window.location.reload()}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm transition-colors shadow-sm"
          >
            <RefreshCw className="w-4 h-4" />
            Retry Connection
          </button>
          <Link
            href="/cart"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 font-medium text-sm transition-colors"
          >
            <ShoppingBag className="w-4 h-4" />
            View Saved Cart
          </Link>
        </div>
      </div>
    </main>
  );
}
