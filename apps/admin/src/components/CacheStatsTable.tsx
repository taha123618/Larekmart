import { Database, Gauge } from "lucide-react";
import {
  errorRateOf,
  hitRateOf,
  rankByErrorRate,
  type ServiceCacheStats,
} from "@/lib/cache-stats";
import { Badge } from "./ui/badge";
import { Card } from "./ui/card";
import { Progress } from "./ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";

const percent = (rate: number | null): string =>
  rate === null ? "—" : `${(rate * 100).toFixed(1)}%`;

const count = (value: number): string => value.toLocaleString();

/**
 * Colours for the Redis error rate. Unlike the hit rate, any non-zero value is
 * an outage signal rather than a quality score, so it is called out instead of
 * being left to blend into the card's muted grey text.
 */
const errorRateTone = (rate: number | null): string => {
  if (rate === null || rate === 0) return "text-muted-foreground";
  return rate >= 0.5
    ? "text-destructive font-semibold"
    : "text-amber-600 dark:text-amber-500 font-medium";
};

export const CacheStatsTable = ({ stats }: { stats: ServiceCacheStats[] }) => {
  const totals = stats.reduce(
    (acc, service) => ({
      hits: acc.hits + service.hits,
      misses: acc.misses + service.misses,
      errors: acc.errors + service.errors,
    }),
    { hits: 0, misses: 0, errors: 0 },
  );

  const overallRate = hitRateOf(totals.hits, totals.misses);
  const overallErrorRate = errorRateOf(
    totals.hits,
    totals.misses,
    totals.errors,
  );

  const rankedStats = rankByErrorRate(stats);

  const rows = stats.flatMap((service) =>
    service.types.map((type) => ({
      service: service.service,
      ...type,
      hitRate: hitRateOf(type.hits, type.misses),
      errorRate: errorRateOf(type.hits, type.misses, type.errors),
    })),
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 w-full">
        {rankedStats.map((service) => (
          <Card
            key={service.service}
            className="p-4 flex flex-col justify-between"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">
                {service.service}
              </span>
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Database className="h-4 w-4 text-blue-500" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-bold">
                {percent(service.hitRate)}
              </div>
              <p className="text-xs text-muted-foreground">hit rate</p>
              {service.reachable ? (
                <>
                  <Progress
                    className="mt-3"
                    value={service.hitRate === null ? 0 : service.hitRate * 100}
                  />
                  <div className="mt-3 flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">
                      Redis error rate
                    </span>
                    <span className={errorRateTone(service.errorRate)}>
                      {percent(service.errorRate)}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {count(service.hits)} hits · {count(service.misses)} misses
                    {service.errors > 0 && ` · ${count(service.errors)} errors`}
                  </p>
                </>
              ) : (
                <p className="text-xs text-muted-foreground mt-2 flex items-center gap-2">
                  <Badge variant="secondary">unavailable</Badge>
                  <span className="truncate">{service.error}</span>
                </p>
              )}
            </div>
          </Card>
        ))}
      </div>

      <Card className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <h2 className="font-semibold flex items-center gap-2">
            <Gauge className="h-4 w-4" />
            Per-cache breakdown
          </h2>
          <span className="text-xs text-muted-foreground">
            Overall hit rate {percent(overallRate)} ({count(totals.hits)} hits /{" "}
            {count(totals.misses)} misses) · Redis error rate{" "}
            <span className={errorRateTone(overallErrorRate)}>
              {percent(overallErrorRate)}
            </span>
            {totals.errors > 0 && ` (${count(totals.errors)} errors)`}
          </span>
        </div>

        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No cache traffic has been recorded yet. Counters appear once each
            service has served a cached request.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Service</TableHead>
                <TableHead>Cache</TableHead>
                <TableHead className="text-right">Hits</TableHead>
                <TableHead className="text-right">Misses</TableHead>
                <TableHead className="text-right">Redis errors</TableHead>
                <TableHead className="text-right">Hit rate</TableHead>
                <TableHead className="text-right">Error rate</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={`${row.service}-${row.cacheType}`}>
                  <TableCell className="font-medium">{row.service}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{row.cacheType}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {count(row.hits)}
                  </TableCell>
                  <TableCell className="text-right">
                    {count(row.misses)}
                  </TableCell>
                  <TableCell className="text-right">
                    <span className={errorRateTone(row.errorRate)}>
                      {count(row.errors)}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    {percent(row.hitRate)}
                  </TableCell>
                  <TableCell className="text-right">
                    <span className={errorRateTone(row.errorRate)}>
                      {percent(row.errorRate)}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
};

export default CacheStatsTable;
