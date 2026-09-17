import type { Express } from "express";
import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { eq } from "drizzle-orm";

// Requires migrated, disposable PostgreSQL selected by PG_* environment variables.
describe.runIf(process.env.AUTH_DB_TEST === "1")(
  "administrator approval with PostgreSQL",
  () => {
    let app: Express;
    beforeAll(async () => {
      process.env.BETTER_AUTH_SECRET =
        "integration-test-secret-at-least-32-characters";
      process.env.BETTER_AUTH_URL = "http://localhost:5000";
      app = (await import("../../app.js")).app;
    });
    it("requires a current approved admin and consumes the approval token exactly once", async () => {
      const { auth } = await import("../../config/auth.js");
      const { db, user, session } = await import("@repo/db");
      const { confirm, register } =
        await import("../../features/auth/auth.service.js");
      const credentials = (name: string) => ({
        name,
        email: `${randomUUID()}@example.com`,
        password: "integration-password",
      });
      const body = credentials("Pending User");
      const registration = await request(app)
        .post("/api/auth/register")
        .send({
          ...body,
          role: "admin",
          approved: true,
          approvalToken: "attacker-token",
        });
      expect(registration.status).toBe(200);
      expect(registration.headers["set-cookie"]).toBeUndefined();
      expect(registration.body).not.toHaveProperty("approvalToken");
      const [pending] = await db
        .select()
        .from(user)
        .where(eq(user.email, body.email));
      expect(pending).toMatchObject({
        role: "user",
        approved: false,
        emailVerified: false,
      });
      expect(pending.approvalToken).toMatch(/^[a-f0-9]{64}$/);
      await expect(auth.api.signInEmail({ body })).rejects.toMatchObject({
        statusCode: 403,
      });
      expect(
        await db.select().from(session).where(eq(session.userId, pending.id)),
      ).toHaveLength(0);
      const token = pending.approvalToken!;
      const path = `/api/auth/confirm/${token}`;
      expect((await request(app).post(path)).status).toBe(401);
      expect((await request(app).get(path)).status).toBe(404);

      const adminBody = credentials("Administrator");
      const adminRegistration = await auth.api.signUpEmail({ body: adminBody });
      expect(adminRegistration.user).not.toHaveProperty("approvalToken");
      // Out-of-band bootstrap: registration must never grant administrator privileges.
      await db
        .update(user)
        .set({ approved: true, role: "admin", approvalToken: null })
        .where(eq(user.id, adminRegistration.user.id));
      const adminLogin = await auth.api.signInEmail({
        body: adminBody,
        returnHeaders: true,
      });
      const cookie = adminLogin.headers
        .getSetCookie()
        .map((c) => c.split(";")[0])
        .join("; ");
      const headers = new Headers({ cookie });

      const memberBody = credentials("Ordinary Member");
      const member = await auth.api.signUpEmail({ body: memberBody });
      await db
        .update(user)
        .set({ approved: true, approvalToken: null })
        .where(eq(user.id, member.user.id));
      const memberLogin = await auth.api.signInEmail({
        body: memberBody,
        returnHeaders: true,
      });
      const memberCookie = memberLogin.headers
        .getSetCookie()
        .map((c) => c.split(";")[0])
        .join("; ");
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
        emailVerified: false,
        approvalToken: null,
      });
      const loggedIn = await request(app).post("/api/auth/login").send(body);
      expect(loggedIn.status).toBe(200);
      expect(loggedIn.body.user.emailVerified).toBe(false);
      expect(loggedIn.body).not.toHaveProperty("token");
      const userCookie = (loggedIn.headers["set-cookie"] as unknown as string[])
        .map((c) => c.split(";")[0])
        .join("; ");
      expect(
        (
          await auth.api.getSession({
            headers: new Headers({ cookie: userCookie }),
          })
        )?.user.id,
      ).toBe(pending.id);
      await expect(
        auth.api.signInEmail({
          body: { ...body, password: "incorrect-password" },
        }),
      ).rejects.toMatchObject({ statusCode: 401 });
      expect(await register(body, new Headers())).toEqual(registration.body);

      // Demotion must take effect even with a previously valid administrator session.
      await db
        .update(user)
        .set({ role: "user" })
        .where(eq(user.id, adminRegistration.user.id));
      expect((await request(app).post(path).set("Cookie", cookie)).status).toBe(
        403,
      );
      await db
        .update(user)
        .set({ role: "admin", approved: false })
        .where(eq(user.id, adminRegistration.user.id));
      await expect(confirm(token, headers)).rejects.toMatchObject({
        statusCode: 403,
      });
      await db
        .delete(session)
        .where(eq(session.userId, adminRegistration.user.id));
      await expect(confirm(token, headers)).rejects.toMatchObject({
        statusCode: 401,
      });
    });
  },
);
