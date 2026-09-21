import { env, getAuthEnv } from "../config/env";

export async function isApplicationReady(): Promise<boolean> {
  let timer: NodeJS.Timeout | undefined;
  try {
    const config = getAuthEnv();
    const origin = new URL(env.WEB_ORIGIN);
    const authUrl = new URL(config.BETTER_AUTH_URL);
    if (origin.origin !== env.WEB_ORIGIN) return false;
    if (
      process.env.NODE_ENV === "production" &&
      (origin.protocol !== "https:" || authUrl.protocol !== "https:")
    )
      return false;
    const check = async () => {
      const {
        db,
        user,
        session,
        account,
        verification,
        cluster,
        row,
        position,
        userHiveInfo,
      } = await import("@repo/db");
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
      await import("../config/auth.js");
    };
    await Promise.race([
      check(),
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
}
