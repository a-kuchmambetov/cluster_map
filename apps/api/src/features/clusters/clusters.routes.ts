import { validateRequest } from "@middleware/validateRequest";
import { Router } from "express";
import { getClusterConfigValidationHandler, getClusterMapHandler, listClusters } from "./clusters.controller";
import { clusterNumberParamSchema } from "./clusters.schema";

export const clustersRouter: Router = Router();

clustersRouter.get("/", listClusters);
clustersRouter.get(
    "/:clusterNumber/map",
    validateRequest({ params: clusterNumberParamSchema }),
    getClusterMapHandler,
);
clustersRouter.get(
    "/:clusterNumber/config-validation",
    validateRequest({ params: clusterNumberParamSchema }),
    getClusterConfigValidationHandler,
);
