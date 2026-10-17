import { createServer } from "node:http";
import { createLogger } from "../../src/logger.js";
import { createRuntime } from "../../src/lifecycle/runtime.js";
import { createShutdown } from "../../src/lifecycle/shutdown.js";

const mode = process.argv[2];
const logger = createLogger();
const server = createServer((_req, res) => {
  res.writeHead(200);
  res.flushHeaders();
});
const lifecycle = createShutdown({
  server,
  runtime: createRuntime(),
  logger,
  timeoutMs: 150,
  closeDatabase: () =>
    mode === "database" ? new Promise<void>(() => {}) : Promise.resolve(),
});
lifecycle.installSignals();
server.listen(0, "127.0.0.1", () =>
  logger.info({
    event: "server_started",
    port: (server.address() as { port: number }).port,
  }),
);
