"use client";

import { Label, Pie, PieChart } from "recharts";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "./ui/chart";
import { Activity, PieChart as PieChartIcon } from "lucide-react";
import { AnalyticsSummaryType } from "@repo/types";
import { use } from "react";

const chartConfig = {
  count: {
    label: "Activities",
  },
  orders: {
    label: "Orders",
    color: "var(--chart-1)",
  },
  signups: {
    label: "Signups",
    color: "var(--chart-2)",
  },
  products: {
    label: "Products",
    color: "var(--chart-3)",
  },
  sellers: {
    label: "Sellers",
    color: "var(--chart-4)",
  },
} satisfies ChartConfig;

const AppPieChart = ({
  summaryPromise,
}: {
  summaryPromise?: Promise<AnalyticsSummaryType | null>;
}) => {
  const summary = summaryPromise ? use(summaryPromise) : null;

  const rawData = summary
    ? [
        {
          activity: "orders",
          count: summary.totalOrders || 0,
          fill: "var(--color-orders)",
        },
        {
          activity: "signups",
          count: summary.totalSignups || 0,
          fill: "var(--color-signups)",
        },
        {
          activity: "products",
          count: summary.totalProductsCreated || 0,
          fill: "var(--color-products)",
        },
        {
          activity: "sellers",
          count: summary.totalSellersActive || summary.totalSellersCreated || 0,
          fill: "var(--color-sellers)",
        },
      ]
    : [];

  const chartData = rawData.filter((d) => d.count > 0);
  const totalActivities = chartData.reduce((acc, curr) => acc + curr.count, 0);

  return (
    <div className="">
      <h1 className="text-lg font-medium mb-6">Platform Distribution</h1>
      {totalActivities > 0 ? (
        <>
          <ChartContainer
            config={chartConfig}
            className="mx-auto aspect-square max-h-[250px]"
          >
            <PieChart>
              <ChartTooltip
                cursor={false}
                content={<ChartTooltipContent hideLabel />}
              />
              <Pie
                data={chartData}
                dataKey="count"
                nameKey="activity"
                innerRadius={60}
                strokeWidth={5}
              >
                <Label
                  content={({ viewBox }) => {
                    if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                      return (
                        <text
                          x={viewBox.cx}
                          y={viewBox.cy}
                          textAnchor="middle"
                          dominantBaseline="middle"
                        >
                          <tspan
                            x={viewBox.cx}
                            y={viewBox.cy}
                            className="fill-foreground text-3xl font-bold"
                          >
                            {totalActivities.toLocaleString()}
                          </tspan>
                          <tspan
                            x={viewBox.cx}
                            y={(viewBox.cy || 0) + 24}
                            className="fill-muted-foreground text-xs"
                          >
                            Total Events
                          </tspan>
                        </text>
                      );
                    }
                  }}
                />
              </Pie>
            </PieChart>
          </ChartContainer>
          <div className="mt-4 flex flex-col gap-1 items-center text-center">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
              <Activity className="h-3.5 w-3.5 text-emerald-500" />
              Live Platform Domain Metrics
            </div>
            <div className="text-muted-foreground text-[11px]">
              Aggregated across active microservices
            </div>
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center justify-center min-h-[250px] border border-dashed border-border/60 rounded-xl p-6 text-center text-muted-foreground">
          <PieChartIcon className="w-8 h-8 mb-2 text-muted-foreground/40" />
          <p className="text-sm font-semibold text-foreground">
            No Event Activity Recorded
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Platform event distribution will populate automatically as users,
            orders, and merchants interact with the store.
          </p>
        </div>
      )}
    </div>
  );
};

export default AppPieChart;
