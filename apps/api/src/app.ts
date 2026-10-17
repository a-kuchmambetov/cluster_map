import { type AppLogger, silentLogger } from "./logger.js";
import type { Env } from "@config/env.js";
import cors from "cors";
import express from "express";
import { createErrorMiddleware } from "./middleware/error.js";
import { createRequestLogger } from "./middleware/requestLogger.js";
import { createRoutes, type RouteDependencies } from "./routes/index.js";

export type AppDependencies = Omit<RouteDependencies, "webOrigin"> & {
  logger?: AppLogger;
  env: Pick<Env, "WEB_ORIGIN" | "TRUST_PROXY_HOPS" | "NODE_ENV">;
};

export function createApp(deps: AppDependencies): express.Express {
  const { env, logger = silentLogger } = deps;
  const app = express();

  // Only trust the configured proxy hops, counted from the API outwards.
  // This lets the auth limiter use the client IP instead of the proxy's IP.
  app.set("trust proxy", env.TRUST_PROXY_HOPS);

  // Preserve Express 4 query semantics for the OAuth endpoints.
  app.set("query parser", "extended");

  app.use(createRequestLogger(logger, deps.runtime));
  app.use((req, res, next) => {
    if (
      !deps.runtime?.draining ||
      /^\/api\/health(?:\/ready)?\/?$/i.test(req.path)
    )
      return next();
    res.setHeader("Connection", "close");
    res.status(503).json({ status: "not-ready" });
  });

  const origin =
    env.NODE_ENV === "development" ? [env.WEB_ORIGIN] : env.WEB_ORIGIN;

  app.use(
    cors({
      origin: origin,
      credentials: true,
      exposedHeaders: ["X-Request-ID"],
    }),
  );

  app.use(express.json());

  app.use("/api", createRoutes({ ...deps, webOrigin: env.WEB_ORIGIN }));

  app.use(createErrorMiddleware(logger, env.NODE_ENV === "production"));

  return app;
}
