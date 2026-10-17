import { describe, expect, it, vi } from "vitest";
import { db } from "@repo/db";
import { createAuth } from "../../../../src/config/auth.js";

// Constructing the auth factory does not connect to PostgreSQL. These exercise
// the configured hooks directly; the real adapter flow remains opt-in.
function setup() {
  const findAuthUser = vi.fn();
  const auth = createAuth({
    db,
    findAuthUser,
    env: {
      API_PORT: 0,
      SHUTDOWN_TIMEOUT_MS: 1000,
      LOG_LEVEL: "silent",
      TRUST_PROXY_HOPS: 0,
      PG_USER: "unused",
      PG_PASSWORD: "unused",
      PG_HOST: "unused",
      PG_PORT: "5432",
      PG_DB: "unused",
      BETTER_AUTH_SECRET: "test-secret-at-least-thirty-two-characters",
      BETTER_AUTH_URL: "https://api.example.test",
      WEB_ORIGIN: "https://web.example.test",
      GITHUB_CLIENT_ID: "test",
      GITHUB_CLIENT_SECRET: "test",
      NODE_ENV: "test",
    },
  });
  return { options: auth.options, findAuthUser };
}

describe("OAuth approval configuration", () => {
  it("prevents profile privilege escalation and creates tokenless pending users", async () => {
    const { options } = setup();
    expect(options.user.additionalFields.role).toMatchObject({
      input: false,
      defaultValue: "user",
    });
    expect(options.user.additionalFields.approved).toMatchObject({
      input: false,
      defaultValue: false,
    });
    expect(options.user.additionalFields).not.toHaveProperty("approvalToken");
    const result = await options.databaseHooks.user.create.before({
      id: "opaque",
      name: "User",
      email: "user@example.test",
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      role: "admin",
      approved: true,
    });
    expect(result.data).toMatchObject({
      id: "opaque",
      role: "user",
      approved: false,
    });
    expect(result.data).not.toHaveProperty("approvalToken");
  });

  it.each([undefined, { approved: false }])(
    "blocks session creation for missing/unapproved users: %j",
    async (actor) => {
      const { options, findAuthUser } = setup();
      findAuthUser.mockResolvedValue(actor);
      await expect(
        options.databaseHooks.session.create.before({
          id: "session",
          userId: "user",
          token: "private",
          expiresAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      ).rejects.toMatchObject({ statusCode: 403 });
      expect(findAuthUser).toHaveBeenCalledExactlyOnceWith("user");
    },
  );

  it("allows an approved account to create a session", async () => {
    const { options, findAuthUser } = setup();
    findAuthUser.mockResolvedValue({ approved: true });
    await expect(
      options.databaseHooks.session.create.before({
        id: "session",
        userId: "user",
        token: "private",
        expiresAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    ).resolves.toBeUndefined();
    expect(findAuthUser).toHaveBeenCalledExactlyOnceWith("user");
  });
});
