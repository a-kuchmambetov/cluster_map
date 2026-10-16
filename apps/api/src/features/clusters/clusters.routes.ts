import type { AuthService } from "../auth/auth.service.js";
import { createRequireAuth } from "@middleware/requireAuth.js";
import { validateRequest } from "@middleware/validateRequest.js";
import { Router } from "express";
import {
  getClusterConfigValidationHandler,
  createClusterEventsHandler,
  getClusterLayoutHandler,
  getClusterOccupancyHandler,
  listClusters,
} from "./clusters.controller.js";
import { clusterNumberParamSchema } from "./clusters.schema.js";

export function createClustersRouter(
  authService: Pick<AuthService, "getSession">,
): Router {
  const clustersRouter = Router();
  const getClusterEventsHandler = createClusterEventsHandler(authService);

  clustersRouter.use(createRequireAuth(authService));

  clustersRouter.get("/", listClusters);
  clustersRouter.get(
    "/:clusterNumber/layout",
    validateRequest({ params: clusterNumberParamSchema }),
    getClusterLayoutHandler,
  );
  clustersRouter.get(
    "/:clusterNumber/occupancy",
    validateRequest({ params: clusterNumberParamSchema }),
    getClusterOccupancyHandler,
  );
  clustersRouter.get(
    "/:clusterNumber/config-validation",
    validateRequest({ params: clusterNumberParamSchema }),
    getClusterConfigValidationHandler,
  );
  clustersRouter.get(
    "/:clusterNumber/events",
    validateRequest({ params: clusterNumberParamSchema }),
    getClusterEventsHandler,
  );

  return clustersRouter;
}
