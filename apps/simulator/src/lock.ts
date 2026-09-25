import { db } from "@repo/db";
import type { PoolClient } from "pg";

export async function acquireAdvisoryLock(key: number): Promise<PoolClient> {
  const client = await db.$client.connect();
  await client.query("SELECT pg_advisory_lock($1)", [key]);
  return client;
}

export async function releaseAdvisoryLock(
  client: PoolClient,
  key: number,
): Promise<void> {
  try {
    await client.query("SELECT pg_advisory_unlock($1)", [key]);
  } finally {
    client.release();
  }
}
