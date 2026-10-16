import { fromNodeHeaders } from "better-auth/node";
import type { AuthService } from "../auth/auth.service.js";
import type { Request, Response } from "express";
import { handler } from "@middleware/handler.js";
import type { ClusterListResponse } from "@repo/types";
import { subscribe } from "./clusters.pool.js";
import { clusterNumberParamSchema } from "./clusters.schema.js";
import {
  getClusterConfigValidation,
  getClusterLayout,
  getClusterOccupancyData,
  listClusterConfigs,
  loadClusterConfig,
} from "./clusters.service.js";

const KEEPALIVE_INTERVAL_MS = 20_000;

export function listClusters(_req: Request, res: Response) {
  const body: ClusterListResponse = {
    clusters: listClusterConfigs().map((cluster) => ({
      id: cluster.id,
      number: cluster.number,
      label: cluster.label,
    })),
  };

  res.json(body);
}

export const getClusterLayoutHandler = handler(
  { params: clusterNumberParamSchema },
  ({ params }, res) => {
    res.json(getClusterLayout(params.clusterNumber));
  },
);

export const getClusterOccupancyHandler = handler(
  { params: clusterNumberParamSchema },
  async ({ params }, res) => {
    res.json(await getClusterOccupancyData(params.clusterNumber));
  },
);

export const getClusterConfigValidationHandler = handler(
  { params: clusterNumberParamSchema },
  async ({ params }, res) => {
    res.json(await getClusterConfigValidation(params.clusterNumber));
  },
);

export function createClusterEventsHandler({
  getSession,
}: Pick<AuthService, "getSession">) {
  return handler(
    { params: clusterNumberParamSchema },
    ({ params, req }, res) => {
      // 404 before the stream opens — throws AppError.clusterNotFound if missing.
      const config = loadClusterConfig(params.clusterNumber);

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
    },
  );
}
