import { auth } from "@clerk/nextjs/server";
import { columns, type UserWithServiceStatus } from "./columns";
import { DataTable } from "./data-table";
import { fetchAdminUsers } from "@/services/user.service";

const getData = async (): Promise<{
  data: UserWithServiceStatus[];
  totalCount: number;
}> => {
  const { getToken } = await auth();
  try {
    const authUrl =
      process.env.NEXT_PUBLIC_AUTH_SERVICE_URL ||
      process.env.NEXT_PUBLIC_API_GATEWAY_URL ||
      "http://localhost:8090";
    const token = await getToken();
    const [authRes, userSvcRes] = await Promise.all([
      fetch(`${authUrl}/users`, {
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
  return (
    <div className="">
      <div className="mb-8 px-4 py-2 bg-secondary rounded-md">
        <h1 className="font-semibold">All Users</h1>
      </div>
      <DataTable columns={columns} data={res.data} />
    </div>
  );
};

export default UsersPage;
