import { auth } from "@clerk/nextjs/server";
import CacheStatsTable from "@/components/CacheStatsTable";
import {
  getCacheServiceTargets,
  readServiceCacheStats,
} from "@/lib/cache-stats";

/**
 * Counters must be read live on every visit, never prerendered at build time
 * (the services are not running during `next build`).
 */
export const dynamic = "force-dynamic";

const CachePage = async () => {
  const { getToken } = await auth();
  const token = await getToken();

  const stats = await Promise.all(
    getCacheServiceTargets().map((target) =>
      readServiceCacheStats(target, token),
    ),
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="mb-2 px-4 py-2 bg-secondary rounded-md">
        <h1 className="font-semibold">Cache Performance</h1>
        <p className="text-xs text-muted-foreground">
          Redis hit, miss, and error counters reported by each service through
          @repo/monitoring, scraped from its <code>/metrics</code> endpoint. The
          error rate is the share of reads that failed because Redis was
          unreachable — it should be 0% for every service, so a non-zero value
          means that service is not reaching the cache.
        </p>
      </div>
      <CacheStatsTable stats={stats} />
    </div>
  );
};

export default CachePage;
