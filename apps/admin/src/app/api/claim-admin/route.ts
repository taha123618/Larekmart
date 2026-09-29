import { auth, clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import crypto from "node:crypto";

/**
 * POST /api/claim-admin
 *
 * Bootstrap endpoint that lets a designated user promote their Clerk
 * publicMetadata to role: "admin" (resolves newly created Clerk users
 * lacking the metadata.role === "admin" claim).
 *
 * Security posture (fail-closed, audit lead admin-claim-admin-env-gate):
 * 1. DISABLED unless ALLOW_ADMIN_CLAIM === "true" — the default in every
 *    environment. No NODE_ENV detection: a missing env var can no longer
 *    silently enable self-service admin promotion.
 * 2. When enabled, ADMIN_REGISTRATION_SECRET is REQUIRED (the endpoint
 *    refuses to run without it) and compared in constant time.
 * 3. The caller must already be authenticated with Clerk.
 */

const timingSafeEqual = (provided: string, required: string): boolean => {
  const a = crypto.createHash("sha256").update(provided).digest();
  const b = crypto.createHash("sha256").update(required).digest();
  return crypto.timingSafeEqual(a, b);
};

export async function POST(req: Request) {
  // 1. Hard opt-in: the route does nothing unless explicitly enabled.
  if (process.env.ALLOW_ADMIN_CLAIM !== "true") {
    return NextResponse.json(
      { message: "Admin self-promotion is disabled." },
      { status: 403 },
    );
  }

  // 2. A secret is mandatory whenever the route is enabled — it never runs
  //    on "just NODE_ENV" trust.
  const requiredSecret = process.env.ADMIN_REGISTRATION_SECRET;
  if (!requiredSecret) {
    return NextResponse.json(
      {
        message:
          "ADMIN_REGISTRATION_SECRET must be configured to use admin claim.",
      },
      { status: 503 },
    );
  }

  const providedSecret = req.headers.get("x-admin-claim-secret");
  if (!providedSecret || !timingSafeEqual(providedSecret, requiredSecret)) {
    return NextResponse.json(
      { message: "Invalid or missing admin registration secret." },
      { status: 403 },
    );
  }

  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }

  try {
    const client = await clerkClient();
    const user = await client.users.getUser(userId);

    await client.users.updateUserMetadata(userId, {
      publicMetadata: {
        ...user.publicMetadata,
        role: "admin",
      },
    });

    return NextResponse.json({
      success: true,
      message: "Admin role successfully granted. Refreshing session...",
    });
  } catch (error: unknown) {
    const errMessage =
      error instanceof Error ? error.message : "Failed to update role in Clerk";
    console.error("[claim-admin] Failed to set admin role in Clerk:", error);
    return NextResponse.json({ message: errMessage }, { status: 500 });
  }
}
