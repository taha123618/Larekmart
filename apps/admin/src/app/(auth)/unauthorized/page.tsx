"use client";

import { useAuth, useUser } from "@clerk/nextjs";
import {
  ShieldAlert,
  LogOut,
  ArrowRight,
  RefreshCw,
  KeyRound,
} from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

const Page = () => {
  const { signOut } = useAuth();
  const { user } = useUser();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleClaimAdmin = async () => {
    setLoading(true);
    setMessage(null);
    try {
      // Never source the claim secret from NEXT_PUBLIC_* — it would be embedded
      // in the client bundle served to every visitor. Always prompt the user.
      const secret = window.prompt("Admin registration secret:");
      if (!secret) {
        setMessage("Admin claim secret is required.");
        return;
      }
      const res = await fetch("/api/claim-admin", {
        method: "POST",
        headers: { "x-admin-claim-secret": secret },
      });
      const data = await res.json();
      if (res.ok) {
        setMessage("Admin privileges granted! Redirecting to Dashboard...");
        setTimeout(() => {
          router.push("/");
          router.refresh();
        }, 1200);
      } else {
        setMessage(data.message || "Failed to grant admin role");
      }
    } catch {
      setMessage("An unexpected error occurred while claiming admin role.");
    } finally {
      setLoading(false);
    }
  };

  const currentRole =
    (user?.publicMetadata as { role?: string })?.role || "user (unprivileged)";

  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-foreground px-4 py-12">
      <div className="max-w-md w-full bg-card text-card-foreground rounded-2xl shadow-xl border border-border/60 p-8 text-center space-y-6">
        <div className="mx-auto w-16 h-16 rounded-full bg-rose-500/10 flex items-center justify-center text-rose-600 dark:text-rose-400 border border-rose-500/20">
          <ShieldAlert className="w-8 h-8" />
        </div>

        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Access Restricted
          </h1>
          <p className="text-sm text-muted-foreground mt-2">
            The Larekmart Admin Console requires an account with verified{" "}
            <span className="font-semibold text-foreground">admin</span> privileges.
          </p>
        </div>

        <div className="bg-muted/50 rounded-xl p-4 text-left border border-border/60 space-y-2">
          <div className="flex justify-between items-center text-xs">
            <span className="text-muted-foreground">Signed in as:</span>
            <span className="font-medium text-foreground">
              {user?.primaryEmailAddress?.emailAddress ||
                user?.username ||
                "Authenticated User"}
            </span>
          </div>
          <div className="flex justify-between items-center text-xs">
            <span className="text-muted-foreground">Current Assigned Role:</span>
            <span className="font-medium px-2 py-0.5 rounded bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
              {currentRole}
            </span>
          </div>
        </div>

        {message && (
          <div
            className={`p-3 rounded-lg text-xs font-medium ${
              message.includes("granted")
                ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20"
                : "bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/20"
            }`}
          >
            {message}
          </div>
        )}

        <div className="space-y-3 pt-2">
          <Button
            onClick={handleClaimAdmin}
            disabled={loading}
            className="w-full h-11 rounded-xl font-medium text-sm flex items-center justify-center gap-2 cursor-pointer shadow-xs"
          >
            {loading ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <KeyRound className="w-4 h-4" />
            )}
            Grant / Claim Admin Access
            <ArrowRight className="w-4 h-4" />
          </Button>

          <Button
            variant="outline"
            onClick={() => signOut()}
            className="w-full h-11 rounded-xl font-medium text-sm flex items-center justify-center gap-2 cursor-pointer border-border/60"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </Button>
        </div>

        <p className="text-[11px] text-muted-foreground">
          Tip: In Clerk Dashboard, navigate to Configure → Sessions → Customize
          session token to embed{" "}
          <code className="text-foreground font-mono">metadata.role</code> in
          claims.
        </p>
      </div>
    </div>
  );
};

export default Page;
