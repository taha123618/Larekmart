import { auth, clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

/**
 * POST /api/claim-admin
 *
 * Allows an authenticated developer or designated user to promote their
 * Clerk publicMetadata to role: "admin". This resolves the issue where
 * newly created Clerk users lack the metadata.role === "admin" claim.
 */
export async function POST(req: Request) {
  // 1. Strictly disable in production environments to prevent arbitrary privilege escalation
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      {
        message:
          "Admin self-promotion is strictly disabled in production environments.",
      },
      { status: 403 },
    );
  }

  // 2. If an administrative registration secret is configured, require it
  const requiredSecret = process.env.ADMIN_REGISTRATION_SECRET;
  if (requiredSecret) {
    const providedSecret = req.headers.get("x-admin-claim-secret");
    if (!providedSecret || providedSecret !== requiredSecret) {
      return NextResponse.json(
        { message: "Invalid or missing admin registration secret." },
        { status: 403 },
      );
    }
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
