import type { IncomingMessage, Server, ServerResponse } from "node:http";
import type { Socket } from "node:net";
import { type AppLogger, flushLogger } from "../logger.js";
import type { Runtime } from "./runtime.js";

export function createShutdown({
  server,
  runtime,
  closeDatabase,
  logger,
  timeoutMs = 10_000,
  exit = (code) => process.exit(code),
  signals = process,
}: {
  server: Server;
  runtime: Runtime;
  closeDatabase: () => Promise<void>;
  logger: AppLogger;
  timeoutMs?: number;
  exit?: (code: number) => void;
  signals?: {
    on(event: "SIGTERM" | "SIGINT", listener: () => void): unknown;
    off(event: "SIGTERM" | "SIGINT", listener: () => void): unknown;
  };
}) {
  const sockets = new Set<Socket>();
  const onConnection = (socket: Socket) => {
    sockets.add(socket);
    socket.once("close", () => sockets.delete(socket));
    if (runtime.draining) socket.destroy();
  };
  // A connection that was active when close() ran can become idle later,
  // notably an SSE response with an explicit keep-alive header. Reap it after
  // Node has detached the completed response, without interrupting pipelined work.
  const onRequest = (_req: IncomingMessage, res: ServerResponse) => {
    const complete = () => {
      res.off("finish", complete);
      res.off("close", complete);
      if (runtime.draining) queueMicrotask(() => server.closeIdleConnections());
    };
    res.once("finish", complete);
    res.once("close", complete);
  };
  server.on("connection", onConnection);
  server.on("request", onRequest);
  let pending: Promise<void> | undefined;
  let resolveShutdown: (() => void) | undefined;
  let timer: NodeJS.Timeout | undefined;
  let finished = false;
  let installed = false;
  const log = (
    level: "info" | "error" | "fatal",
    fields: Record<string, unknown>,
  ) => {
    try {
      logger[level](fields);
    } catch {
      // A failed log sink must not interrupt cleanup or deadline enforcement.
    }
  };
  const dispose = () => {
    clearTimeout(timer);
    server.off("connection", onConnection);
    server.off("request", onRequest);
    if (installed) {
      signals.off("SIGTERM", onTerm);
      signals.off("SIGINT", onInt);
      installed = false;
    }
  };
  const terminate = (code: number) => {
    if (finished) return;
    finished = true;
    for (const socket of sockets) socket.destroy();
    sockets.clear();
    dispose();
    resolveShutdown?.();
    exit(code);
  };
  const force = () => {
    if (finished) return;
    log("fatal", {
      event: "shutdown_forced",
      forced: true,
      timeoutMs,
      exitCode: 1,
    });
    // The production destination is synchronous. Do not wait for an async
    // flush callback on the hard deadline, or a blocked sink could defer exit.
    try {
      logger.flush();
    } catch {
      /* Logging failures cannot prevent deadline exit. */
    } finally {
      terminate(1);
    }
  };
  const shutdown = (signal = "shutdown", failed = false): Promise<void> => {
    if (pending) return pending;
    pending = new Promise<void>((resolve) => {
      resolveShutdown = resolve;
    });
    timer = setTimeout(force, timeoutMs);
    log("info", { event: "shutdown_started", signal, timeoutMs });
    let code = failed ? 1 : 0;
    try {
      runtime.beginDrain();
    } catch (diagnostic) {
      code = 1;
      log("error", { event: "shutdown_failed", phase: "cleanup", diagnostic });
    }
    void (async () => {
      try {
        await Promise.all([
          new Promise<void>((resolve, reject) => {
            server.close((error) => {
              if (
                error &&
                (error as NodeJS.ErrnoException).code !==
                  "ERR_SERVER_NOT_RUNNING"
              ) {
                reject(error);
                return;
              }
              resolve();
            });
            server.closeIdleConnections();
          }),
          runtime.whenIdle(),
        ]);
        if (finished) return;
        await closeDatabase();
        if (finished) return;
        log(code ? "error" : "info", {
          event: "shutdown_completed",
          forced: false,
          exitCode: code,
        });
        await flushLogger(logger);
      } catch (diagnostic) {
        if (finished) return;
        code = 1;
        log("error", { event: "shutdown_failed", phase: "drain", diagnostic });
        // Any cleanup failure may leave live resources. Exit is intentional,
        // and the synchronous production destination has already written it.
        try {
          logger.flush();
        } catch {
          /* Exit still reports failure. */
        }
      }
      terminate(code);
    })();
    return pending;
  };
  const onTerm = () => {
    void shutdown("SIGTERM");
  };
  const onInt = () => {
    void shutdown("SIGINT");
  };
  return {
    shutdown,
    dispose,
    installSignals() {
      if (installed) return;
      installed = true;
      signals.on("SIGTERM", onTerm);
      signals.on("SIGINT", onInt);
    },
  };
}
