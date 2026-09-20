import { requireAuth } from "@middleware/requireAuth";
import { validateRequest } from "@middleware/validateRequest";
import { Router } from "express";
import {
  getClusterConfigValidationHandler,
  getClusterEventsHandler,
  getClusterLayoutHandler,
  getClusterOccupancyHandler,
  listClusters,
} from "./clusters.controller";
import { clusterNumberParamSchema } from "./clusters.schema";

export const clustersRouter: Router = Router();

clustersRouter.use(requireAuth);

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
