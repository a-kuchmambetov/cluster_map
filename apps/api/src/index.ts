import * as adminRepository from "./features/admin/admin.repository.js";
import { createAdminService } from "./features/admin/admin.service.js";
import { env } from "@config/env.js";
import { db, closeDatabase, withDatabaseProbe } from "@repo/db";
import { createAuth } from "@config/auth.js";
import * as authRepository from "@features/auth/auth.repository.js";
import { createAuthService } from "@features/auth/auth.service.js";
import { createApp } from "./app.js";
import { createDatabaseCheck } from "./routes/health.js";
import { createReadinessCheck, createSchemaCheck } from "./routes/readiness.js";

import { createServer } from "node:http";
import { createLogger } from "./logger.js";
import { createRuntime } from "./lifecycle/runtime.js";
import { createShutdown } from "./lifecycle/shutdown.js";
import { createOccupancyPool } from "./features/clusters/clusters.pool.js";

const logger = createLogger(env);
const runtime = createRuntime();
const auth = createAuth({
  env,
  db,
  logger,
  findAuthUser: authRepository.findAuthUser,
});
const authService = createAuthService(auth, authRepository);
const app = createApp({
  env,
  authService,
  adminService: createAdminService(adminRepository),
  logger,
  runtime,
  occupancyPool: createOccupancyPool(runtime),
  checkDb: createDatabaseCheck(
    (signal) =>
      withDatabaseProbe(signal, (probeDb) => probeDb.execute("SELECT 1")),
    logger,
    runtime,
  ),
  checkReady: createReadinessCheck(
    env,
    (signal) =>
      withDatabaseProbe(signal, (probeDb) => createSchemaCheck(probeDb)()),
    logger,
    runtime,
  ),
});

const server = createServer(app);
const lifecycle = createShutdown({
  server,
  runtime,
  closeDatabase,
  logger,
  timeoutMs: env.SHUTDOWN_TIMEOUT_MS,
});
lifecycle.installSignals();
server.on("error", (diagnostic) => {
  logger.error({ event: "server_failed", diagnostic });
  void lifecycle.shutdown("server_error", true);
});
server.listen(env.API_PORT, () =>
  logger.info({
    event: "server_started",
    port: (server.address() as { port: number }).port,
  }),
);
