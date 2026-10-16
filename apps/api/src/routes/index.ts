import { createAuthRouter } from "@features/auth/auth.routes.js";
import type { AuthService } from "@features/auth/auth.service.js";
import { createClustersRouter } from "@features/clusters/clusters.routes.js";
import { Router } from "express";
import { createHealthRouter, type HealthChecks } from "./health.js";

export type RouteDependencies = HealthChecks & {
  authService: AuthService;
  webOrigin: string;
};

export function createRoutes(deps: RouteDependencies): Router {
  const routes = Router();
  routes.use("/health", createHealthRouter(deps));
  routes.use("/clusters", createClustersRouter(deps.authService));
  routes.use("/auth", createAuthRouter(deps.authService, deps.webOrigin));
  return routes;
}
