import { type Request, type Response, Router } from "express";

export const healthRouter: Router = Router();

const DB_PING_TIMEOUT_MS = 2000;

// Dynamic import: @repo/db builds its DATABASE_URL from PG_* env vars that
// aren't configured anywhere yet, and connects lazily. A static import would
// still be safe today, but would tie server boot to that module resolving at
// all (e.g. before it's ever built). Keeping it dynamic + try/caught means a
// missing/broken DB dependency degrades this endpoint instead of crashing
// the process.
export async function isDatabaseReachable(): Promise<boolean> {
  try {
    const { db } = await import("@repo/db");

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
  } catch {
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
