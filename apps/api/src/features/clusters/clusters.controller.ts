import type { NextFunction, Request, Response } from "express";
import { listClusterConfigs } from "./clusters.repository";
import { getClusterConfigValidation, getClusterMap } from "./clusters.service";

export async function listClusters(_req: Request, res: Response, next: NextFunction) {
    try {
        const clusters = listClusterConfigs().map((cluster) => ({
            id: cluster.id,
            number: cluster.number,
            label: cluster.label,
        }));

        res.json({ clusters });
    } catch (error) {
        next(error);
    }
}

export async function getClusterMapHandler(req: Request, res: Response, next: NextFunction) {
    try {
        const clusterNumber = req.params.clusterNumber as unknown as number;
        const map = await getClusterMap(clusterNumber);

        res.json(map);
    } catch (error) {
        next(error);
    }
}

export function getClusterConfigValidationHandler(req: Request, res: Response, next: NextFunction) {
    try {
        const clusterNumber = req.params.clusterNumber as unknown as number;
        const result = getClusterConfigValidation(clusterNumber);

        res.json(result);
    } catch (error) {
        next(error);
    }
}
