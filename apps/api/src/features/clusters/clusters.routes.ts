import { validateRequest } from "@middleware/validateRequest";
import { Router } from "express";
import { getClusterConfigValidationHandler, getClusterLayoutHandler, getClusterOccupancyHandler, listClusters } from "./clusters.controller";
import { clusterNumberParamSchema } from "./clusters.schema";

export const clustersRouter: Router = Router();

clustersRouter.get("/", listClusters);
clustersRouter.get("/:clusterNumber/layout", validateRequest({ params: clusterNumberParamSchema }), getClusterLayoutHandler);
clustersRouter.get("/:clusterNumber/occupancy", validateRequest({ params: clusterNumberParamSchema }), getClusterOccupancyHandler);
clustersRouter.get("/:clusterNumber/config-validation", validateRequest({ params: clusterNumberParamSchema }), getClusterConfigValidationHandler);
