"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sparkles,
  ArrowRight,
  Clock,
  Zap,
  AlertCircle,
  Database,
} from "lucide-react";
import type { RecommendationResponseType } from "@repo/types";

export default function RecommendationTester() {
  const [strategyType, setStrategyType] = useState<string>("trending");
  const [userId, setUserId] = useState<string>("user_sample_123");
  const [productId, setProductId] = useState<string>("101");
  const [categorySlug, setCategorySlug] = useState<string>("clothing");
  const [limit, setLimit] = useState<string>("6");
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RecommendationResponseType | null>(null);

  const serviceUrl =
    process.env.NEXT_PUBLIC_RECOMMENDATION_SERVICE_URL ||
    process.env.NEXT_PUBLIC_API_GATEWAY_URL ||
    "http://localhost:8090";

  const handleTest = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      let endpoint = "";
      if (strategyType === "personalized") {
        if (!userId)
          throw new Error(
            "Please enter a User ID for personalized recommendations",
          );
        endpoint = `${serviceUrl}/api/v1/recommendations/personalized?userId=${encodeURIComponent(userId)}&limit=${limit}`;
      } else if (strategyType === "similar") {
        if (!productId)
          throw new Error(
            "Please enter a Product ID for similar recommendations",
          );
        endpoint = `${serviceUrl}/api/v1/recommendations/similar/${encodeURIComponent(productId)}?limit=${limit}`;
      } else if (strategyType === "fbt") {
        if (!productId)
          throw new Error(
            "Please enter a Product ID for frequently bought together",
          );
        endpoint = `${serviceUrl}/api/v1/recommendations/frequently-bought-together/${encodeURIComponent(productId)}?limit=${limit}`;
      } else if (strategyType === "category") {
        if (!categorySlug)
          throw new Error(
            "Please enter a Category Slug for category recommendations",
          );
        endpoint = `${serviceUrl}/api/v1/recommendations/category/${encodeURIComponent(categorySlug)}?limit=${limit}`;
      } else if (strategyType === "recently_viewed") {
        if (!userId)
          throw new Error(
            "Please enter a User ID for recently viewed recommendations",
          );
        endpoint = `${serviceUrl}/api/v1/recommendations/recently-viewed?userId=${encodeURIComponent(userId)}&limit=${limit}`;
      } else if (strategyType === "trending") {
        endpoint = `${serviceUrl}/api/v1/recommendations/trending?limit=${limit}`;
      } else if (strategyType === "popular") {
        endpoint = `${serviceUrl}/api/v1/recommendations/popular?limit=${limit}`;
      }

      const res = await fetch(endpoint, {
        headers: { "Content-Type": "application/json" },
      });

      if (!res.ok) {
        throw new Error(
          `Recommendation Service responded with HTTP ${res.status}`,
        );
      }

      const data: RecommendationResponseType = await res.json();
      setResult(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border border-border shadow-sm">
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className="p-2 bg-primary/10 text-primary rounded-lg">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="text-lg font-semibold">
              Live Recommendation Tester
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Simulate candidate generation, hybrid re-ranking, and fallback
              cascades in real-time.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">
              Strategy Type
            </label>
            <Select value={strategyType} onValueChange={setStrategyType}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select strategy" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="trending">Trending (Time-Decay)</SelectItem>
                <SelectItem value="popular">Popular (Global)</SelectItem>
                <SelectItem value="personalized">
                  Personalized (Hybrid User)
                </SelectItem>
                <SelectItem value="similar">
                  Similar Products (pgvector)
                </SelectItem>
                <SelectItem value="fbt">Frequently Bought Together</SelectItem>
                <SelectItem value="category">Category Filtered</SelectItem>
                <SelectItem value="recently_viewed">Recently Viewed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {(strategyType === "personalized" ||
            strategyType === "recently_viewed") && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">
                User ID
              </label>
              <Input
                placeholder="e.g. user_sample_123"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
              />
            </div>
          )}

          {(strategyType === "similar" || strategyType === "fbt") && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">
                Product ID
              </label>
              <Input
                type="number"
                placeholder="e.g. 101"
                value={productId}
                onChange={(e) => setProductId(e.target.value)}
              />
            </div>
          )}

          {strategyType === "category" && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">
                Category Slug
              </label>
              <Input
                placeholder="e.g. clothing"
                value={categorySlug}
                onChange={(e) => setCategorySlug(e.target.value)}
              />
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">Limit</label>
            <Select value={limit} onValueChange={setLimit}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Limit" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="4">4 candidates</SelectItem>
                <SelectItem value="6">6 candidates</SelectItem>
                <SelectItem value="10">10 candidates</SelectItem>
                <SelectItem value="20">20 candidates</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-end">
            <Button
              className="w-full gap-2 cursor-pointer"
              onClick={handleTest}
              disabled={loading}
            >
              {loading ? (
                <>Processing...</>
              ) : (
                <>
                  <Zap className="h-4 w-4" /> Run Inference
                </>
              )}
            </Button>
          </div>
        </div>

        {error && (
          <div className="p-3 bg-destructive/10 text-destructive text-sm rounded-md flex items-center gap-2">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {result && (
          <div className="space-y-4 pt-2 border-t border-border">
            {/* Metadata Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-muted/50 rounded-lg text-xs">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="font-mono bg-background">
                  Type: {result.type}
                </Badge>
                <Badge variant="secondary" className="font-mono">
                  Strategy: {result.metadata.strategy}
                </Badge>
                {Boolean(
                  result.metadata.fallbackUsed ??
                    (result.metadata as Record<string, unknown>).fallback_used,
                ) && (
                  <Badge variant="destructive" className="font-mono">
                    Fallback Cascade Used
                  </Badge>
                )}
                {result.metadata.cached ? (
                  <Badge
                    variant="default"
                    className="bg-emerald-600 hover:bg-emerald-700 font-mono"
                  >
                    Redis Cache Hit
                  </Badge>
                ) : (
                  <Badge
                    variant="outline"
                    className="font-mono text-muted-foreground"
                  >
                    Cache Miss
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-3 text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  {Number(
                    result.metadata.executionTimeMs ??
                      (result.metadata as Record<string, unknown>)
                        .execution_time_ms ??
                      0,
                  )}{" "}
                  ms
                </span>
                <span className="flex items-center gap-1">
                  <Database className="h-3.5 w-3.5" />
                  {result.items.length} items
                </span>
              </div>
            </div>

            {/* Candidate Items Grid */}
            {result.items.length === 0 ? (
              <div className="text-center py-6 text-sm text-muted-foreground">
                No recommendation candidates returned for this query.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {result.items.map((item, idx) => {
                  const rawItem = item as unknown as Record<string, unknown>;
                  const resolvedProductId = Number(
                    item.productId ?? rawItem.product_id ?? 0,
                  );
                  const resolvedCategory = String(
                    item.categorySlug ?? rawItem.category_slug ?? "",
                  );
                  return (
                    <div
                      key={`${resolvedProductId}-${idx}`}
                      className="p-3 border rounded-lg bg-card hover:bg-accent/5 transition-colors space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-sm">
                          Product #{resolvedProductId}
                        </span>
                        <Badge
                          variant="outline"
                          className="text-xs font-mono font-medium"
                        >
                          {(item.score * 100).toFixed(1)}% match
                        </Badge>
                      </div>

                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {item.reason}
                      </p>

                      <div className="flex items-center justify-between pt-1 border-t border-border/50 text-xs">
                        <span className="text-muted-foreground">
                          {resolvedCategory
                            ? `Category: ${resolvedCategory}`
                            : "Global"}
                        </span>
                        <span className="text-primary flex items-center gap-0.5 text-[11px] font-medium">
                          Rank #{idx + 1}
                          <ArrowRight className="h-3 w-3" />
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
