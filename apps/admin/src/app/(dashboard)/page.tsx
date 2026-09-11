import AnalyticsSummaryCards from "@/components/AnalyticsSummaryCards";
import AppAreaChart from "@/components/AppAreaChart";
import AppBarChart from "@/components/AppBarChart";
import AppPieChart from "@/components/AppPieChart";
import CardList from "@/components/CardList";
import TodoList from "@/components/TodoList";
import { auth } from "@clerk/nextjs/server";
import {
  AnalyticsDailyChartType,
  AnalyticsSummaryType,
  OrderChartType,
} from "@repo/types";

const Homepage = async () => {
  const { getToken } = await auth();
  const token = await getToken();

  const orderChartData = fetch(
    `${process.env.NEXT_PUBLIC_ORDER_SERVICE_URL}/order-chart`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  ).then(async (response) => {
    if (!response.ok) {
      throw new Error(`Failed to fetch order chart: ${response.status}`);
    }

    return (await response.json()) as OrderChartType[];
  });

  const dailyAnalyticsData = fetch(
    `${process.env.NEXT_PUBLIC_ANALYTIC_SERVICE_URL || "http://localhost:8004"}/analytics/daily-chart?days=7`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  )
    .then(async (response) => {
      if (!response.ok) return [] as AnalyticsDailyChartType[];
      return (await response.json()) as AnalyticsDailyChartType[];
    })
    .catch(() => [] as AnalyticsDailyChartType[]);

  const summaryAnalyticsData = fetch(
    `${process.env.NEXT_PUBLIC_ANALYTIC_SERVICE_URL || "http://localhost:8004"}/analytics/summary`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  )
    .then(async (response) => {
      if (!response.ok) return null;
      return (await response.json()) as AnalyticsSummaryType;
    })
    .catch(() => null);

  return (
    <div className="flex flex-col gap-6">
      {/* Real-time KPI Metric Summary Cards from Analytic Service */}
      <AnalyticsSummaryCards summaryPromise={summaryAnalyticsData} />

      {/* Analytical Charts & Activity Stream */}
      <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-4 gap-4">
        <div className="bg-primary-foreground p-4 rounded-lg lg:col-span-2 xl:col-span-1 2xl:col-span-2">
          <AppBarChart dataPromise={orderChartData || []} />
        </div>
        <div className="bg-primary-foreground p-4 rounded-lg">
          <CardList title="Latest Transactions" />
        </div>
        <div className="bg-primary-foreground p-4 rounded-lg">
          <AppPieChart summaryPromise={summaryAnalyticsData} />
        </div>
        <div className="bg-primary-foreground p-4 rounded-lg">
          <TodoList />
        </div>
        <div className="bg-primary-foreground p-4 rounded-lg lg:col-span-2 xl:col-span-1 2xl:col-span-2">
          <AppAreaChart dataPromise={dailyAnalyticsData} />
        </div>
        <div className="bg-primary-foreground p-4 rounded-lg">
          <CardList title="Popular Products" />
        </div>
      </div>
    </div>
  );
};

export default Homepage;
