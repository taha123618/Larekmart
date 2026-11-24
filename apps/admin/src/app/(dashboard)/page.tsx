import { Suspense } from "react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import AnalyticsSummaryCards from "@/components/AnalyticsSummaryCards";
import AppAreaChart from "@/components/AppAreaChart";
import AppBarChart from "@/components/AppBarChart";
import AppPieChart from "@/components/AppPieChart";
import CardList from "@/components/CardList";
import TodoList from "@/components/TodoList";
import { auth } from "@clerk/nextjs/server";
import { getApiGatewayUrl } from "@/services/gateway.service";
import {
  fetchAnalyticsSummary,
  fetchDailyAnalyticsChart,
} from "@/services/analytics.service";
import type { OrderChartType } from "@repo/types";

export const dynamic = "force-dynamic";

function SummaryCardsSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6 gap-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="p-4 rounded-xl border border-border/60 bg-card space-y-3"
        >
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-8 rounded-lg" />
          </div>
          <Skeleton className="h-7 w-20" />
          <Skeleton className="h-3 w-32" />
        </div>
      ))}
    </div>
  );
}

function ChartSkeleton({ title }: { title: string }) {
  return (
    <div>
      <h1 className="text-lg font-medium mb-6 text-muted-foreground/60">
        {title}
      </h1>
      <Skeleton className="h-[200px] w-full rounded-xl" />
    </div>
  );
}

function CardListSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-5 w-36 mb-6" />
      <div className="flex flex-col gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 p-4 rounded-xl border border-border/60 bg-card"
          >
            <Skeleton className="w-12 h-12 rounded-sm shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const Homepage = async () => {
  const { getToken } = await auth();
  const token = await getToken();

  const gatewayUrl = getApiGatewayUrl();
  const orderUrl = gatewayUrl;

  const orderChartData = fetch(`${orderUrl}/api/v1/order-chart`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    next: { revalidate: 30 },
  })
    .then(async (response) => {
      if (!response.ok) {
        // Fallback to legacy prefix if needed
        const fallbackRes = await fetch(`${orderUrl}/order-chart`, {
          headers: { Authorization: `Bearer ${token}` },
          next: { revalidate: 30 },
        });
        if (fallbackRes.ok) {
          return (await fallbackRes.json()) as OrderChartType[];
        }
        return [] as OrderChartType[];
      }
      return (await response.json()) as OrderChartType[];
    })
    .catch(() => [] as OrderChartType[]);

  const dailyAnalyticsData = fetchDailyAnalyticsChart(7, token);
  const summaryAnalyticsData = fetchAnalyticsSummary(token);

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
            <BreadcrumbPage>Executive Overview</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Modern Dashboard Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
              Executive Management Overview
            </h1>
            <Badge
              variant="outline"
              className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
            >
              Live Telemetry
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Real-time multi-tenant marketplace monitoring across storefront, sellers, logistics, and Kafka event pipelines.
          </p>
        </div>
      </div>

      {/* Real-time KPI Metric Summary Cards from Analytic Service */}
      <Suspense fallback={<SummaryCardsSkeleton />}>
        <AnalyticsSummaryCards summaryPromise={summaryAnalyticsData} />
      </Suspense>

      {/* Analytical Charts & Activity Stream */}
      <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-4 gap-4">
        <div className="bg-card text-card-foreground border border-border/60 p-4 rounded-xl shadow-xs lg:col-span-2 xl:col-span-1 2xl:col-span-2">
          <Suspense
            fallback={<ChartSkeleton title="Order Volume & Fulfillment" />}
          >
            <AppBarChart dataPromise={orderChartData} />
          </Suspense>
        </div>
        <div className="bg-card text-card-foreground border border-border/60 p-4 rounded-xl shadow-xs">
          <Suspense fallback={<CardListSkeleton />}>
            <CardList title="Latest Transactions" />
          </Suspense>
        </div>
        <div className="bg-card text-card-foreground border border-border/60 p-4 rounded-xl shadow-xs">
          <Suspense
            fallback={<ChartSkeleton title="Platform Distribution" />}
          >
            <AppPieChart summaryPromise={summaryAnalyticsData} />
          </Suspense>
        </div>
        <div className="bg-card text-card-foreground border border-border/60 p-4 rounded-xl shadow-xs">
          <TodoList />
        </div>
        <div className="bg-card text-card-foreground border border-border/60 p-4 rounded-xl shadow-xs lg:col-span-2 xl:col-span-1 2xl:col-span-2">
          <Suspense
            fallback={<ChartSkeleton title="Daily Growth & Orders" />}
          >
            <AppAreaChart dataPromise={dailyAnalyticsData} />
          </Suspense>
        </div>
        <div className="bg-card text-card-foreground border border-border/60 p-4 rounded-xl shadow-xs">
          <Suspense fallback={<CardListSkeleton />}>
            <CardList title="Popular Products" />
          </Suspense>
        </div>
      </div>
    </div>
  );
};

export default Homepage;
