import { auth } from "@clerk/nextjs/server";
import { columns } from "./columns";
import { DataTable } from "./data-table";
import { OrderType } from "@repo/types";
import { getApiGatewayUrl } from "@/services/gateway.service";
import { fetchAnalyticsSummary } from "@/services/analytics.service";
import { DollarSign, ShoppingBag, Activity, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

const getData = async (): Promise<OrderType[]> => {
  try {
    const { getToken } = await auth();
    const token = await getToken();
    const orderUrl = getApiGatewayUrl();
    const res = await fetch(`${orderUrl}/api/v1/orders`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    const data = await res.json();
    return data;
  } catch (err) {
    console.log(err);
    return [];
  }
};

const OrdersPage = async () => {
  const { getToken } = await auth();
  const token = await getToken();

  const [data, analytics] = await Promise.all([
    getData(),
    fetchAnalyticsSummary(token),
  ]);

  const totalRevenue = analytics?.totalRevenue ?? 0;
  const totalOrders = analytics?.totalOrders ?? data.length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between px-4 py-3 bg-secondary rounded-lg">
        <div>
          <h1 className="font-semibold text-lg">Orders & Payments Registry</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Synchronized with order-service (:8001) and analytic-service (:8004)
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-full border border-emerald-500/20">
          <Activity className="h-3.5 w-3.5 animate-pulse text-emerald-500" />
          <span>Live Telemetry Active</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-border/40">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Platform Revenue
            </CardTitle>
            <DollarSign className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              $
              {totalRevenue.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </div>
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3 text-emerald-500" /> Confirmed
              checkout volume
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/40">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Processed Orders
            </CardTitle>
            <ShoppingBag className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {totalOrders.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {data.length} orders in active database page
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/40">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Analytics Health
            </CardTitle>
            <Activity className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {analytics?.isDbConnected ? "Healthy" : "In-Memory Buffer"}
            </div>
            <p className="text-xs text-muted-foreground mt-1 truncate">
              Last event:{" "}
              {analytics?.lastEventTime
                ? new Date(analytics.lastEventTime).toLocaleTimeString()
                : "Recent"}
            </p>
          </CardContent>
        </Card>
      </div>

      <DataTable columns={columns} data={data} />
    </div>
  );
};

export default OrdersPage;
