"use client";

import { Label, Pie, PieChart } from "recharts";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "./ui/chart";
import { TrendingUp } from "lucide-react";
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
  other: {
    label: "Other",
    color: "var(--chart-4)",
  },
} satisfies ChartConfig;

const fallbackChartData = [
  { activity: "orders", count: 275, fill: "var(--color-orders)" },
  { activity: "signups", count: 200, fill: "var(--color-signups)" },
  { activity: "products", count: 187, fill: "var(--color-products)" },
  { activity: "other", count: 90, fill: "var(--color-other)" },
];

const AppPieChart = ({
  summaryPromise,
}: {
  summaryPromise?: Promise<AnalyticsSummaryType | null>;
}) => {
  const summary = summaryPromise ? use(summaryPromise) : null;

  const chartData = summary
    ? [
        {
          activity: "orders",
          count: summary.totalOrders || 1,
          fill: "var(--color-orders)",
        },
        {
          activity: "signups",
          count: summary.totalSignups || 1,
          fill: "var(--color-signups)",
        },
        {
          activity: "products",
          count: summary.totalProductsCreated || 1,
          fill: "var(--color-products)",
        },
        {
          activity: "other",
          count: summary.totalProductsDeleted || 1,
          fill: "var(--color-other)",
        },
      ]
    : fallbackChartData;

  const totalActivities = chartData.reduce((acc, curr) => acc + curr.count, 0);

  return (
    <div className="">
      <h1 className="text-lg font-medium mb-6">Platform Distribution</h1>
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
      <div className="mt-4 flex flex-col gap-2 items-center">
        <div className="flex items-center gap-2 font-medium leading-none">
          Live event activity <TrendingUp className="h-4 w-4 text-green-500" />
        </div>
        <div className="leading-none text-muted-foreground text-xs">
          Aggregated by Analytic Service
        </div>
      </div>
    </div>
  );
};

export default AppPieChart;
