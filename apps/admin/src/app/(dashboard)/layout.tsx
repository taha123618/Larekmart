import AppSidebar from "@/components/AppSidebar";
import Navbar from "@/components/Navbar";
import QueryProvider from "@/components/providers/QueryProvider";
import { SidebarProvider } from "@/components/ui/sidebar";
import { cookies } from "next/headers";
import { ToastContainer } from "react-toastify";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import type { CustomJwtSessionClaims } from "@repo/types";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { userId, sessionClaims } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  const metadata = (sessionClaims as CustomJwtSessionClaims)?.metadata;
  const userRole = metadata?.role;
  const isSuperAdmin =
    metadata?.isSuperAdmin === true || userRole === "super_admin";
  const isAdmin = userRole === "admin" || isSuperAdmin;

  if (!isAdmin) {
    redirect("/unauthorized");
  }

  const cookieStore = await cookies();
  const defaultOpen = cookieStore.get("sidebar_state")?.value !== "false";

  return (
    <QueryProvider>
      <div className="flex min-h-screen w-full">
        <SidebarProvider defaultOpen={defaultOpen}>
          <AppSidebar />
          <main className="flex-1 w-full min-w-0 flex flex-col">
            <Navbar />
            <div className="flex-1 p-4 sm:p-6 lg:p-8 min-w-0 max-w-full">
              {children}
            </div>
          </main>
        </SidebarProvider>
      </div>
      <ToastContainer position="bottom-right" />
    </QueryProvider>
  );
}
