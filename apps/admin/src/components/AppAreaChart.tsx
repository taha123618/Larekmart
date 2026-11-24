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
import { TrendingUp } from "lucide-react";

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

const AppAreaChart = ({
  dataPromise,
}: {
  dataPromise?: Promise<AnalyticsDailyChartType[]>;
}) => {
  const chartData = dataPromise ? use(dataPromise) : [];

  return (
    <div className="">
      <h1 className="text-lg font-medium mb-6">Daily Growth & Orders</h1>
      {chartData && chartData.length > 0 ? (
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
      ) : (
        <div className="flex flex-col items-center justify-center min-h-[200px] border border-dashed border-border/60 rounded-xl p-6 text-center text-muted-foreground">
          <TrendingUp className="w-8 h-8 mb-2 text-muted-foreground/40" />
          <p className="text-sm font-semibold text-foreground">
            No Daily Growth Telemetry
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Daily order and revenue velocity will chart here automatically from
            analytic-service as platform events occur.
          </p>
        </div>
      )}
    </div>
  );
};

export default AppAreaChart;
