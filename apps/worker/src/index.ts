import dotenv from "dotenv";
import { resolve } from "node:path";

dotenv.config({ path: resolve(process.cwd(), "../../.env") });

const { db, migrate } = await import("@repo/db");
// Import for side effects: validate environment before proceeding.
await import("./env.js");
const { createAdminIfRequested } = await import("./admin.js");

const MIGRATIONS_FOLDER = new URL(
  "../../../packages/db/migrations",
  import.meta.url,
).pathname;

const DB_PING_TIMEOUT_MS = 2000;
const DB_RETRY_MS = 1000;
const DB_MAX_RETRIES = 30;

async function pingDatabase(): Promise<boolean> {
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
  } catch {
    return false;
  } finally {
    clearTimeout(timeoutHandle!);
  }
}

async function waitForDatabase(): Promise<void> {
  for (let attempt = 1; attempt <= DB_MAX_RETRIES; attempt++) {
    // eslint-disable-next-line no-await-in-loop -- Sequential retry with backoff.
    if (await pingDatabase()) {
      console.log("Database is reachable.");
      return;
    }
    console.log(
      `Database is unreachable (attempt ${attempt}/${DB_MAX_RETRIES}); retrying in ${DB_RETRY_MS}ms...`,
    );
    // eslint-disable-next-line no-await-in-loop -- Intentional delay between retries.
    await new Promise((resolvePromise) =>
      setTimeout(resolvePromise, DB_RETRY_MS),
    );
  }
  throw new Error("Database did not become reachable within the retry window.");
}

async function runMigrations(): Promise<void> {
  console.log("Running database migrations...");
  await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
  console.log("Database migrations complete.");
}

async function main(): Promise<void> {
  await waitForDatabase();
  await runMigrations();
  await createAdminIfRequested();
  console.log("Worker finished successfully.");
}

main()
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$client.end().catch(() => {});
    process.exit(process.exitCode ?? 0);
  });
