import { auth } from "@clerk/nextjs/server";
import type { StrategyMetricType } from "@repo/types";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import RecommendationTester from "@/components/RecommendationTester";
import {
  Sparkles,
  Layers,
  Cpu,
  TrendingUp,
  MousePointerClick,
  ShoppingCart,
  Percent,
} from "lucide-react";
import { getApiGatewayUrl } from "@/services/gateway.service";

export const dynamic = "force-dynamic";

async function fetchStrategyMetrics(
  token: string | null,
): Promise<StrategyMetricType[]> {
  const serviceUrl = getApiGatewayUrl();

  try {
    const res = await fetch(`${serviceUrl}/api/v1/analytics/metrics`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      cache: "no-store",
    });

    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

async function checkEngineHealth(): Promise<boolean> {
  const serviceUrl = getApiGatewayUrl();
  try {
    const res = await fetch(`${serviceUrl}/health/live`, {
      cache: "no-store",
      signal: AbortSignal.timeout(2000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export default async function RecommendationsPage() {
  const { getToken } = await auth();
  const token = await getToken();
  const [metrics, isEngineOnline] = await Promise.all([
    fetchStrategyMetrics(token),
    checkEngineHealth(),
  ]);

  const totalImpressions = metrics.reduce((acc, m) => acc + m.impressions, 0);
  const totalClicks = metrics.reduce((acc, m) => acc + m.clicks, 0);
  const totalConversions = metrics.reduce((acc, m) => acc + m.conversions, 0);
  const overallCtr =
    totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
  const overallConvRate =
    totalClicks > 0 ? (totalConversions / totalClicks) * 100 : 0;

  return (
    <div className="flex flex-col gap-6">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 bg-gradient-to-r from-secondary via-secondary/80 to-background rounded-xl border border-border">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight">
              AI Recommendations & Personalization
            </h1>
            <Badge
              variant="outline"
              className="bg-primary/10 text-primary border-primary/20"
            >
              Port 8008
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground max-w-2xl">
            Real-time hybrid recommendation platform powered by pgvector
            128-dimensional dense embeddings, collaborative filtering,
            exponential time-decay trending, and multi-tier cold-start
            fallbacks.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs">
          {isEngineOnline ? (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 font-medium">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              Engine Active
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 text-amber-600 font-medium">
              <span className="relative flex h-2 w-2">
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
              </span>
              Engine Standby
            </div>
          )}
        </div>
      </div>

      {/* Metric Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border border-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Total Impressions
            </CardTitle>
            <Layers className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {totalImpressions.toLocaleString()}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Storefront recommendations displayed
            </p>
          </CardContent>
        </Card>

        <Card className="border border-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Recommendation Clicks
            </CardTitle>
            <MousePointerClick className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {totalClicks.toLocaleString()}
            </div>
            <div className="flex items-center gap-1 text-[11px] text-muted-foreground mt-1">
              <span className="text-primary font-medium">
                {overallCtr.toFixed(2)}%
              </span>{" "}
              avg CTR
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Attributed Conversions
            </CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {totalConversions.toLocaleString()}
            </div>
            <div className="flex items-center gap-1 text-[11px] text-muted-foreground mt-1">
              <span className="text-emerald-600 font-medium">
                {overallConvRate.toFixed(2)}%
              </span>{" "}
              conversion rate
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Strategy Hybrid Blend
            </CardTitle>
            <Percent className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">5 Models</div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Collab (35%) • Content (25%) • Vector (20%)
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Interactive Testing Playground */}
      <RecommendationTester />

      {/* Strategy Performance Table */}
      <Card className="border border-border">
        <CardHeader>
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            <div>
              <CardTitle className="text-base font-semibold">
                Strategy Performance Attribution
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Live performance telemetry aggregated by strategy algorithm.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {metrics.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              No strategy telemetry recorded yet. Telemetry will automatically
              record as customers browse and purchase on the storefront.
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Strategy</TableHead>
                    <TableHead className="text-right">Impressions</TableHead>
                    <TableHead className="text-right">Clicks</TableHead>
                    <TableHead className="text-right">CTR (%)</TableHead>
                    <TableHead className="text-right">Conversions</TableHead>
                    <TableHead className="text-right">Conv. Rate (%)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {metrics.map((row) => (
                    <TableRow key={row.strategy}>
                      <TableCell className="font-medium capitalize">
                        <Badge variant="outline" className="font-mono text-xs">
                          {row.strategy.replace("_", " ")}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {row.impressions.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        {row.clicks.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {(row.ctr * 100).toFixed(2)}%
                      </TableCell>
                      <TableCell className="text-right">
                        {row.conversions.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right font-semibold text-emerald-600">
                        {(row.conversion_rate * 100).toFixed(2)}%
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Engine Architecture Details */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border border-border">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Cpu className="h-4 w-4 text-primary" />
              <CardTitle className="text-sm font-semibold">
                pgvector Embeddings
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground space-y-2">
            <p>
              128-dimensional dense vector embeddings generated via Scikit-learn
              feature hashing vectorizer with L2 normalization.
            </p>
            <div className="flex flex-wrap gap-1 pt-1">
              <Badge variant="secondary" className="text-[10px]">
                Distance: Cosine (&lt;=&gt;)
              </Badge>
              <Badge variant="secondary" className="text-[10px]">
                Dim: 128
              </Badge>
              <Badge variant="secondary" className="text-[10px]">
                HNSW Index
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <CardTitle className="text-sm font-semibold">
                Cold-Start Cascade
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground space-y-2">
            <p>
              Multi-tier fallback protects response latency: if user has no
              interaction history, recommendations gracefully degrade without
              breaking.
            </p>
            <div className="text-[11px] font-mono text-foreground bg-muted p-2 rounded">
              Personalized ➔ Category ➔ Similar ➔ Trending ➔ Popular
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-primary" />
              <CardTitle className="text-sm font-semibold">
                Event Ingestion
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground space-y-2">
            <p>
              Asynchronous Kafka consumers process catalog events and purchase
              events with strict idempotency via <code>processed_events</code>.
            </p>
            <div className="flex flex-wrap gap-1 pt-1">
              <Badge variant="secondary" className="text-[10px]">
                product.created
              </Badge>
              <Badge variant="secondary" className="text-[10px]">
                payment.successful
              </Badge>
              <Badge variant="secondary" className="text-[10px]">
                product.viewed
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
