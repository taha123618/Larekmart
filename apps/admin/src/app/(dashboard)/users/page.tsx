import { auth } from "@clerk/nextjs/server";
import { columns, type UserWithServiceStatus } from "./columns";
import { DataTable } from "./data-table";
import { fetchAdminUsers } from "@/services/user.service";
import { getServiceUrl } from "@/services/gateway.service";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Store, ShoppingBag, ShieldCheck } from "lucide-react";

const getData = async (): Promise<{
  data: UserWithServiceStatus[];
  totalCount: number;
}> => {
  const { getToken } = await auth();
  try {
    const authUrl = getServiceUrl(process.env.NEXT_PUBLIC_AUTH_SERVICE_URL);
    const token = await getToken();
    const [authRes, userSvcRes] = await Promise.all([
      fetch(`${authUrl}/api/v1/users`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }).then((r) => (r.ok ? r.json() : { data: [], totalCount: 0 })),
      token
        ? fetchAdminUsers(token, { limit: 100 }).catch(() => null)
        : Promise.resolve(null),
    ]);

    const clerkUsers = (authRes.data ||
      (Array.isArray(authRes) ? authRes : [])) as Array<
      Record<string, unknown> & { id: string }
    >;
    const userSvcMap = new Map(
      userSvcRes?.users?.map((u) => [u.authUserId, u]) || [],
    );

    const enriched: UserWithServiceStatus[] = clerkUsers.map((cu) => {
      const su = userSvcMap.get(cu.id);
      return {
        ...cu,
        id: cu.id,
        emailAddresses:
          (cu.emailAddresses as Array<{
            emailAddress: string;
            [key: string]: unknown;
          }>) || [],
        userServiceStatus: su?.status || null,
        isSeller:
          su?.isSeller ??
          Boolean(
            (cu.publicMetadata as Record<string, unknown> | undefined)
              ?.isSeller,
          ),
        phone: su?.phone || null,
      };
    });

    return {
      data: enriched,
      totalCount: authRes.totalCount || enriched.length,
    };
  } catch (err) {
    console.log("Error loading users in admin:", err);
    return { data: [], totalCount: 0 };
  }
};

const UsersPage = async () => {
  const res = await getData();
  const totalCount = res.data.length;
  const sellerCount = res.data.filter((u) => u.isSeller).length;
  const buyerCount = totalCount - sellerCount;
  const activeCount = res.data.filter(
    (u) =>
      !u.banned &&
      u.userServiceStatus !== "SUSPENDED" &&
      u.userServiceStatus !== "DEACTIVATED",
  ).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-4 py-3 bg-secondary/80 rounded-lg">
        <div>
          <h1 className="text-xl font-bold tracking-tight">
            User & Account Management
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Manage customer profiles, authoritative database status, and seller
            privileges
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase">
              Total Users
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalCount}</div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Across Clerk & database
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase">
              Verified Sellers
            </CardTitle>
            <Store className="h-4 w-4 text-indigo-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
              {sellerCount}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Authorized seller privileges
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase">
              Shoppers / Buyers
            </CardTitle>
            <ShoppingBag className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{buyerCount}</div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Standard marketplace accounts
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase">
              Active Accounts
            </CardTitle>
            <ShieldCheck className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {activeCount}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Unrestricted access
            </p>
          </CardContent>
        </Card>
      </div>

      <DataTable columns={columns} data={res.data} />
    </div>
  );
};

export default UsersPage;
