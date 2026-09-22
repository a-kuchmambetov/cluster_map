import { randomBytes } from "node:crypto";
import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { twoFactor } from "better-auth/plugins";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import {
  db,
  user,
  session,
  account,
  verification,
  twoFactor as twoFactorTable,
} from "@repo/db";
import { getAuthEnv, env } from "./env";
import { findAuthUser } from "@features/auth/auth.repository";

const config = getAuthEnv();
export const auth = betterAuth({
  secret: config.BETTER_AUTH_SECRET,
  baseURL: config.BETTER_AUTH_URL,
  trustedOrigins: [env.WEB_ORIGIN],
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: { user, session, account, verification, twoFactor: twoFactorTable },
  }),
  plugins: [twoFactor({ issuer: "Cluster Map" })],
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
    autoSignIn: false,
    minPasswordLength: 8,
    maxPasswordLength: 128,
  },
  socialProviders: {
    github: {
      clientId: config.GITHUB_CLIENT_ID,
      clientSecret: config.GITHUB_CLIENT_SECRET,
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
        // Gate session creation itself, including direct calls to auth.api.signInEmail.
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
