"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchSystemSettings } from "@/services/seller.service";
import { getPendingVendors } from "@/services/vendor-verification.service";
import { useClerk, useUser } from "@clerk/nextjs";
import {
  Home,
  Inbox,
  Settings,
  User2,
  ChevronUp,
  Plus,
  Shirt,
  User,
  ShoppingBasket,
  ShoppingCart,
  Database,
  Boxes,
  AlertTriangle,
  History,
  Sparkles,
  LayoutGrid,
  Truck,
  Star,
  Heart,
  Tag,
  Scale,
  RotateCcw,
  Coins,
  Building2,
  Store,
  ShieldAlert,
  ShieldCheck,
  Percent,
  Banknote,
  LifeBuoy,
  MessageSquare,
  Radio,
  Sliders,
  Activity,
  Bot,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "./ui/sidebar";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { Sheet, SheetTrigger } from "./ui/sheet";
import AddOrder from "./AddOrder";
import AddUser from "./AddUser";
import AddCategory from "./AddCategory";
import AddProduct from "./AddProduct";

const items = [
  {
    title: "Home",
    url: "/",
    icon: Home,
  },
  {
    title: "Inbox",
    url: "/chat",
    icon: Inbox,
  },
  {
    title: "Settings",
    url: "/settings",
    icon: Settings,
  },
];

const AppSidebar = () => {
  const pathname = usePathname();
  const { user } = useUser();
  const { signOut } = useClerk();

  const userDisplayName = user?.fullName || user?.username || "Admin";

  const isRouteActive = (url: string) => {
    if (!pathname || url === "#") return false;

    // Normalize pathnames by removing trailing slashes
    const current =
      pathname.length > 1 && pathname.endsWith("/")
        ? pathname.slice(0, -1)
        : pathname;
    const target = url.length > 1 && url.endsWith("/") ? url.slice(0, -1) : url;

    // Exact match for root "/" or direct route match
    if (target === "/") return current === "/";
    if (current === target) return true;

    // Guard against parent overlap for routes with dedicated sub-items
    if (target === "/inventory") {
      return current === "/inventory";
    }
    if (target === "/support") {
      return current === "/support";
    }

    // Match nested sub-routes (e.g. /users/[id], /orders/[id])
    return current.startsWith(`${target}/`);
  };

  const { data: systemSettings } = useQuery({
    queryKey: ["marketplace-system-settings"],
    queryFn: () => fetchSystemSettings().catch(() => null),
    staleTime: 30000,
  });

  const isSellerEnabled = systemSettings?.isSellerEnabled ?? true;

  const { data: pendingVendorsData } = useQuery({
    queryKey: ["sidebar-pending-vendors-count"],
    queryFn: () => getPendingVendors(undefined, { limit: 1 }).catch(() => null),
    staleTime: 30000,
  });

  const pendingVerificationCount = pendingVendorsData?.total ?? 0;

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="py-4">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/" className="flex items-center gap-2.5">
                <div className="relative size-8 shrink-0 overflow-hidden rounded-lg border border-border/60 bg-muted/20">
                  <Image
                    src="/logo.png"
                    alt="Larekmart"
                    width={32}
                    height={32}
                    className="size-full object-cover"
                    priority
                  />
                </div>
                <div className="flex flex-col gap-0.5 leading-none">
                  <span className="font-bold text-sm tracking-tight text-foreground">
                    LAREKMART<span className="text-indigo-600">.</span>
                  </span>
                  <span className="text-[10px] font-semibold tracking-wider uppercase text-muted-foreground">
                    Admin Console
                  </span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarSeparator />
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Application</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={isRouteActive(item.url)}>
                    <Link href={item.url}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                  {item.title === "Inbox" && (
                    <SidebarMenuBadge>24</SidebarMenuBadge>
                  )}
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Products</SidebarGroupLabel>
          <SidebarGroupAction>
            <Plus /> <span className="sr-only">Add Product</span>
          </SidebarGroupAction>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={isRouteActive("/products")}
                >
                  <Link href="/products">
                    <Shirt />
                    See All Products
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <Sheet>
                  <SheetTrigger asChild>
                    <SidebarMenuButton>
                      <Plus />
                      <span>Add Product</span>
                    </SidebarMenuButton>
                  </SheetTrigger>
                  <AddProduct />
                </Sheet>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <Sheet>
                  <SheetTrigger asChild>
                    <SidebarMenuButton>
                      <Plus />
                      <span>Add Category</span>
                    </SidebarMenuButton>
                  </SheetTrigger>
                  <AddCategory />
                </Sheet>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isRouteActive("/catalog")}>
                  <Link href="/catalog">
                    <LayoutGrid />
                    Catalog Read-Model
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Users</SidebarGroupLabel>
          <SidebarGroupAction>
            <Plus /> <span className="sr-only">Add User</span>
          </SidebarGroupAction>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isRouteActive("/users")}>
                  <Link href="/users">
                    <User />
                    See All Users
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <Sheet>
                  <SheetTrigger asChild>
                    <SidebarMenuButton>
                      <Plus />
                      <span>Add User</span>
                    </SidebarMenuButton>
                  </SheetTrigger>
                  <AddUser />
                </Sheet>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Orders / Payments</SidebarGroupLabel>
          <SidebarGroupAction>
            <Plus /> <span className="sr-only">Add Order</span>
          </SidebarGroupAction>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isRouteActive("/orders")}>
                  <Link href="/orders">
                    <ShoppingBasket />
                    See All Transactions
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isRouteActive("/returns")}>
                  <Link href="/returns">
                    <RotateCcw />
                    Returns & Refunds
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isRouteActive("/carts")}>
                  <Link href="/carts">
                    <ShoppingCart />
                    Shopping Carts
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <Sheet>
                  <SheetTrigger asChild>
                    <SidebarMenuButton>
                      <Plus />
                      <span>Add Order</span>
                    </SidebarMenuButton>
                  </SheetTrigger>
                  <AddOrder />
                </Sheet>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <div className="flex items-center justify-between pr-2">
            <SidebarGroupLabel>Marketplace & Merchants</SidebarGroupLabel>
            {!isSellerEnabled && (
              <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                Disabled
              </span>
            )}
          </div>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={isRouteActive("/vendor-verification")}
                >
                  <Link href="/vendor-verification">
                    <ShieldCheck />
                    <span>Seller Verification</span>
                  </Link>
                </SidebarMenuButton>
                {pendingVerificationCount > 0 && (
                  <SidebarMenuBadge>
                    {pendingVerificationCount}
                  </SidebarMenuBadge>
                )}
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isRouteActive("/vendors")}>
                  <Link href="/vendors">
                    <Building2 />
                    Vendors & KYB
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isRouteActive("/sellers")}>
                  <Link href="/sellers">
                    <Store />
                    Sellers & Stores
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={isRouteActive("/commissions")}
                >
                  <Link href="/commissions">
                    <Percent />
                    Commissions & Fees
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isRouteActive("/payouts")}>
                  <Link href="/payouts">
                    <Banknote />
                    Payouts & Batches
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={isRouteActive("/settlements")}
                >
                  <Link href="/settlements">
                    <Coins />
                    Escrow & Settlements
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={isRouteActive("/disputes")}
                >
                  <Link href="/disputes">
                    <ShieldAlert />
                    Disputes & Claims
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isRouteActive("/fraud")}>
                  <Link href="/fraud">
                    <ShieldAlert />
                    Fraud & Risk Cases
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Marketing & Promotions</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={isRouteActive("/promotions")}
                >
                  <Link href="/promotions">
                    <Tag />
                    Campaigns & Coupons
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Merchandise & Pricing</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isRouteActive("/pricing")}>
                  <Link href="/pricing">
                    <Coins />
                    Pricing & Currencies
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Taxes & Compliance</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isRouteActive("/taxes")}>
                  <Link href="/taxes">
                    <Scale />
                    Tax Rules & Jurisdictions
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Inventory & Stock</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={isRouteActive("/inventory")}
                >
                  <Link href="/inventory">
                    <Boxes />
                    Stock & Warehouses
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={isRouteActive("/inventory/low-stock")}
                >
                  <Link href="/inventory/low-stock">
                    <AlertTriangle />
                    Low Stock Alerts
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={isRouteActive("/inventory/movements")}
                >
                  <Link href="/inventory/movements">
                    <History />
                    Movement Ledger
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Logistics & Delivery</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={isRouteActive("/shipping")}
                >
                  <Link href="/shipping">
                    <Truck />
                    Shipments & Carriers
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Customer Feedback & Intent</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isRouteActive("/reviews")}>
                  <Link href="/reviews">
                    <Star />
                    Customer Reviews
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={isRouteActive("/wishlists")}
                >
                  <Link href="/wishlists">
                    <Heart />
                    Customer Wishlists
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isRouteActive("/support")}>
                  <Link href="/support">
                    <LifeBuoy />
                    Support Tickets & SLA
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isRouteActive("/chat")}>
                  <Link href="/chat">
                    <MessageSquare />
                    Live Chat & Moderation
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Observability & AI</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={isRouteActive("/recommendations")}
                >
                  <Link href="/recommendations">
                    <Sparkles />
                    Recommendations & AI
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={isRouteActive("/support/ai-performance")}
                >
                  <Link href="/support/ai-performance">
                    <Bot />
                    AI Support Performance
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isRouteActive("/cache")}>
                  <Link href="/cache">
                    <Database />
                    Cache Performance
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={isRouteActive("/kafka-dlq")}
                >
                  <Link href="/kafka-dlq">
                    <Radio />
                    Kafka DLQ & Resilience
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={isRouteActive("/feature-flags")}
                >
                  <Link href="/feature-flags">
                    <Sliders />
                    Feature Flags & Canaries
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={isRouteActive("/system-health")}
                >
                  <Link href="/system-health">
                    <Activity />
                    Synthetic Canary Health
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton className="h-10">
                  <User2 className="size-4 shrink-0" />
                  <span className="truncate">{userDisplayName}</span>
                  <ChevronUp className="ml-auto size-4" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                side="top"
                align="end"
                className="w-[--radix-dropdown-menu-trigger-width] min-w-56"
              >
                <DropdownMenuItem asChild>
                  <Link href="/users" className="cursor-pointer">
                    Manage Users
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/settings" className="cursor-pointer">
                    Settings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem
                  variant="destructive"
                  className="cursor-pointer"
                  onClick={() => signOut({ redirectUrl: "/sign-in" })}
                >
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
};

export default AppSidebar;
