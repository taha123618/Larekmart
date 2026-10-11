import { clerkMiddleware } from "@clerk/nextjs/server";
import type {
  NextRequest,
  NextFetchEvent,
  NextResponse,
  ProxyConfig,
} from "next/server";

const clerkHandler = clerkMiddleware();

export default async function proxy(
  request: NextRequest,
  event: NextFetchEvent,
): Promise<NextResponse | Response | null | undefined | void> {
  const result = await clerkHandler(
    request as unknown as Parameters<typeof clerkHandler>[0],
    event,
  );
  return result ?? undefined;
}

export const config: ProxyConfig = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
