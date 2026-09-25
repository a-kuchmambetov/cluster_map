import { type Request, type Response, Router } from "express";

export const healthRouter: Router = Router();

const DB_PING_TIMEOUT_MS = 2000;

// Keep module loading inside the health check so import failures also degrade
// health instead of crashing the process.
export async function isDatabaseReachable(): Promise<boolean> {
  const startedAt = Date.now();
  let phase = "import";
  try {
    const { db } = await import("@repo/db");
    phase = "query";

    let timeoutHandle: NodeJS.Timeout;
    const timeout = new Promise<never>((_resolve, reject) => {
      timeoutHandle = setTimeout(
        () => reject(new Error("Database ping timed out")),
        DB_PING_TIMEOUT_MS,
      );
    });

    try {
      await Promise.race([db.execute("SELECT 1"), timeout]);
      return true;
    } finally {
      clearTimeout(timeoutHandle!);
    }
  } catch (error) {
    // Drizzle wraps driver failures in `cause`. Log only diagnostic fields,
    // never the full error, query parameters, or connection configuration.
    const errors: Array<{ name: string; message: string; code?: string }> = [];
    let current: unknown = error;
    for (let depth = 0; current instanceof Error && depth < 5; depth++) {
      let message = current.message.replace(
        /postgres(?:ql)?:\/\/[^\s]+/gi,
        "[REDACTED_DATABASE_URL]",
      );
      const password = process.env.PG_PASSWORD;
      if (password) {
        message = message.split(password).join("[REDACTED]");
        message = message
          .split(encodeURIComponent(password))
          .join("[REDACTED]");
      }
      const code = "code" in current ? current.code : undefined;
      errors.push({
        name: current.name,
        message,
        ...(typeof code === "string" ? { code } : {}),
      });
      current = current.cause;
    }
    console.error(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        event: "database_health_check_failed",
        phase,
        elapsedMs: Date.now() - startedAt,
        timeoutMs: DB_PING_TIMEOUT_MS,
        errors,
      }),
    );
    return false;
  }
}

// healthHandler is a factory, not a plain Express handler. Express calls
// handlers with (req, res, next); if this were registered directly, `next`
// would land in `checkDb`, await next() would return undefined (falsy), and
// health would always respond 503 — silently, and only in production, since
// unit tests call the returned handler directly. The factory keeps `checkDb`
// out of the Express signature entirely so that bug can't happen.
export function healthHandler(
  checkDb: () => Promise<boolean>,
): (req: Request, res: Response) => Promise<void> {
  return async (_req, res) => {
    const dbReachable = await checkDb();

    if (!dbReachable) {
      res.status(503).json({ status: "degraded", db: "unreachable" });
      return;
    }

    res.json({ status: "ok", db: "ok" });
  };
}

healthRouter.get("/", healthHandler(isDatabaseReachable));

healthRouter.get("/ready", async (_req, res) => {
  const { isApplicationReady } = await import("./readiness.js");
  const ready = await isApplicationReady();
  res.status(ready ? 200 : 503).json({ status: ready ? "ready" : "not-ready" });
});
