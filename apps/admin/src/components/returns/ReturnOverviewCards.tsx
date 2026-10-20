"use client";

import React from "react";
import {
  RotateCcw,
  Clock,
  Truck,
  ClipboardCheck,
  CheckCircle2,
  DollarSign,
} from "lucide-react";
import { ReturnOverviewKPIs } from "@/services/return.service";

interface ReturnOverviewCardsProps {
  kpis: ReturnOverviewKPIs;
  activeFilter?: string;
  onFilterSelect?: (status: string) => void;
}

export function ReturnOverviewCards({
  kpis,
  activeFilter = "ALL",
  onFilterSelect,
}: ReturnOverviewCardsProps) {
  const cards = [
    {
      id: "ALL",
      title: "Total Returns",
      value: kpis.totalReturns,
      icon: RotateCcw,
      description: "Lifetime return requests",
      color: "text-slate-600 dark:text-slate-300",
      bgColor: "bg-slate-100 dark:bg-slate-800",
      borderActive: "border-slate-500",
    },
    {
      id: "REQUESTED",
      title: "Pending Review",
      value: kpis.pendingReview,
      icon: Clock,
      description: "Requires approval / rejection",
      color: "text-amber-600 dark:text-amber-400",
      bgColor: "bg-amber-50 dark:bg-amber-950/40",
      borderActive: "border-amber-500 ring-2 ring-amber-500/20",
    },
    {
      id: "AWAITING_RETURN_SHIPMENT",
      title: "Awaiting Shipment",
      value: kpis.awaitingShipment,
      icon: Truck,
      description: "Label issued / in transit",
      color: "text-blue-600 dark:text-blue-400",
      bgColor: "bg-blue-50 dark:bg-blue-950/40",
      borderActive: "border-blue-500 ring-2 ring-blue-500/20",
    },
    {
      id: "INSPECTION",
      title: "Under Inspection",
      value: kpis.inInspection,
      icon: ClipboardCheck,
      description: "At warehouse / QA check",
      color: "text-purple-600 dark:text-purple-400",
      bgColor: "bg-purple-50 dark:bg-purple-950/40",
      borderActive: "border-purple-500 ring-2 ring-purple-500/20",
    },
    {
      id: "COMPLETED",
      title: "Completed",
      value: kpis.completed,
      icon: CheckCircle2,
      description: "Refund confirmed",
      color: "text-emerald-600 dark:text-emerald-400",
      bgColor: "bg-emerald-50 dark:bg-emerald-950/40",
      borderActive: "border-emerald-500 ring-2 ring-emerald-500/20",
    },
    {
      id: "REFUNDS_VALUE",
      title: "Refund Volume",
      value: `$${kpis.totalRefundAmount.toFixed(2)}`,
      icon: DollarSign,
      description: "Total refunded value",
      color: "text-indigo-600 dark:text-indigo-400",
      bgColor: "bg-indigo-50 dark:bg-indigo-950/40",
      borderActive: "border-indigo-500",
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4 mb-6">
      {cards.map((c) => {
        const Icon = c.icon;
        const isClickable = c.id !== "REFUNDS_VALUE" && !!onFilterSelect;
        const isSelected = activeFilter === c.id;

        return (
          <div
            key={c.id}
            onClick={() => isClickable && onFilterSelect?.(c.id)}
            className={`p-4 rounded-2xl border transition-all ${
              isSelected
                ? `${c.borderActive} bg-white dark:bg-slate-900 shadow-md`
                : "border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/60 hover:border-slate-300 dark:hover:border-slate-700 shadow-xs"
            } ${isClickable ? "cursor-pointer active:scale-98" : ""}`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 truncate">
                {c.title}
              </span>
              <div className={`p-1.5 rounded-lg ${c.bgColor} ${c.color}`}>
                <Icon className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
              {c.value}
            </div>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1 truncate">
              {c.description}
            </p>
          </div>
        );
      })}
    </div>
  );
}
