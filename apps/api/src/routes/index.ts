import { createAdminRouter } from "../features/admin/admin.routes.js";
import type { AdminService } from "../features/admin/admin.service.js";
import type { OccupancyPool } from "../features/clusters/clusters.pool.js";
import { createAuthRouter } from "@features/auth/auth.routes.js";
import type { AuthService } from "@features/auth/auth.service.js";
import { createClustersRouter } from "@features/clusters/clusters.routes.js";
import { Router } from "express";
import { createHealthRouter, type HealthChecks } from "./health.js";

export type RouteDependencies = HealthChecks & {
  authService: AuthService;
  adminService: AdminService;
  webOrigin: string;
  occupancyPool?: OccupancyPool;
};

export function createRoutes(deps: RouteDependencies): Router {
  const routes = Router();
  routes.use("/health", createHealthRouter(deps));
  routes.use(
    "/clusters",
    createClustersRouter(deps.authService, deps.runtime, deps.occupancyPool),
  );
  routes.use(
    "/auth",
    createAuthRouter(deps.authService, deps.webOrigin, deps.runtime),
  );
  routes.use(
    "/admin",
    createAdminRouter(
      deps.authService,
      deps.adminService,
      deps.webOrigin,
      deps.runtime,
    ),
  );
  return routes;
}
