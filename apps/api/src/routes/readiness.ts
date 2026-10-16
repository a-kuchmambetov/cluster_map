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
import type { Env } from "../config/env";

export function createSchemaCheck(db: typeof database) {
  return async () => {
    // Select every declared column without reading user data. Missing migrations fail readiness.
    await Promise.all(
      [
        user,
        session,
        account,
        verification,
        cluster,
        row,
        position,
        userHiveInfo,
      ].map((table) => db.select().from(table).limit(0)),
    );
  };
}

export function createReadinessCheck(
  env: Pick<Env, "WEB_ORIGIN" | "BETTER_AUTH_URL" | "NODE_ENV">,
  checkSchema: () => Promise<void>,
) {
  return async function isApplicationReady(): Promise<boolean> {
    let timer: NodeJS.Timeout | undefined;
    try {
      const origin = new URL(env.WEB_ORIGIN);
      const authUrl = new URL(env.BETTER_AUTH_URL);
      if (origin.origin !== env.WEB_ORIGIN) return false;
      if (
        env.NODE_ENV === "production" &&
        (origin.protocol !== "https:" || authUrl.protocol !== "https:")
      )
        return false;
      await Promise.race([
        checkSchema(),
        new Promise<never>((_, reject) => {
          timer = setTimeout(
            () => reject(new Error("Readiness timed out")),
            3000,
          );
        }),
      ]);
      return true;
    } catch {
      return false;
    } finally {
      clearTimeout(timer);
    }
  };
}
