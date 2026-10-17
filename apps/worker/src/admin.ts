import { db, eq, user } from "@repo/db";
import { env } from "./env.js";

// Administrators are never created here. The account must already exist from a GitHub sign-in.
export async function promoteAdminIfRequested(): Promise<void> {
  if (!env.ADMIN_EMAIL) {
    console.log("No admin email provided; skipping admin promotion.");
    return;
  }

  const [existing] = await db
    .select()
    .from(user)
    .where(eq(user.email, env.ADMIN_EMAIL))
    .limit(1);

  if (!existing) {
    console.log(
      `No account for ${env.ADMIN_EMAIL} yet. Sign in with GitHub, then restart the worker.`,
    );
    return;
  }

  if (existing.role === "admin" && existing.approved) {
    console.log(`Admin account ${env.ADMIN_EMAIL} already exists.`);
    return;
  }

  await db
    .update(user)
    .set({ role: "admin", approved: true })
    .where(eq(user.id, existing.id));

  console.log(`Promoted ${env.ADMIN_EMAIL} to approved administrator.`);
}
