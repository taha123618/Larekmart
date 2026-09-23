import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { CustomJwtSessionClaims } from "@repo/types";

const isPublicRoute = createRouteMatcher(["/sign-in(.*)", "/unauthorized(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    await auth.protect();

    const { userId, sessionClaims } = await auth();

    if (userId && sessionClaims) {
      const userRole = (sessionClaims as CustomJwtSessionClaims).metadata?.role;

      if (userRole !== "admin") {
        // Must be NextResponse, not the Fetch API's `Response.redirect`: that one
        // creates a response with *immutable* headers, and Clerk appends its handshake
        // headers to whatever the handler returns, throwing `TypeError: immutable`.
        // 302 keeps the previous status and avoids 307 replaying a POST onto
        // /unauthorized for API routes.
        return NextResponse.redirect(new URL("/unauthorized", req.url), 302);
      }
    }
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
