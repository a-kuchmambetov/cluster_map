import { randomBytes } from "node:crypto";
import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import {
  type db as database,
  user,
  session,
  account,
  verification,
} from "@repo/db";
import type { Env } from "./env";

type AuthDependencies = {
  env: Env;
  db: typeof database;
  findAuthUser: (id: string) => Promise<{ approved: boolean } | undefined>;
};

export function createAuth({ env, db, findAuthUser }: AuthDependencies) {
  return betterAuth({
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    trustedOrigins: [env.WEB_ORIGIN],
    database: drizzleAdapter(db, {
      provider: "pg",
      schema: { user, session, account, verification },
    }),
    socialProviders: {
      github: {
        clientId: env.GITHUB_CLIENT_ID,
        clientSecret: env.GITHUB_CLIENT_SECRET,
      },
    },
    user: {
      additionalFields: {
        role: { type: ["user", "admin"], defaultValue: "user", input: false },
        approved: { type: "boolean", defaultValue: false, input: false },
        approvalToken: {
          type: "string",
          required: false,
          input: false,
          returned: false,
        },
      },
    },
    databaseHooks: {
      user: {
        create: {
          // Persist the token with the user in the same insert, never in a public response.
          before: async (newUser) => ({
            data: {
              ...newUser,
              role: "user",
              approved: false,
              approvalToken: randomBytes(32).toString("hex"),
            },
          }),
        },
      },
      session: {
        create: {
          // Gate session creation itself, including GitHub sign-in.
          before: async (newSession) => {
            const currentUser = await findAuthUser(newSession.userId);
            if (!currentUser?.approved)
              throw new APIError("FORBIDDEN", {
                message: "Your account is awaiting administrator approval.",
              });
          },
        },
      },
    },
  });
}

export type Auth = ReturnType<typeof createAuth>;
