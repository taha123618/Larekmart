"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log error to console for debugging
    console.error("Admin Dashboard Error Boundary Caught:", error);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-card text-card-foreground rounded-2xl shadow-xl border border-border/60 p-8 text-center space-y-6">
        <div className="mx-auto w-16 h-16 rounded-full bg-rose-500/10 flex items-center justify-center text-rose-600 dark:text-rose-400 border border-rose-500/20">
          <AlertTriangle className="w-8 h-8" />
        </div>

        <div>
          <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
            Runtime Error
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-foreground mt-3">
            Something went wrong
          </h1>
          <p className="text-sm text-muted-foreground mt-2">
            An error occurred while loading this dashboard view. Downstream
            microservices or network connections may be temporarily recovering.
          </p>
          {error.message && (
            <div className="mt-3 p-3 rounded-lg bg-muted/60 border border-border/60 text-left">
              <p className="font-mono text-xs text-muted-foreground break-all">
                {error.message}
              </p>
            </div>
          )}
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <Button
            onClick={() => reset()}
            className="w-full sm:w-auto rounded-xl flex items-center gap-2 cursor-pointer shadow-xs"
          >
            <RefreshCw className="w-4 h-4" />
            Try Again
          </Button>
          <Button
            asChild
            variant="outline"
            className="w-full sm:w-auto rounded-xl border-border/60 cursor-pointer"
          >
            <Link href="/" className="flex items-center gap-2">
              <Home className="w-4 h-4" />
              Overview
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
