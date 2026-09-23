import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { db, eq, user, session, account, verification } from "@repo/db";
import { env } from "./env.js";

export async function createAdminIfRequested(): Promise<void> {
  if (!env.ADMIN_EMAIL || !env.ADMIN_PASSWORD) {
    console.log("No admin credentials provided; skipping admin creation.");
    return;
  }

  const [existing] = await db
    .select()
    .from(user)
    .where(eq(user.email, env.ADMIN_EMAIL))
    .limit(1);

  if (existing) {
    if (existing.role === "admin" && existing.approved) {
      console.log(`Admin account ${env.ADMIN_EMAIL} already exists.`);
      return;
    }
    throw new Error(
      `Account ${env.ADMIN_EMAIL} already exists but is not an approved admin.`,
    );
  }

  const auth = betterAuth({
    secret: env.BETTER_AUTH_SECRET!,
    baseURL: env.BETTER_AUTH_URL!,
    database: drizzleAdapter(db, {
      provider: "pg",
      schema: { user, session, account, verification },
    }),
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
      autoSignIn: false,
      minPasswordLength: 8,
      maxPasswordLength: 128,
    },
    user: {
      additionalFields: {
        role: {
          type: ["user", "admin"],
          defaultValue: "user",
          input: false,
        },
        approved: { type: "boolean", defaultValue: false, input: false },
        approvalToken: {
          type: "string",
          required: false,
          input: false,
          returned: false,
        },
      },
    },
  });

  const result = await auth.api.signUpEmail({
    body: {
      name: env.ADMIN_NAME,
      email: env.ADMIN_EMAIL,
      password: env.ADMIN_PASSWORD,
    },
  });

  const [created] = await db
    .update(user)
    .set({ role: "admin", approved: true, approvalToken: null })
    .where(eq(user.id, result.user.id))
    .returning({ id: user.id });

  if (!created) {
    throw new Error(
      `Admin account ${env.ADMIN_EMAIL} could not be provisioned.`,
    );
  }

  console.log(`Created admin account ${env.ADMIN_EMAIL}.`);
}
