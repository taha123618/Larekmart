"use client";

import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import {
  Star,
  Clock,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";
import { Button } from "./ui/button";

interface ReviewsStatsProps {
  totalReviews: number;
  pendingCount: number;
  approvedCount: number;
  flaggedCount: number;
  totalReports: number;
  isRecalculating?: boolean;
  onRecalculateAll?: () => void;
}

export default function ReviewsStatsCards({
  totalReviews,
  pendingCount,
  approvedCount,
  flaggedCount,
  totalReports,
  isRecalculating = false,
  onRecalculateAll,
}: ReviewsStatsProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
      <Card className="shadow-sm border-border">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Total Reviews
          </CardTitle>
          <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{totalReviews}</div>
          <p className="text-xs text-muted-foreground mt-1">
            Storefront customer ratings
          </p>
        </CardContent>
      </Card>

      <Card className="shadow-sm border-border">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Pending Queue
          </CardTitle>
          <Clock className="h-4 w-4 text-amber-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
            {pendingCount}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Awaiting manual approval
          </p>
        </CardContent>
      </Card>

      <Card className="shadow-sm border-border">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Approved
          </CardTitle>
          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            {approvedCount}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Visible on product pages
          </p>
        </CardContent>
      </Card>

      <Card className="shadow-sm border-border">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Flagged & Reports
          </CardTitle>
          <AlertTriangle className="h-4 w-4 text-rose-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-rose-600 dark:text-rose-400">
            {flaggedCount} <span className="text-xs font-normal text-muted-foreground">({totalReports} reports)</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Abuse or auto-flagged
          </p>
        </CardContent>
      </Card>

      <Card className="shadow-sm border-border flex flex-col justify-between">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Aggregations
          </CardTitle>
          <RefreshCw
            className={`h-4 w-4 text-primary ${isRecalculating ? "animate-spin" : ""}`}
          />
        </CardHeader>
        <CardContent className="pt-0">
          <Button
            size="sm"
            variant="outline"
            className="w-full text-xs font-semibold gap-1.5 mt-1"
            disabled={isRecalculating}
            onClick={onRecalculateAll}
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${isRecalculating ? "animate-spin" : ""}`}
            />
            {isRecalculating ? "Recalculating..." : "Recalculate All"}
          </Button>
          <p className="text-[11px] text-muted-foreground mt-1.5 text-center">
            Sync ratings & counts
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
