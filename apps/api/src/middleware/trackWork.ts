import type { RequestHandler } from "express";
import type { Runtime } from "../lifecycle/runtime.js";

// Socket close does not imply handler settlement (for example, a disconnected
// client can leave a database transaction running). Preserve Express 5's returned
// promise/error handling while retaining ownership until that work settles.
export function trackWork(
  runtime: Runtime | undefined,
  handler: RequestHandler,
): RequestHandler {
  if (!runtime) return handler;
  return (req, res, next) =>
    runtime.track(Promise.resolve(handler(req, res, next)));
}
