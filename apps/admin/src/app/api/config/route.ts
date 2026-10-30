import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export interface RuntimeConfigResponse {
  apiGatewayUrl: string;
  wsUrl: string;
  environment: string;
}

/**
 * Runtime Configuration Provider Endpoint (/api/config)
 *
 * Serves dynamic container environment configuration to the browser at runtime,
 * completely eliminating compile-time variable rigidity and avoiding static
 * image rebuilds when promoting containers across staging, Kubernetes, or cloud nodes.
 */
export async function GET(): Promise<NextResponse<RuntimeConfigResponse>> {
  const apiGatewayUrl =
    process.env.ADMIN_API_GATEWAY_URL ||
    process.env.API_GATEWAY_URL ||
    "";

  const wsUrl =
    process.env.ADMIN_WS_URL ||
    process.env.NOTIFICATION_WS_URL ||
    "";

  return NextResponse.json(
    {
      apiGatewayUrl,
      wsUrl,
      environment: process.env.NODE_ENV || "development",
    },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    },
  );
}

