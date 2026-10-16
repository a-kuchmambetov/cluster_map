import type { Express } from "express";
import type { Auth } from "../../config/auth";
import type { AuthService } from "../../features/auth/auth.service";
import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { eq } from "drizzle-orm";

const SECRET = "integration-test-secret-at-least-32-characters";

// Requires migrated, disposable PostgreSQL selected by PG_* environment variables.
describe.runIf(process.env.AUTH_DB_TEST === "1")(
  "administrator approval with PostgreSQL",
  () => {
    let app: Express;
    let auth: Auth;
    let authService: AuthService;
    beforeAll(async () => {
      process.env.BETTER_AUTH_SECRET = SECRET;
      process.env.BETTER_AUTH_URL = "http://localhost:5000";
      process.env.GITHUB_CLIENT_ID ??= "integration-test";
      process.env.GITHUB_CLIENT_SECRET ??= "integration-test";
      const { env } = await import("../../config/env.js");
      const { createAuth } = await import("../../config/auth.js");
      const { createAuthService } =
        await import("../../features/auth/auth.service.js");
      const repository = await import("../../features/auth/auth.repository.js");
      const { db } = await import("@repo/db");
      const { createApp } = await import("../../app.js");
      const { createDatabaseCheck } = await import("../../routes/health.js");
      const { createReadinessCheck, createSchemaCheck } =
        await import("../../routes/readiness.js");
      auth = createAuth({ env, db, findAuthUser: repository.findAuthUser });
      authService = createAuthService(auth, repository);
      app = createApp({
        env,
        authService,
        checkDb: createDatabaseCheck(
          () => db.execute("SELECT 1"),
          env.PG_PASSWORD,
        ),
        checkReady: createReadinessCheck(env, createSchemaCheck(db)),
      });
    });
    it("requires a current approved admin and consumes the approval token exactly once", async () => {
      const { db, user, session } = await import("@repo/db");
      const { makeSignature } = await import("better-auth/crypto");
      const { confirm } = authService;
      const context = await auth.$context;
      const { internalAdapter } = context;

      // Mirrors a first GitHub sign-in: Better Auth creates the user, and the hook issues the approval token.
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
          .set({ approved: true, role: "user", approvalToken: null })
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
      expect(pendingRecord.approvalToken).toMatch(/^[a-f0-9]{64}$/);
      // A pending account must not receive a session, even from direct calls.
      await expect(
        internalAdapter.createSession(pending.id),
      ).rejects.toMatchObject({
        statusCode: 403,
      });
      expect(
        await db.select().from(session).where(eq(session.userId, pending.id)),
      ).toHaveLength(0);
      const token = pendingRecord.approvalToken!;
      const path = `/api/auth/confirm/${token}`;
      expect((await request(app).post(path)).status).toBe(401);
      expect((await request(app).get(path)).status).toBe(404);

      // Administrator privileges are granted out of band, never by sign-in.
      const admin = await newUser("Administrator");
      await db
        .update(user)
        .set({ approved: true, role: "admin", approvalToken: null })
        .where(eq(user.id, admin.id));
      const cookie = await sessionCookie(admin.id);
      const headers = new Headers({ cookie });

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
            .post("/api/auth/confirm/invalid")
            .set("Cookie", cookie)
        ).status,
      ).toBe(404);
      await expect(
        confirm(
          token,
          new Headers({ cookie: "better-auth.session_token=forged" }),
        ),
      ).rejects.toMatchObject({ statusCode: 401 });

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
        approvalToken: null,
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
      await expect(confirm(token, headers)).rejects.toMatchObject({
        statusCode: 403,
      });
      await db.delete(session).where(eq(session.userId, admin.id));
      await expect(confirm(token, headers)).rejects.toMatchObject({
        statusCode: 401,
      });
    });
  },
);
