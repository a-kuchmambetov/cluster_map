import { fromNodeHeaders } from "better-auth/node";
import { getSession } from "../auth/auth.service";
import type { NextFunction, Request, Response } from "express";
import type { ClusterListResponse } from "@repo/types";
import { subscribe } from "./clusters.pool";
import { clusterNumberParamSchema } from "./clusters.schema";
import {
  getClusterConfigValidation,
  getClusterLayout,
  getClusterOccupancyData,
  listClusterConfigs,
  loadClusterConfig,
} from "./clusters.service";

const KEEPALIVE_INTERVAL_MS = 20_000;

export async function listClusters(
  _req: Request,
  res: Response,
  next: NextFunction,
) {
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

export async function getClusterLayoutHandler(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { clusterNumber } = clusterNumberParamSchema.parse(req.params);
    res.json(getClusterLayout(clusterNumber));
  } catch (error) {
    next(error);
  }
}

export async function getClusterOccupancyHandler(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { clusterNumber } = clusterNumberParamSchema.parse(req.params);
    res.json(await getClusterOccupancyData(clusterNumber));
  } catch (error) {
    next(error);
  }
}

export async function getClusterConfigValidationHandler(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { clusterNumber } = clusterNumberParamSchema.parse(req.params);
    res.json(await getClusterConfigValidation(clusterNumber));
  } catch (error) {
    next(error);
  }
}

export function getClusterEventsHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  try {
    const { clusterNumber } = clusterNumberParamSchema.parse(req.params);
    // 404 before the stream opens — throws AppError.clusterNotFound if missing.
    const config = loadClusterConfig(clusterNumber);

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    let closed = false;
    let checking = false;
    const emit = (event: string, data: string): void => {
      if (!closed) res.write(`event: ${event}\ndata: ${data}\n\n`);
    };

    const unsubscribe = subscribe(config.id, emit);

    // Keep idle connections alive through proxies that would otherwise
    // close them. 20 s is safely under the poll interval (30 s).
    const cleanup = () => {
      if (closed) return;
      closed = true;
      clearInterval(keepalive);
      unsubscribe();
    };
    const keepalive = setInterval(async () => {
      if (closed || checking) return;
      checking = true;
      try {
        await getSession(fromNodeHeaders(req.headers));
        if (!closed) res.write(": keep-alive\n\n");
      } catch {
        cleanup();
        res.end();
      } finally {
        checking = false;
      }
    }, KEEPALIVE_INTERVAL_MS);

    res.on("close", cleanup);
  } catch (error) {
    next(error);
  }
}
