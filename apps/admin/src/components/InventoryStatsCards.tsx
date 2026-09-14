import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import {
  Boxes,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  ShoppingBag,
} from "lucide-react";

interface InventoryStatsProps {
  totalItems: number;
  availableUnits: number;
  reservedUnits: number;
  soldUnits: number;
  lowStockCount: number;
}

export default function InventoryStatsCards({
  totalItems,
  availableUnits,
  reservedUnits,
  soldUnits,
  lowStockCount,
}: InventoryStatsProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
      <Card className="shadow-sm border-border">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Tracked SKUs
          </CardTitle>
          <Boxes className="h-4 w-4 text-primary" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{totalItems}</div>
          <p className="text-xs text-muted-foreground mt-1">
            Across all warehouses
          </p>
        </CardContent>
      </Card>

      <Card className="shadow-sm border-border">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Available Stock
          </CardTitle>
          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            {availableUnits.toLocaleString()}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Ready for purchase
          </p>
        </CardContent>
      </Card>

      <Card className="shadow-sm border-border">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Reserved Stock
          </CardTitle>
          <ShoppingBag className="h-4 w-4 text-blue-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
            {reservedUnits.toLocaleString()}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            In active checkouts
          </p>
        </CardContent>
      </Card>

      <Card className="shadow-sm border-border">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Sold Units
          </CardTitle>
          <Boxes className="h-4 w-4 text-violet-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-violet-600 dark:text-violet-400">
            {soldUnits.toLocaleString()}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Confirmed payments
          </p>
        </CardContent>
      </Card>

      <Card
        className={`shadow-sm border-border ${
          lowStockCount > 0
            ? "border-amber-500/40 bg-amber-500/5 dark:bg-amber-950/10"
            : ""
        }`}
      >
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Low Stock Alerts
          </CardTitle>
          {lowStockCount > 0 ? (
            <ShieldAlert className="h-4 w-4 text-amber-500 animate-pulse" />
          ) : (
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          )}
        </CardHeader>
        <CardContent>
          <div
            className={`text-2xl font-bold ${
              lowStockCount > 0 ? "text-amber-600 dark:text-amber-400" : ""
            }`}
          >
            {lowStockCount}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Below reorder point
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
