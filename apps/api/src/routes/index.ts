import { createAuthRouter } from "@features/auth/auth.routes";
import type { AuthService } from "@features/auth/auth.service";
import { createClustersRouter } from "@features/clusters/clusters.routes";
import { Router } from "express";
import { createHealthRouter, type HealthChecks } from "./health";

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
