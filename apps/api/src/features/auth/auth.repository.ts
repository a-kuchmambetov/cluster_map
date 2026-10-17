import { eq, db, user } from "@repo/db";

export async function findAuthUser(id: string) {
  const [record] = await db
    .select({ id: user.id, role: user.role, approved: user.approved })
    .from(user)
    .where(eq(user.id, id))
    .limit(1);
  return record;
}
