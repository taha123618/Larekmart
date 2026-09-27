import { auth, type User } from "@clerk/nextjs/server";
import { columns } from "./columns";
import { DataTable } from "./data-table";
import { fetchAdminUsers } from "@/services/user.service";

const getData = async (): Promise<{ data: any[]; totalCount: number }> => {
  const { getToken } = await auth();
  const token = await getToken();
  try {
    const [authRes, userSvcRes] = await Promise.all([
      fetch(`${process.env.NEXT_PUBLIC_AUTH_SERVICE_URL}/users`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }).then((r) => (r.ok ? r.json() : { data: [], totalCount: 0 })),
      token
        ? fetchAdminUsers(token, { limit: 100 }).catch(() => null)
        : Promise.resolve(null),
    ]);

    const clerkUsers: User[] =
      authRes.data || (Array.isArray(authRes) ? authRes : []);
    const userSvcMap = new Map(
      userSvcRes?.users?.map((u) => [u.authUserId, u]) || [],
    );

    const enriched = clerkUsers.map((cu) => {
      const su = userSvcMap.get(cu.id);
      return {
        ...cu,
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
