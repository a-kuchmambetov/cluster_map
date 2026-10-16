import type { AuthService } from "../auth/auth.service";
import { createRequireAuth } from "@middleware/requireAuth";
import { validateRequest } from "@middleware/validateRequest";
import { Router } from "express";
import {
  getClusterConfigValidationHandler,
  createClusterEventsHandler,
  getClusterLayoutHandler,
  getClusterOccupancyHandler,
  listClusters,
} from "./clusters.controller";
import { clusterNumberParamSchema } from "./clusters.schema";

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
