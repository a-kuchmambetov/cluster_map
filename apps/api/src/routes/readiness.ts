import {
  type db as database,
  user,
  session,
  account,
  verification,
  cluster,
  row,
  position,
  userHiveInfo,
} from "@repo/db";
import { createBoundedProbe } from "./probe.js";
import { type AppLogger, silentLogger } from "../logger.js";
import type { Runtime } from "../lifecycle/runtime.js";
import type { Env } from "../config/env.js";

export function createSchemaCheck(db: Pick<typeof database, "select">) {
  return async () => {
    // Select every declared column without reading user data. Missing required
    // columns fail readiness; surplus/deferred-drop columns do not. Deployment
    // must separately verify destructive migration completion/version compatibility.
    for (const table of [
      user,
      session,
      account,
      verification,
      cluster,
      row,
      position,
      userHiveInfo,
    ]) {
      // One dedicated probe connection: do not queue eight concurrent queries.
      // eslint-disable-next-line no-await-in-loop
      await db.select().from(table).limit(0);
    }
  };
}

export function createReadinessCheck(
  env: Pick<Env, "WEB_ORIGIN" | "BETTER_AUTH_URL" | "NODE_ENV">,
  checkSchema: (signal: AbortSignal) => Promise<void>,
  logger: AppLogger = silentLogger,
  runtime?: Runtime,
) {
  const check = createBoundedProbe(
    checkSchema,
    3000,
    "readiness_probe_failed",
    logger,
    runtime,
  );
  return async function isApplicationReady(): Promise<boolean> {
    try {
      const origin = new URL(env.WEB_ORIGIN);
      const authUrl = new URL(env.BETTER_AUTH_URL);
      if (
        origin.origin !== env.WEB_ORIGIN ||
        (env.NODE_ENV === "production" &&
          (origin.protocol !== "https:" || authUrl.protocol !== "https:"))
      ) {
        logger.warn({ event: "readiness_config_invalid" });
        return false;
      }
      return await check();
    } catch {
      logger.warn({ event: "readiness_config_invalid" });
      return false;
    }
  };
}
