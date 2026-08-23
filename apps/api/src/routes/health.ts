import { type Request, type Response, Router } from "express";

export const healthRouter: Router = Router();

const DB_PING_TIMEOUT_MS = 2000;

// Dynamic import: @repo/db builds its DATABASE_URL from PG_* env vars that
// aren't configured anywhere yet, and connects lazily. A static import would
// still be safe today, but would tie server boot to that module resolving at
// all (e.g. before it's ever built). Keeping it dynamic + try/caught means a
// missing/broken DB dependency degrades this endpoint instead of crashing
// the process.
async function isDatabaseReachable(): Promise<boolean> {
    try {
        const { db } = await import("@repo/db");

        let timeoutHandle: NodeJS.Timeout;
        const timeout = new Promise<never>((_resolve, reject) => {
            timeoutHandle = setTimeout(() => reject(new Error("Database ping timed out")), DB_PING_TIMEOUT_MS);
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

healthRouter.get("/", async (_req: Request, res: Response) => {
    const dbReachable = await isDatabaseReachable();

    if (!dbReachable) {
        res.status(503).json({ status: "degraded", db: "unreachable" });
        return;
    }

    res.json({ status: "ok", db: "ok" });
});
