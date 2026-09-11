"use client";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { AnalyticsDailyChartType } from "@repo/types";
import { use } from "react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";

const chartConfig = {
  total_revenue: {
    label: "Revenue ($)",
    color: "var(--chart-2)",
  },
  total_orders: {
    label: "Orders",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig;

const fallbackChartData: AnalyticsDailyChartType[] = [
  {
    date: "2026-09-01",
    total_revenue: 186,
    total_orders: 80,
    total_signups: 20,
    total_products_created: 5,
  },
  {
    date: "2026-09-02",
    total_revenue: 305,
    total_orders: 120,
    total_signups: 35,
    total_products_created: 8,
  },
  {
    date: "2026-09-03",
    total_revenue: 237,
    total_orders: 90,
    total_signups: 15,
    total_products_created: 3,
  },
  {
    date: "2026-09-04",
    total_revenue: 373,
    total_orders: 150,
    total_signups: 42,
    total_products_created: 10,
  },
  {
    date: "2026-09-05",
    total_revenue: 409,
    total_orders: 180,
    total_signups: 50,
    total_products_created: 12,
  },
  {
    date: "2026-09-06",
    total_revenue: 514,
    total_orders: 210,
    total_signups: 65,
    total_products_created: 15,
  },
];

const AppAreaChart = ({
  dataPromise,
}: {
  dataPromise?: Promise<AnalyticsDailyChartType[]>;
}) => {
  const resolvedData = dataPromise ? use(dataPromise) : fallbackChartData;
  const chartData =
    resolvedData && resolvedData.length > 0 ? resolvedData : fallbackChartData;

  return (
    <div className="">
      <h1 className="text-lg font-medium mb-6">Daily Growth & Orders</h1>
      <ChartContainer config={chartConfig} className="min-h-[200px] w-full">
        <AreaChart accessibilityLayer data={chartData}>
          <CartesianGrid vertical={false} />
          <XAxis
            dataKey="date"
            tickLine={false}
            tickMargin={10}
            axisLine={false}
            tickFormatter={(value) =>
              typeof value === "string" ? value.slice(5) : value
            }
          />
          <YAxis tickLine={false} tickMargin={10} axisLine={false} />
          <ChartTooltip content={<ChartTooltipContent />} />
          <ChartLegend content={<ChartLegendContent />} />
          <defs>
            <linearGradient id="fillRevenue" x1="0" y1="0" x2="0" y2="1">
              <stop
                offset="5%"
                stopColor="var(--color-total_revenue)"
                stopOpacity={0.8}
              />
              <stop
                offset="95%"
                stopColor="var(--color-total_revenue)"
                stopOpacity={0.1}
              />
            </linearGradient>
            <linearGradient id="fillOrders" x1="0" y1="0" x2="0" y2="1">
              <stop
                offset="5%"
                stopColor="var(--color-total_orders)"
                stopOpacity={0.8}
              />
              <stop
                offset="95%"
                stopColor="var(--color-total_orders)"
                stopOpacity={0.1}
              />
            </linearGradient>
          </defs>
          <Area
            dataKey="total_orders"
            type="natural"
            fill="url(#fillOrders)"
            fillOpacity={0.4}
            stroke="var(--color-total_orders)"
            stackId="a"
          />
          <Area
            dataKey="total_revenue"
            type="natural"
            fill="url(#fillRevenue)"
            fillOpacity={0.4}
            stroke="var(--color-total_revenue)"
            stackId="a"
          />
        </AreaChart>
      </ChartContainer>
    </div>
  );
};

export default AppAreaChart;
