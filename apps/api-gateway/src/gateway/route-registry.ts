import { publicRoutes } from "../routing/public.routes.js";
import { authenticatedRoutes } from "../routing/authenticated.routes.js";
import { adminRoutes } from "../routing/admin.routes.js";
import type { GatewayRouteConfig } from "@repo/types";

export type RouteMapping = GatewayRouteConfig;

export const allGatewayRoutes: RouteMapping[] = [
  ...publicRoutes,
  ...authenticatedRoutes,
  ...adminRoutes,
];

export const apiRoutes = allGatewayRoutes;

export function findRouteForPath(path: string): RouteMapping | undefined {
  return allGatewayRoutes.find((r) => path.startsWith(r.prefix));
}
