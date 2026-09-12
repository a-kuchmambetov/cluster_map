import type { NextFunction, Request, Response } from "express";
import type { ClusterListResponse } from "@repo/types";
import { clusterNumberParamSchema } from "./clusters.schema";
import { getClusterConfigValidation, getClusterLayout, getClusterOccupancyData, listClusterConfigs } from "./clusters.service";

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

export async function getClusterLayoutHandler(req: Request, res: Response, next: NextFunction) {
    try {
        const { clusterNumber } = clusterNumberParamSchema.parse(req.params);
        res.json(getClusterLayout(clusterNumber));
    } catch (error) {
        next(error);
    }
}

export async function getClusterOccupancyHandler(req: Request, res: Response, next: NextFunction) {
    try {
        const { clusterNumber } = clusterNumberParamSchema.parse(req.params);
        res.json(await getClusterOccupancyData(clusterNumber));
    } catch (error) {
        next(error);
    }
}

export async function getClusterConfigValidationHandler(req: Request, res: Response, next: NextFunction) {
    try {
        const { clusterNumber } = clusterNumberParamSchema.parse(req.params);
        res.json(await getClusterConfigValidation(clusterNumber));
    } catch (error) {
        next(error);
    }
}
