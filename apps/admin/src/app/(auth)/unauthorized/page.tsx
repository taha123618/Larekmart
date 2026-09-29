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
      const secret =
        process.env.NEXT_PUBLIC_ADMIN_CLAIM_SECRET ??
        window.prompt("Admin registration secret:");
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
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 px-4 py-12">
      <div className="max-w-md w-full bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 p-8 text-center space-y-6">
        <div className="mx-auto w-16 h-16 rounded-full bg-rose-100 dark:bg-rose-950/50 flex items-center justify-center text-rose-600 dark:text-rose-400">
          <ShieldAlert className="w-8 h-8" />
        </div>

        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            Access Restricted
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
            The Larekmart Admin Console requires an account with verified{" "}
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              admin
            </span>{" "}
            privileges.
          </p>
        </div>

        <div className="bg-slate-50 dark:bg-slate-900/60 rounded-xl p-4 text-left border border-slate-100 dark:border-slate-800 space-y-2">
          <div className="flex justify-between items-center text-xs">
            <span className="text-slate-500">Signed in as:</span>
            <span className="font-medium text-slate-900 dark:text-slate-200">
              {user?.primaryEmailAddress?.emailAddress ||
                user?.username ||
                "Authenticated User"}
            </span>
          </div>
          <div className="flex justify-between items-center text-xs">
            <span className="text-slate-500">Current Assigned Role:</span>
            <span className="font-medium px-2 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
              {currentRole}
            </span>
          </div>
        </div>

        {message && (
          <div
            className={`p-3 rounded-lg text-xs font-medium ${
              message.includes("granted")
                ? "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
                : "bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800"
            }`}
          >
            {message}
          </div>
        )}

        <div className="space-y-3 pt-2">
          <button
            onClick={handleClaimAdmin}
            disabled={loading}
            className="w-full py-2.5 px-4 rounded-xl font-medium text-sm text-white bg-slate-900 hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 flex items-center justify-center gap-2 transition disabled:opacity-50 cursor-pointer shadow-sm"
          >
            {loading ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <KeyRound className="w-4 h-4" />
            )}
            Grant / Claim Admin Access
            <ArrowRight className="w-4 h-4" />
          </button>

          <button
            onClick={() => signOut()}
            className="w-full py-2.5 px-4 rounded-xl font-medium text-sm text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 flex items-center justify-center gap-2 transition cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>

        <p className="text-[11px] text-slate-400 dark:text-slate-500">
          Tip: In Clerk Dashboard, navigate to Configure → Sessions → Customize
          session token to embed{" "}
          <code className="text-slate-600 dark:text-slate-400">
            metadata.role
          </code>{" "}
          in claims.
        </p>
      </div>
    </div>
  );
};

export default Page;
