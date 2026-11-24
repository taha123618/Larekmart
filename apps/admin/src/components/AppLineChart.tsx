"use client";

import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "./ui/chart";
import { OrderType } from "@repo/types";
import { Activity } from "lucide-react";
import { useMemo } from "react";

const chartConfig = {
  orders: {
    label: "Orders Placed",
    color: "var(--chart-1)",
  },
  spend: {
    label: "Spend ($)",
    color: "var(--chart-2)",
  },
} satisfies ChartConfig;

interface AppLineChartProps {
  orders?: OrderType[];
  data?: Array<{ label: string; orders: number; spend: number }>;
}

const AppLineChart = ({ orders = [], data }: AppLineChartProps) => {
  // Aggregate real orders dynamically by month
  const chartData = useMemo(() => {
    if (data && data.length > 0) return data;
    if (!orders || orders.length === 0) return [];

    const monthMap = new Map<string, { orders: number; spend: number }>();

    orders.forEach((order) => {
      const date = new Date(order.createdAt);
      const monthName = date.toLocaleString("en-US", { month: "short" });
      const current = monthMap.get(monthName) || { orders: 0, spend: 0 };
      current.orders += 1;
      current.spend += Math.round((order.amount || 0) / 100);
      monthMap.set(monthName, current);
    });

    return Array.from(monthMap.entries()).map(([month, val]) => ({
      label: month,
      orders: val.orders,
      spend: val.spend,
    }));
  }, [orders, data]);

  if (!chartData || chartData.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[220px] border border-dashed border-border/60 rounded-xl p-6 text-center text-muted-foreground mt-4">
        <Activity className="w-8 h-8 mb-2 text-muted-foreground/40" />
        <p className="text-sm font-semibold text-foreground">
          No Order Transactions Recorded
        </p>
        <p className="text-xs text-muted-foreground mt-0.5 max-w-sm">
          Checkout activity and monthly order volume for this customer will plot
          here dynamically as transactions occur.
        </p>
      </div>
    );
  }

  return (
    <ChartContainer config={chartConfig} className="mt-6">
      <LineChart
        accessibilityLayer
        data={chartData}
        margin={{
          left: 12,
          right: 12,
        }}
      >
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
        />
        <YAxis tickLine={false} axisLine={false} tickMargin={8} />
        <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
        <Line
          dataKey="orders"
          type="monotone"
          stroke="var(--color-orders)"
          strokeWidth={2}
          dot={true}
        />
        <Line
          dataKey="spend"
          type="monotone"
          stroke="var(--color-spend)"
          strokeWidth={2}
          dot={true}
        />
      </LineChart>
    </ChartContainer>
  );
};

export default AppLineChart;
