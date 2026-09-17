import { and, eq } from "drizzle-orm";
import { db, user } from "@repo/db";

export async function findAuthUser(id: string) {
  const [record] = await db
    .select({ id: user.id, role: user.role, approved: user.approved })
    .from(user)
    .where(eq(user.id, id))
    .limit(1);
  return record;
}

export async function approveUser(token: string) {
  // Conditional update consumes the token atomically: concurrent/replayed requests cannot reuse it.
  const [record] = await db
    .update(user)
    .set({ approved: true, approvalToken: null })
    .where(and(eq(user.approvalToken, token), eq(user.approved, false)))
    .returning({ id: user.id });
  return record;
}
