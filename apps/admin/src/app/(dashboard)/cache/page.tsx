import { auth } from "@clerk/nextjs/server";
import CacheStatsTable from "@/components/CacheStatsTable";
import {
  getCacheServiceTargets,
  readServiceCacheStats,
} from "@/lib/cache-stats";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Badge } from "@/components/ui/badge";
import { Database } from "lucide-react";

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
      {/* Breadcrumb Navigation */}
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/">Dashboard</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink href="/cache">Platform & Infrastructure</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Redis Cache & Telemetry</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Database className="h-6 w-6 text-primary" />
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Cache Performance & Operations</h1>
            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
              Redis Sentinel
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Redis hit, miss, and error counters reported by each service through
            @repo/monitoring, scraped from its <code>/metrics</code> endpoint. The
            error rate is the share of reads that failed because Redis was
            unreachable — it should be 0% for every service.
          </p>
        </div>
      </div>
      <CacheStatsTable stats={stats} />
    </div>
  );
};

export default CachePage;
