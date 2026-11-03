"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "react-toastify";
import { useAuth } from "@clerk/nextjs";
import { RefreshCw } from "lucide-react";
import { Button } from "./ui/button";
import type { SearchBackfillResponse } from "@repo/types";
import { getApiGatewayUrl } from "@/services/gateway.service";

/**
 * Upper bound on continuation windows, so a cursor that never advances can't
 * spin forever from the browser.
 */
const MAX_WINDOWS = 50;

/**
 * Runs one bounded backfill window. The endpoint stops on its own time budget
 * and hands back a cursor, so the browser loops rather than holding one long
 * request open.
 */
const runBackfillWindow = async (token: string | null, afterId?: number) => {
  const productServiceUrl = getApiGatewayUrl();
  const res = await fetch(
    `${productServiceUrl}/api/v1/products/backfill-search`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ afterId, batchSize: 200, timeBudgetMs: 20000 }),
    },
  );

  if (!res.ok) {
    throw new Error(
      res.status === 403
        ? "Unauthorized — an admin role is required."
        : "Failed to backfill the search index.",
    );
  }

  return (await res.json()) as SearchBackfillResponse;
};

/**
 * Admin action that republishes the catalog so search-service rebuilds index
 * documents that predate the full `product.created` payload — the ones missing
 * images, sizes, and colors, and therefore their thumbnails and color/size
 * facets. Indexing itself happens asynchronously in search-service.
 */
const BackfillSearchButton = () => {
  const { getToken } = useAuth();
  const [published, setPublished] = useState<number | null>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      const token = await getToken();
      const totals = { processed: 0, published: 0, failed: 0 };
      let afterId: number | undefined;

      for (let window = 0; window < MAX_WINDOWS; window += 1) {
        const result = await runBackfillWindow(token, afterId);

        totals.processed += result.processed;
        totals.published += result.published;
        totals.failed += result.failed;
        setPublished(totals.published);

        if (!result.hasMore || result.nextAfterId === undefined) {
          return totals;
        }

        afterId = result.nextAfterId;
      }

      throw new Error(
        `Stopped after ${MAX_WINDOWS} windows — run it again to continue from product ${afterId}.`,
      );
    },
    onSuccess: (totals) => {
      setPublished(null);
      toast.success(
        `Search index backfill queued ${totals.published} product(s) for reindexing.`,
      );
    },
    onError: (error) => {
      setPublished(null);
      toast.error(error.message);
    },
  });

  return (
    <div className="flex items-center gap-3">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => mutation.mutate()}
        disabled={mutation.isPending}
      >
        <RefreshCw
          className={mutation.isPending ? "animate-spin" : undefined}
        />
        {mutation.isPending
          ? "Rebuilding search index..."
          : "Rebuild search index"}
      </Button>
      {published !== null && (
        <span className="text-xs text-muted-foreground">
          {published} product(s) republished
        </span>
      )}
    </div>
  );
};

export default BackfillSearchButton;
