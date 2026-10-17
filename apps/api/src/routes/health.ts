import { type Request, type Response, Router } from "express";
import { type AppLogger, silentLogger } from "../logger.js";
import type { Runtime } from "../lifecycle/runtime.js";
import { createBoundedProbe } from "./probe.js";

export function createDatabaseCheck(
  execute: (signal: AbortSignal) => Promise<unknown>,
  logger: AppLogger = silentLogger,
  runtime?: Runtime,
) {
  return createBoundedProbe(
    execute,
    2000,
    "database_probe_failed",
    logger,
    runtime,
  );
}

export function healthHandler(_req: Request, res: Response): void {
  res.json({ status: "ok" });
}

export type HealthChecks = {
  checkDb: () => Promise<boolean>;
  checkReady: () => Promise<boolean>;
  runtime?: Runtime;
  logger?: AppLogger;
};

export function createHealthRouter({
  checkDb,
  checkReady,
  runtime,
  logger = silentLogger,
}: HealthChecks): Router {
  const healthRouter = Router();
  healthRouter.use((_req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    next();
  });
  healthRouter.get("/", healthHandler);
  healthRouter.get("/ready", async (_req, res) => {
    let ready = false;
    try {
      ready =
        !runtime?.draining &&
        (await checkDb()) &&
        !runtime?.draining &&
        (await checkReady()) &&
        !runtime?.draining;
    } catch (diagnostic) {
      logger.warn({
        event: "readiness_probe_failed",
        requestId: res.locals.requestId,
        diagnostic,
      });
    }
    res
      .status(ready ? 200 : 503)
      .json({ status: ready ? "ready" : "not-ready" });
  });
  return healthRouter;
}
