import type { Runtime } from "../lifecycle/runtime.js";
import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { type AppLogger, safePath, silentLogger } from "../logger.js";

export function createRequestLogger(
  logger: AppLogger = silentLogger,
  runtime?: Runtime,
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    let complete = () => {};
    if (runtime)
      runtime.track(
        new Promise<void>((resolve) => {
          complete = resolve;
        }),
      );
    const startedAt = performance.now();
    const supplied = req.headers["x-request-id"];
    const requestId =
      typeof supplied === "string" &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        supplied,
      )
        ? supplied
        : randomUUID();
    res.locals.requestId = requestId;
    res.setHeader("X-Request-ID", requestId);
    const method = req.method;
    const path = safePath(req.originalUrl);
    const log = () => {
      res.off("finish", log);
      res.off("close", log);
      logger.info({
        event: "request_completed",
        requestId,
        method,
        path,
        statusCode: res.statusCode,
        durationMs: Math.round(performance.now() - startedAt),
        outcome: res.writableFinished ? "finished" : "aborted",
        ...(res.locals.errorCode ? { errorCode: res.locals.errorCode } : {}),
      });
      complete();
    };
    res.once("finish", log);
    res.once("close", log);
    next();
  };
}
