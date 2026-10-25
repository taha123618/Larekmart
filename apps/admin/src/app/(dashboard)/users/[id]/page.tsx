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
import type { UserDetailResponse } from "@repo/types";
import { MapPin, Bell } from "lucide-react";

const getData = async (
  id: string,
): Promise<{
  clerkUser: User | null;
  userDetail: UserDetailResponse | null;
}> => {
  const { getToken } = await auth();
  const token = await getToken();
  let clerkUser: User | null = null;
  let userDetail: UserDetailResponse | null = null;

  try {
    const authUrl =
      process.env.NEXT_PUBLIC_AUTH_SERVICE_URL ||
      process.env.NEXT_PUBLIC_API_GATEWAY_URL ||
      "http://localhost:8090";
    const res = await fetch(`${authUrl}/users/${id}`, {
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
    userDetail = await fetchAdminUserDetail(token, id);
  }

  return { clerkUser, userDetail };
};

const SingleUserPage = async ({
  params,
}: {
  params: Promise<{ id: string }>;
}) => {
  const { id } = await params;
  const { clerkUser: data, userDetail } = await getData(id);

  if (!data && !userDetail) {
    return <div className="">User not found!</div>;
  }

  return (
    <div className="">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/">Dashboard</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink href="/users">Users</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>
              {data?.firstName + " " + data?.lastName || data?.username || "-"}
            </BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      {/* CONTAINER */}
      <div className="mt-4 flex flex-col xl:flex-row gap-8">
        {/* LEFT */}
        <div className="w-full xl:w-1/3 space-y-6">
          {/* USER BADGES CONTAINER */}
          <div className="bg-primary-foreground p-4 rounded-lg">
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
          <div className="bg-primary-foreground p-4 rounded-lg space-y-2">
            <div className="flex items-center gap-2">
              <Avatar className="size-12">
                <AvatarImage
                  src={
                    data?.imageUrl ||
                    userDetail?.profile?.avatarUrl ||
                    undefined
                  }
                />
                <AvatarFallback>
                  {data?.firstName?.charAt(0) ||
                    userDetail?.profile?.firstName?.charAt(0) ||
                    data?.username ||
                    "-"}
                </AvatarFallback>
              </Avatar>
              <h1 className="text-xl font-semibold">
                {data?.firstName + " " + data?.lastName ||
                  data?.username ||
                  "-"}
              </h1>
            </div>
            <p className="text-sm text-muted-foreground">
              Lorem ipsum dolor, sit amet consectetur adipisicing elit. Vel
              voluptas distinctio ab ipsa commodi fugiat labore quos veritatis
              cum corrupti sed repudiandae ipsum, harum recusandae ratione ipsam
              in, quis quia.
            </p>
          </div>
          {/* INFORMATION CONTAINER */}
          <div className="bg-primary-foreground p-4 rounded-lg">
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
                <p className="text-sm text-muted-foreground">
                  Profile completion
                </p>
                <Progress value={66} />
              </div>
              <div className="flex items-center gap-2">
                <span className="font-bold">Full name:</span>
                <span>
                  {data?.firstName + " " + data?.lastName ||
                    userDetail?.profile?.displayName ||
                    data?.username ||
                    "-"}
                </span>
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
                <span>{String(data?.publicMetadata?.role) || "user"}</span>
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
          <div className="bg-primary-foreground p-4 rounded-lg space-y-3">
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
            <div className="bg-primary-foreground p-4 rounded-lg space-y-2 text-xs">
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
          <div className="bg-primary-foreground p-4 rounded-lg">
            <h1 className="text-xl font-semibold">User Activity</h1>
            <AppLineChart />
          </div>
        </div>
      </div>
    </div>
  );
};

export default SingleUserPage;
