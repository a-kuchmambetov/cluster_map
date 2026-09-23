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
const DB_SHUTDOWN_TIMEOUT_MS = 5000;

// Bound connection acquisition, including PostgreSQL's initial handshake.
db.$client.options.connectionTimeoutMillis = DB_PING_TIMEOUT_MS;

async function pingDatabase(): Promise<boolean> {
  try {
    const client = await db.$client.connect();
    let timeoutHandle: NodeJS.Timeout | undefined;
    try {
      await Promise.race([
        client.query("SELECT 1"),
        new Promise<never>((_resolve, reject) => {
          timeoutHandle = setTimeout(
            () => reject(new Error("Database ping timed out")),
            DB_PING_TIMEOUT_MS,
          );
        }),
      ]);
    } finally {
      clearTimeout(timeoutHandle);
      // Destroy the probe connection so a timed-out query cannot retain it.
      client.release(true);
    }
    return true;
  } catch {
    return false;
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
    const shutdownTimeout = setTimeout(() => {
      console.error("Database shutdown timed out.");
      process.exit(1);
    }, DB_SHUTDOWN_TIMEOUT_MS);
    await db.$client.end().catch(() => {});
    clearTimeout(shutdownTimeout);
    process.exit(process.exitCode ?? 0);
  });
