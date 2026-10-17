import { and, asc, eq, db, user } from "@repo/db";

export async function approveUser(id: string) {
  // Only one concurrent/replayed approval can transition a pending user.
  const [record] = await db
    .update(user)
    .set({ approved: true })
    .where(and(eq(user.id, id), eq(user.approved, false)))
    .returning({ id: user.id });
  return record;
}

export async function listUsers(status?: "pending") {
  return db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      approved: user.approved,
      createdAt: user.createdAt,
    })
    .from(user)
    .where(status === "pending" ? eq(user.approved, false) : undefined)
    .orderBy(asc(user.name), asc(user.id));
}

export async function deleteUser(id: string) {
  // Foreign keys cascade deletion to sessions and linked accounts.
  const [record] = await db
    .delete(user)
    .where(eq(user.id, id))
    .returning({ id: user.id });
  return record;
}
