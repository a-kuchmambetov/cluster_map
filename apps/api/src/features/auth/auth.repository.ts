import { and, asc, eq } from "drizzle-orm";
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

export async function listPendingUsers() {
  return db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      createdAt: user.createdAt,
      approvalToken: user.approvalToken,
    })
    .from(user)
    .where(eq(user.approved, false))
    .orderBy(asc(user.createdAt), asc(user.id));
}

export async function listUsers() {
  return db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      approved: user.approved,
      approvalToken: user.approvalToken,
      createdAt: user.createdAt,
    })
    .from(user)
    .orderBy(asc(user.name), asc(user.id));
}

export async function deleteUser(id: string) {
  // Foreign keys cascade deletion to sessions, accounts, and two-factor secrets.
  const [record] = await db
    .delete(user)
    .where(eq(user.id, id))
    .returning({ id: user.id });
  return record;
}
