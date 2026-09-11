import type { NextFunction, Request, Response } from "express";
import type { ClusterListResponse } from "@repo/types";
import { clusterNumberParamSchema } from "./clusters.schema";
import { getClusterConfigValidation, getClusterMap, listClusterConfigs } from "./clusters.service";

export async function listClusters(_req: Request, res: Response, next: NextFunction) {
    try {
        const body: ClusterListResponse = {
            clusters: listClusterConfigs().map((cluster) => ({
                id: cluster.id,
                number: cluster.number,
                label: cluster.label,
            })),
        };

        res.json(body);
    } catch (error) {
        next(error);
    }
}

export async function getClusterMapHandler(req: Request, res: Response, next: NextFunction) {
    try {
        const { clusterNumber } = clusterNumberParamSchema.parse(req.params);
        const map = await getClusterMap(clusterNumber);

        res.json(map);
    } catch (error) {
        next(error);
    }
}

export function getClusterConfigValidationHandler(req: Request, res: Response, next: NextFunction) {
    try {
        const { clusterNumber } = clusterNumberParamSchema.parse(req.params);
        const result = getClusterConfigValidation(clusterNumber);

        res.json(result);
    } catch (error) {
        next(error);
    }
}
