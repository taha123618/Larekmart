import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Progress } from "@/components/ui/progress";
import { BadgeCheck, Candy, Citrus, Shield } from "lucide-react";
import { Sheet, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import EditUser from "@/components/EditUser";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import AppLineChart from "@/components/AppLineChart";
import { auth, User } from "@clerk/nextjs/server";
import { fetchAdminUserDetail } from "@/services/user.service";
import { getApiGatewayUrl } from "@/services/gateway.service";
import type { UserDetailResponse, OrderType } from "@repo/types";
import { MapPin, Bell, ShoppingBag } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

const getData = async (
  id: string,
): Promise<{
  clerkUser: User | null;
  userDetail: UserDetailResponse | null;
  userOrders: OrderType[];
}> => {
  const { getToken } = await auth();
  const token = await getToken();
  let clerkUser: User | null = null;
  let userDetail: UserDetailResponse | null = null;
  let userOrders: OrderType[] = [];

  const authUrl = getApiGatewayUrl();

  try {
    const res = await fetch(`${authUrl}/api/v1/users/${id}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    if (res.ok) {
      clerkUser = await res.json();
    }
  } catch (err) {
    console.log("Error fetching user from auth-service:", err);
  }

  if (token) {
    try {
      userDetail = await fetchAdminUserDetail(token, id);
    } catch (err) {
      console.log("Error fetching user detail:", err);
    }

    try {
      const orderRes = await fetch(`${authUrl}/api/v1/orders?userId=${id}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (orderRes.ok) {
        userOrders = await orderRes.json();
      }
    } catch (err) {
      console.log("Error fetching user orders:", err);
    }
  }

  return { clerkUser, userDetail, userOrders };
};

const SingleUserPage = async ({
  params,
}: {
  params: Promise<{ id: string }>;
}) => {
  const { id } = await params;
  const { clerkUser: data, userDetail, userOrders } = await getData(id);

  if (!data && !userDetail) {
    return <div className="">User not found!</div>;
  }

  const displayName =
    [data?.firstName, data?.lastName].filter(Boolean).join(" ") ||
    userDetail?.profile?.displayName ||
    data?.username ||
    "User";

  const initials = (
    data?.firstName?.charAt(0) ||
    userDetail?.profile?.firstName?.charAt(0) ||
    data?.username?.charAt(0) ||
    "U"
  ).toUpperCase();

  const userRole =
    (data?.publicMetadata?.role as string) ||
    (userDetail?.isSeller ? "seller" : "user");

  // Dynamic profile completion percentage
  const profileAttributes = [
    data?.emailAddresses?.[0]?.emailAddress || userDetail?.email,
    data?.phoneNumbers?.[0]?.phoneNumber || userDetail?.phone,
    data?.firstName || userDetail?.profile?.firstName,
    data?.lastName || userDetail?.profile?.lastName,
    data?.imageUrl || userDetail?.profile?.avatarUrl,
    userDetail?.addresses && userDetail.addresses.length > 0,
    userDetail?.profile?.bio,
  ];
  const completedCount = profileAttributes.filter(Boolean).length;
  const profileCompletion = Math.round(
    (completedCount / profileAttributes.length) * 100,
  );

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/">Dashboard</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink href="/users">Customers & Accounts</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{displayName}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      {/* CONTAINER */}
      <div className="flex flex-col xl:flex-row gap-6">
        {/* LEFT */}
        <div className="w-full xl:w-1/3 space-y-6">
          {/* USER BADGES CONTAINER */}
          <div className="bg-card text-card-foreground border border-border/60 p-4 rounded-xl shadow-xs">
            <h1 className="text-xl font-semibold">User Badges</h1>
            <div className="flex gap-4 mt-4">
              <HoverCard>
                <HoverCardTrigger>
                  <BadgeCheck
                    size={36}
                    className="rounded-full bg-blue-500/30 border-1 border-blue-500/50 p-2"
                  />
                </HoverCardTrigger>
                <HoverCardContent>
                  <h1 className="font-bold mb-2">Verified User</h1>
                  <p className="text-sm text-muted-foreground">
                    This user has been verified by the admin.
                  </p>
                </HoverCardContent>
              </HoverCard>
              <HoverCard>
                <HoverCardTrigger>
                  <Shield
                    size={36}
                    className="rounded-full bg-green-800/30 border-1 border-green-800/50 p-2"
                  />
                </HoverCardTrigger>
                <HoverCardContent>
                  <h1 className="font-bold mb-2">Admin</h1>
                  <p className="text-sm text-muted-foreground">
                    Admin users have access to all features and can manage
                    users.
                  </p>
                </HoverCardContent>
              </HoverCard>
              <HoverCard>
                <HoverCardTrigger>
                  <Candy
                    size={36}
                    className="rounded-full bg-yellow-500/30 border-1 border-yellow-500/50 p-2"
                  />
                </HoverCardTrigger>
                <HoverCardContent>
                  <h1 className="font-bold mb-2">Awarded</h1>
                  <p className="text-sm text-muted-foreground">
                    This user has been awarded for their contributions.
                  </p>
                </HoverCardContent>
              </HoverCard>
              <HoverCard>
                <HoverCardTrigger>
                  <Citrus
                    size={36}
                    className="rounded-full bg-orange-500/30 border-1 border-orange-500/50 p-2"
                  />
                </HoverCardTrigger>
                <HoverCardContent>
                  <h1 className="font-bold mb-2">Popular</h1>
                  <p className="text-sm text-muted-foreground">
                    This user has been popular in the community.
                  </p>
                </HoverCardContent>
              </HoverCard>
            </div>
          </div>
          {/* USER CARD CONTAINER */}
          <div className="bg-card text-card-foreground border border-border/60 p-4 rounded-xl shadow-xs space-y-2">
            <div className="flex items-center gap-2">
              <Avatar className="size-12">
                <AvatarImage
                  src={
                    data?.imageUrl ||
                    userDetail?.profile?.avatarUrl ||
                    undefined
                  }
                />
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
              <h1 className="text-xl font-semibold">{displayName}</h1>
            </div>
            <p className="text-sm text-muted-foreground">
              {userDetail?.profile?.bio ||
                (userDetail?.isSeller || data?.publicMetadata?.isSeller
                  ? "Registered merchant with marketplace selling privileges."
                  : "Standard customer account for marketplace browsing and purchases.")}
            </p>
          </div>
          {/* INFORMATION CONTAINER */}
          <div className="bg-card text-card-foreground border border-border/60 p-4 rounded-xl shadow-xs">
            <div className="flex items-center justify-between">
              <h1 className="text-xl font-semibold">User Information</h1>
              <Sheet>
                <SheetTrigger asChild>
                  <Button>Edit User</Button>
                </SheetTrigger>
                <EditUser
                  userId={id}
                  initialStatus={userDetail?.status || "ACTIVE"}
                  isSeller={
                    userDetail?.isSeller ??
                    Boolean(data?.publicMetadata?.isSeller)
                  }
                  fullName={
                    userDetail?.profile?.displayName ||
                    (data?.firstName
                      ? data.firstName + " " + (data.lastName || "")
                      : "")
                  }
                  email={
                    data?.emailAddresses?.[0]?.emailAddress ||
                    userDetail?.email ||
                    ""
                  }
                  phone={
                    data?.phoneNumbers?.[0]?.phoneNumber ||
                    userDetail?.phone ||
                    ""
                  }
                />
              </Sheet>
            </div>
            <div className="space-y-4 mt-4">
              <div className="flex flex-col gap-2 mb-8">
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>Profile completion</span>
                  <span className="font-medium text-foreground">
                    {profileCompletion}%
                  </span>
                </div>
                <Progress value={profileCompletion} />
              </div>
              <div className="flex items-center gap-2">
                <span className="font-bold">Full name:</span>
                <span>{displayName}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-bold">Email:</span>
                <span>
                  {data?.emailAddresses?.[0]?.emailAddress ||
                    userDetail?.email ||
                    "-"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-bold">Phone:</span>
                <span>
                  {data?.phoneNumbers?.[0]?.phoneNumber ||
                    userDetail?.phone ||
                    "-"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-bold">Role:</span>
                <span className="capitalize">{userRole}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-bold">Status:</span>
                <span
                  className={`px-2 py-0.5 rounded text-xs font-semibold ${
                    (userDetail?.status ||
                      (data?.banned ? "BANNED" : "ACTIVE")) === "ACTIVE"
                      ? "bg-green-100 text-green-800"
                      : "bg-red-100 text-red-800"
                  }`}
                >
                  {userDetail?.status || (data?.banned ? "BANNED" : "ACTIVE")}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-bold">Seller Privilege:</span>
                <span
                  className={`px-2 py-0.5 rounded text-xs font-semibold ${
                    (userDetail?.isSeller ??
                    Boolean(data?.publicMetadata?.isSeller))
                      ? "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300"
                      : "bg-neutral-100 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-400"
                  }`}
                >
                  {(userDetail?.isSeller ??
                  Boolean(data?.publicMetadata?.isSeller))
                    ? "Verified Seller"
                    : "Standard Customer (Non-Seller)"}
                </span>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mt-4">
              Joined on{" "}
              {data?.createdAt
                ? new Date(data.createdAt).toLocaleDateString("en-US")
                : userDetail?.createdAt
                  ? new Date(userDetail.createdAt).toLocaleDateString("en-US")
                  : "-"}
            </p>
          </div>

          {/* CUSTOMER ADDRESSES CONTAINER (from user-service) */}
          <div className="bg-card text-card-foreground border border-border/60 p-4 rounded-xl shadow-xs space-y-3">
            <h1 className="text-xl font-semibold flex items-center gap-2">
              <MapPin className="w-5 h-5 text-gray-500" />
              Saved Addresses ({userDetail?.addresses?.length || 0})
            </h1>
            {!userDetail?.addresses || userDetail.addresses.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No delivery addresses registered yet.
              </p>
            ) : (
              <div className="space-y-2">
                {userDetail.addresses.map((addr) => (
                  <div
                    key={addr.id}
                    className="p-3 bg-secondary rounded-md text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between font-semibold">
                      <span>{addr.recipientName}</span>
                      {addr.isDefault && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-green-200 text-green-900 font-bold">
                          Default
                        </span>
                      )}
                    </div>
                    <p className="text-muted-foreground">{addr.addressLine1}</p>
                    <p className="text-muted-foreground">
                      {addr.city}, {addr.state} {addr.postalCode} (
                      {addr.country})
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* CUSTOMER PREFERENCES CONTAINER (from user-service) */}
          {userDetail?.preferences && (
            <div className="bg-card text-card-foreground border border-border/60 p-4 rounded-xl shadow-xs space-y-2 text-xs">
              <h1 className="text-xl font-semibold flex items-center gap-2 mb-3">
                <Bell className="w-5 h-5 text-gray-500" />
                Customer Preferences
              </h1>
              <div className="flex justify-between py-1 border-b border-secondary">
                <span className="text-muted-foreground">Language:</span>
                <span className="font-semibold uppercase">
                  {userDetail.preferences.preferredLanguage}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-secondary">
                <span className="text-muted-foreground">Currency:</span>
                <span className="font-semibold uppercase">
                  {userDetail.preferences.currency}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-secondary">
                <span className="text-muted-foreground">Marketing Email:</span>
                <span className="font-semibold">
                  {userDetail.preferences.marketingEmail
                    ? "Enabled"
                    : "Disabled"}
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-muted-foreground">
                  Push Notifications:
                </span>
                <span className="font-semibold">
                  {userDetail.preferences.pushNotifications
                    ? "Enabled"
                    : "Disabled"}
                </span>
              </div>
            </div>
          )}
        </div>
        {/* RIGHT */}
        <div className="w-full xl:w-2/3 space-y-6">
          {/* CHART CONTAINER */}
          <div className="bg-card text-card-foreground border border-border/60 p-4 rounded-xl shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <h1 className="text-xl font-semibold">
                User Order & Spending Activity
              </h1>
              <Badge variant="secondary" className="text-xs">
                {userOrders.length}{" "}
                {userOrders.length === 1 ? "order" : "orders"}
              </Badge>
            </div>
            <AppLineChart orders={userOrders} />
          </div>

          {/* USER ORDERS TABLE */}
          {userOrders.length > 0 && (
            <div className="bg-card text-card-foreground border border-border/60 p-4 rounded-xl shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <h1 className="text-lg font-semibold flex items-center gap-2">
                  <ShoppingBag className="w-5 h-5 text-indigo-500" />
                  Recent Order Transactions
                </h1>
                <Link
                  href="/orders"
                  className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-medium"
                >
                  View All Orders
                </Link>
              </div>
              <div className="space-y-2">
                {userOrders.slice(0, 5).map((order) => (
                  <div
                    key={order._id}
                    className="p-3 bg-secondary rounded-lg flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="font-semibold text-foreground">
                        Order #{order._id.slice(-8).toUpperCase()}
                      </div>
                      <div className="text-muted-foreground text-[11px]">
                        {new Date(order.createdAt).toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge
                        variant={
                          order.status === "success" || order.status === "delivered"
                            ? "default"
                            : "secondary"
                        }
                        className="text-[10px] capitalize"
                      >
                        {order.status}
                      </Badge>
                      <span className="font-bold text-foreground">
                        ${((order.amount || 0) / 100).toFixed(2)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SingleUserPage;
