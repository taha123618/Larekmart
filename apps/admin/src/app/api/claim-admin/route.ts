import { auth, clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

/**
 * POST /api/claim-admin
 *
 * Allows an authenticated developer or designated user to promote their
 * Clerk publicMetadata to role: "admin". This resolves the issue where
 * newly created Clerk users lack the metadata.role === "admin" claim.
 */
export async function POST() {
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
