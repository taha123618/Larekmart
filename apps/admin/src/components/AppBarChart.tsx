"use client";

import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { OrderChartType } from "@repo/types";
import { use } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { BarChart3 } from "lucide-react";

const chartConfig = {
  total: {
    label: "Total Orders",
    color: "var(--chart-1)",
  },
  successful: {
    label: "Successful Orders",
    color: "var(--chart-4)",
  },
} satisfies ChartConfig;

const AppBarChart = ({
  dataPromise,
}: {
  dataPromise?: Promise<OrderChartType[]>;
}) => {
  const chartData = dataPromise ? use(dataPromise) : [];

  return (
    <div className="">
      <h1 className="text-lg font-medium mb-6">Order Volume & Fulfillment</h1>
      {chartData && chartData.length > 0 ? (
        <ChartContainer config={chartConfig} className="min-h-[200px] w-full">
          <BarChart accessibilityLayer data={chartData}>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="month"
              tickLine={false}
              tickMargin={10}
              axisLine={false}
              tickFormatter={(value) =>
                typeof value === "string"
                  ? value.slice(0, 3)
                  : String(value ?? "")
              }
            />
            <YAxis tickLine={false} tickMargin={10} axisLine={false} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <ChartLegend content={<ChartLegendContent />} />
            <Bar dataKey="total" fill="var(--color-total)" radius={4} />
            <Bar
              dataKey="successful"
              fill="var(--color-successful)"
              radius={4}
            />
          </BarChart>
        </ChartContainer>
      ) : (
        <div className="flex flex-col items-center justify-center min-h-[200px] border border-dashed border-border/60 rounded-xl p-6 text-center text-muted-foreground">
          <BarChart3 className="w-8 h-8 mb-2 text-muted-foreground/40" />
          <p className="text-sm font-semibold text-foreground">
            No Order Transaction Data
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Real-time monthly checkout totals and success rates will plot here
            as customers place orders.
          </p>
        </div>
      )}
    </div>
  );
};

export default AppBarChart;
