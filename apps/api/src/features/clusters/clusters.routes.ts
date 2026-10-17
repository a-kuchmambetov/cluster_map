import { trackWork } from "../../middleware/trackWork.js";
import type { Runtime } from "../../lifecycle/runtime.js";
import type { OccupancyPool } from "./clusters.pool.js";
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
  runtime?: Runtime,
  occupancyPool?: OccupancyPool,
): Router {
  const clustersRouter = Router();
  const getClusterEventsHandler = createClusterEventsHandler(
    authService,
    runtime,
    occupancyPool,
  );

  clustersRouter.use(trackWork(runtime, createRequireAuth(authService)));

  clustersRouter.get("/", listClusters);
  clustersRouter.get("/:clusterNumber/layout", getClusterLayoutHandler);
  clustersRouter.get(
    "/:clusterNumber/occupancy",
    trackWork(runtime, getClusterOccupancyHandler),
  );
  clustersRouter.get(
    "/:clusterNumber/config-validation",
    trackWork(runtime, getClusterConfigValidationHandler),
  );
  clustersRouter.get("/:clusterNumber/events", getClusterEventsHandler);

  return clustersRouter;
}
