import type { Express } from "express";
import type { Auth } from "../../src/config/auth.js";
import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import request from "supertest";

const SECRET = "integration-test-secret-at-least-32-characters";

// Requires migrated, disposable PostgreSQL selected by PG_* environment variables.
describe.runIf(process.env.AUTH_DB_TEST === "1")(
  "administrator approval with PostgreSQL",
  () => {
    let app: Express;
    let auth: Auth;
    beforeAll(async () => {
      process.env.BETTER_AUTH_SECRET = SECRET;
      process.env.BETTER_AUTH_URL = "http://localhost:5000";
      process.env.GITHUB_CLIENT_ID ??= "integration-test";
      process.env.GITHUB_CLIENT_SECRET ??= "integration-test";
      const { env } = await import("../../src/config/env.js");
      const { createAuth } = await import("../../src/config/auth.js");
      const { createAuthService } =
        await import("../../src/features/auth/auth.service.js");
      const repository =
        await import("../../src/features/auth/auth.repository.js");
      const { db } = await import("@repo/db");
      const { createApp } = await import("../../src/app.js");
      const { createDatabaseCheck } =
        await import("../../src/routes/health.js");
      const { createReadinessCheck, createSchemaCheck } =
        await import("../../src/routes/readiness.js");
      auth = createAuth({ env, db, findAuthUser: repository.findAuthUser });
      const authService = createAuthService(auth, repository);
      const { createAdminService } =
        await import("../../src/features/admin/admin.service.js");
      const adminRepository =
        await import("../../src/features/admin/admin.repository.js");
      app = createApp({
        env,
        authService,
        adminService: createAdminService(adminRepository),
        checkDb: createDatabaseCheck(() => db.execute("SELECT 1")),
        checkReady: createReadinessCheck(env, createSchemaCheck(db)),
      });
    });
    it("requires a current approved admin and approves by user ID exactly once", async () => {
      const { db, user, session, eq } = await import("@repo/db");
      const { makeSignature } = await import("better-auth/crypto");
      const context = await auth.$context;
      const { internalAdapter } = context;

      // Mirrors a first GitHub sign-in: Better Auth creates the user, and the hook enforces safe defaults.
      const newUser = (name: string) =>
        internalAdapter.createUser(
          {
            name,
            email: `${randomUUID()}@example.com`,
            emailVerified: true,
          },
          { method: "oauth", oauth: { providerId: "github", profile: {} } },
        );
      const promote = (id: string) =>
        db
          .update(user)
          .set({ approved: true, role: "user" })
          .where(eq(user.id, id));
      const sessionCookie = async (userId: string) => {
        const created = await internalAdapter.createSession(userId, false);
        const signature = await makeSignature(created.token, SECRET);
        return `better-auth.session_token=${encodeURIComponent(`${created.token}.${signature}`)}`;
      };

      const pending = await newUser("Pending User");
      const [pendingRecord] = await db
        .select()
        .from(user)
        .where(eq(user.id, pending.id));
      expect(pendingRecord).toMatchObject({ role: "user", approved: false });
      expect(pendingRecord).not.toHaveProperty("approvalToken");
      // A pending account must not receive a session, even from direct calls.
      await expect(
        internalAdapter.createSession(pending.id),
      ).rejects.toMatchObject({
        statusCode: 403,
      });
      expect(
        await db.select().from(session).where(eq(session.userId, pending.id)),
      ).toHaveLength(0);
      const path = `/api/admin/users/${pending.id}/approve`;
      expect((await request(app).post(path)).status).toBe(401);
      expect((await request(app).get(path)).status).toBe(404);

      // Administrator privileges are granted out of band, never by sign-in.
      const admin = await newUser("Administrator");
      await db
        .update(user)
        .set({ approved: true, role: "admin" })
        .where(eq(user.id, admin.id));
      const cookie = await sessionCookie(admin.id);

      const member = await newUser("Ordinary Member");
      await promote(member.id);
      const memberCookie = await sessionCookie(member.id);
      expect(
        (await request(app).post(path).set("Cookie", memberCookie)).status,
      ).toBe(403);
      expect(
        (
          await request(app)
            .post(path)
            .set("Cookie", cookie)
            .set("Origin", "https://untrusted.example")
        ).status,
      ).toBe(403);
      expect(
        (
          await request(app)
            .post("/api/admin/users/invalid/approve")
            .set("Cookie", cookie)
        ).status,
      ).toBe(404);
      expect(
        (
          await request(app)
            .post(path)
            .set("Cookie", "better-auth.session_token=forged")
        ).status,
      ).toBe(401);

      const approvals = await Promise.all([
        request(app).post(path).set("Cookie", cookie),
        request(app).post(path).set("Cookie", cookie),
      ]);
      expect(approvals.map((r) => r.status).toSorted()).toEqual([200, 404]);
      const [approved] = await db
        .select()
        .from(user)
        .where(eq(user.id, pending.id));
      expect(approved).toMatchObject({
        approved: true,
        role: "user",
      });
      // The approved account can now obtain a session.
      const approvedSession = await internalAdapter.createSession(pending.id);
      expect(approvedSession).toMatchObject({ userId: pending.id });
      expect(
        (
          await auth.api.getSession({
            headers: new Headers({
              cookie: await sessionCookie(pending.id),
            }),
          })
        )?.user.id,
      ).toBe(pending.id);

      // Demotion must take effect even with a previously valid administrator session.
      await db.update(user).set({ role: "user" }).where(eq(user.id, admin.id));
      expect((await request(app).post(path).set("Cookie", cookie)).status).toBe(
        403,
      );
      await db
        .update(user)
        .set({ role: "admin", approved: false })
        .where(eq(user.id, admin.id));
      expect((await request(app).post(path).set("Cookie", cookie)).status).toBe(
        403,
      );
      await db.delete(session).where(eq(session.userId, admin.id));
      expect((await request(app).post(path).set("Cookie", cookie)).status).toBe(
        401,
      );
    });
  },
);
