import { Socket } from "node:net";
import { drizzle } from "drizzle-orm/node-postgres";
import { Client, Pool } from "pg";
import { DATABASE_URL } from "./env";

import * as schema from "./schema";

if (!DATABASE_URL) {
  throw new Error("DATABASE_URL is not set");
}

const pool = new Pool({ connectionString: DATABASE_URL });

export const db = drizzle({
  client: pool,
  schema,
});

// Only closes this process's shared pool. Call after application work drains.
let closing: Promise<void> | undefined;
export function closeDatabase(): Promise<void> {
  return (closing ??= pool.end());
}

// Probes never borrow the application pool: cancellation destroys only their
// dedicated connection, including during connect/query/close. Bounds are also
// enforced by the driver and PostgreSQL, rather than just a Promise.race.
export async function withDatabaseProbe<T>(
  signal: AbortSignal,
  check: (database: Omit<typeof db, "$client">) => Promise<T>,
): Promise<T> {
  signal.throwIfAborted();
  const socket = new Socket();
  const client = new Client({
    connectionString: DATABASE_URL,
    stream: () => socket,
    connectionTimeoutMillis: 2000,
    query_timeout: 3000,
    statement_timeout: 3000,
  });
  // A late socket error during cancellation must not become an uncaught event.
  client.on("error", () => {});
  let ending: Promise<void> | undefined;
  const end = () => (ending ??= client.end());
  const abort = () => {
    // An error is required: pg intentionally leaves connect() pending when
    // end() is called during a handshake without an error event.
    socket.destroy(new Error("Database probe aborted"));
    void end().catch(() => {});
  };
  signal.addEventListener("abort", abort, { once: true });
  try {
    await client.connect();
    signal.throwIfAborted();
    return await check(drizzle({ client, schema }));
  } finally {
    // Keep abort wired during end(), since an unresponsive server may stall it.
    try {
      await end();
    } finally {
      signal.removeEventListener("abort", abort);
    }
  }
}
