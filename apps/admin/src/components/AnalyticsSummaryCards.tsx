"use client";

import { use } from "react";
import { AnalyticsSummaryType } from "@repo/types";
import { Card } from "./ui/card";
import { DollarSign, ShoppingBag, Users, Layers, Activity } from "lucide-react";

export const AnalyticsSummaryCards = ({
  summaryPromise,
}: {
  summaryPromise: Promise<AnalyticsSummaryType | null>;
}) => {
  const summary = use(summaryPromise);

  const revenue = summary ? `$${summary.totalRevenue.toFixed(2)}` : "$0.00";
  const orders = summary ? summary.totalOrders : 0;
  const signups = summary ? summary.totalSignups : 0;
  const products = summary
    ? Math.max(0, summary.totalProductsCreated - summary.totalProductsDeleted)
    : 0;

  const cards = [
    {
      title: "Total Revenue",
      value: revenue,
      description: "Aggregated platform sales",
      icon: DollarSign,
      color: "text-emerald-500",
      bgColor: "bg-emerald-500/10",
    },
    {
      title: "Total Orders",
      value: orders.toLocaleString(),
      description: "Processed checkout sessions",
      icon: ShoppingBag,
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
    },
    {
      title: "Registered Users",
      value: signups.toLocaleString(),
      description: "Active customer accounts",
      icon: Users,
      color: "text-purple-500",
      bgColor: "bg-purple-500/10",
    },
    {
      title: "Active Catalog",
      value: products.toLocaleString(),
      description: "Products synchronized",
      icon: Layers,
      color: "text-amber-500",
      bgColor: "bg-amber-500/10",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 w-full">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <Card key={card.title} className="p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">
                {card.title}
              </span>
              <div className={`p-2 rounded-lg ${card.bgColor}`}>
                <Icon className={`h-4 w-4 ${card.color}`} />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-bold">{card.value}</div>
              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                <Activity className="h-3 w-3 text-emerald-500 inline" />
                {card.description}
              </p>
            </div>
          </Card>
        );
      })}
    </div>
  );
};

export default AnalyticsSummaryCards;
