import type { AuthService } from "../auth/auth.service.js";
import { createRequireAuth } from "@middleware/requireAuth.js";
import { Router } from "express";
import {
  getClusterConfigValidationHandler,
  createClusterEventsHandler,
  getClusterLayoutHandler,
  getClusterOccupancyHandler,
  listClusters,
} from "./clusters.controller.js";

export function createClustersRouter(
  authService: Pick<AuthService, "getSession">,
): Router {
  const clustersRouter = Router();
  const getClusterEventsHandler = createClusterEventsHandler(authService);

  clustersRouter.use(createRequireAuth(authService));

  clustersRouter.get("/", listClusters);
  clustersRouter.get("/:clusterNumber/layout", getClusterLayoutHandler);
  clustersRouter.get("/:clusterNumber/occupancy", getClusterOccupancyHandler);
  clustersRouter.get(
    "/:clusterNumber/config-validation",
    getClusterConfigValidationHandler,
  );
  clustersRouter.get("/:clusterNumber/events", getClusterEventsHandler);

  return clustersRouter;
}
