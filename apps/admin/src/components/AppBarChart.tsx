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

const chartConfig = {
  total: {
    label: "Total",
    color: "var(--chart-1)",
  },
  successful: {
    label: "Successful",
    color: "var(--chart-4)",
  },
} satisfies ChartConfig;

const fallbackOrderData: OrderChartType[] = [
  { month: "January", total: 186, successful: 80 },
  { month: "February", total: 305, successful: 200 },
  { month: "March", total: 237, successful: 120 },
  { month: "April", total: 173, successful: 100 },
  { month: "May", total: 209, successful: 130 },
  { month: "June", total: 214, successful: 140 },
];

const AppBarChart = ({
  dataPromise,
}: {
  dataPromise?: Promise<OrderChartType[]>;
}) => {
  const resolvedData = dataPromise ? use(dataPromise) : fallbackOrderData;
  const chartData =
    resolvedData && resolvedData.length > 0 ? resolvedData : fallbackOrderData;

  return (
    <div className="">
      <h1 className="text-lg font-medium mb-6">Total Revenue</h1>
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
          <Bar dataKey="successful" fill="var(--color-successful)" radius={4} />
        </BarChart>
      </ChartContainer>
    </div>
  );
};

export default AppBarChart;
