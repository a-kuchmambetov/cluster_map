import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../../../../src/app.js";
import { createAuthService } from "../../../../src/features/auth/auth.service.js";
import { createAdminService } from "../../../../src/features/admin/admin.service.js";
import { createTestDependencies } from "../../../helpers/fakes.js";

const publicUser = {
  id: "actor",
  name: "Admin",
  email: "admin@example.test",
  emailVerified: true,
  image: null,
  role: "admin",
};
const account = {
  id: "opaque-BetterAuth-ID",
  name: "Pending",
  email: "pending@example.test",
  role: "user",
  approved: false,
  createdAt: new Date("2026-01-01T00:00:00Z"),
};
function setup() {
  const authApi = {
    getSession: vi.fn().mockResolvedValue({ user: publicUser }),
    signInSocial: vi.fn(),
    callbackOAuth: vi.fn(),
    signOut: vi.fn(),
  };
  const authRepository = {
    findAuthUser: vi
      .fn()
      .mockResolvedValue({ id: "actor", role: "admin", approved: true }),
  };
  const repository = {
    listUsers: vi.fn().mockResolvedValue([account]),
    approveUser: vi.fn().mockResolvedValue({ id: account.id }),
    deleteUser: vi.fn().mockResolvedValue({ id: account.id }),
  };
  const service = createAdminService(repository);
  const app = createApp({
    ...createTestDependencies(),
    authService: createAuthService({ api: authApi }, authRepository),
    adminService: service,
  });
  return { app, authApi, authRepository, repository, service };
}
let ctx: ReturnType<typeof setup>;
beforeEach(() => {
  ctx = setup();
});
const approvePath = `/api/admin/users/${account.id}/approve`;

describe("admin HTTP authorization boundary", () => {
  it.each(["list", "pending", "approve", "delete"])(
    "rejects absent sessions before %s access",
    async (operation) => {
      ctx.authApi.getSession.mockResolvedValue(null);
      const result = await call(operation);
      expect(result.status).toBe(401);
      expect(ctx.authRepository.findAuthUser).not.toHaveBeenCalled();
      expectNoBusinessCalls();
    },
  );

  it.each([
    { role: "user", approved: true },
    { role: "admin", approved: false },
    undefined,
    { role: "superadmin", approved: true },
  ])(
    "rejects current unauthorized privileges %j despite cached admin claims",
    async (actor) => {
      ctx.authRepository.findAuthUser.mockResolvedValue(actor);
      const results = await Promise.all(
        ["list", "pending", "approve", "delete"].map(call),
      );
      expect(results.map((result) => result.status)).toEqual([
        403, 403, 403, 403,
      ]);
      expectNoBusinessCalls();
    },
  );

  it.each(["list", "pending", "approve", "delete"])(
    "resolves %s identity once with a fresh session and current privileges",
    async (operation) => {
      expect((await call(operation)).status).toBe(200);
      expect(ctx.authApi.getSession).toHaveBeenCalledExactlyOnceWith({
        headers: expect.any(Headers),
        query: { disableCookieCache: true },
      });
      expect(ctx.authRepository.findAuthUser).toHaveBeenCalledExactlyOnceWith(
        "actor",
      );
    },
  );

  it("resolves normal cluster access exactly once at the same boundary", async () => {
    expect((await request(ctx.app).get("/api/clusters")).status).toBe(200);
    expect(ctx.authApi.getSession).toHaveBeenCalledOnce();
    expect(ctx.authRepository.findAuthUser).toHaveBeenCalledOnce();
    expectNoBusinessCalls();
  });

  it("uses the database role for the unchanged sanitized session payload", async () => {
    ctx.authRepository.findAuthUser.mockResolvedValue({
      role: "user",
      approved: true,
    });
    const result = await request(ctx.app)
      .get("/api/auth/session")
      .set("X-User-Id", "forged")
      .set("X-Role", "admin");
    expect(result.status).toBe(200);
    expect(result.body).toEqual({ user: { ...publicUser, role: "user" } });
    expect(ctx.authApi.getSession).toHaveBeenCalledOnce();
    expect(ctx.authRepository.findAuthUser).toHaveBeenCalledExactlyOnceWith(
      "actor",
    );
  });

  it("observes demotion, approval revocation and expired sessions on the next request", async () => {
    expect((await call("list")).status).toBe(200);
    ctx.repository.listUsers.mockClear();
    ctx.authRepository.findAuthUser.mockResolvedValue({
      role: "user",
      approved: true,
    });
    expect((await call("list")).status).toBe(403);
    ctx.authRepository.findAuthUser.mockResolvedValue({
      role: "admin",
      approved: false,
    });
    expect((await call("list")).status).toBe(403);
    ctx.authApi.getSession.mockResolvedValue(null);
    expect((await call("list")).status).toBe(401);
    expectNoBusinessCalls();
  });

  it.each(["approve", "delete"])(
    "rejects untrusted origins and cross-site writes before %s auth or business work",
    async (operation) => {
      const foreignOrigin = await call(operation).set(
        "Origin",
        "https://untrusted.example",
      );
      const crossSite = await call(operation).set(
        "Sec-Fetch-Site",
        "cross-site",
      );
      expect([foreignOrigin.status, crossSite.status]).toEqual([403, 403]);
      expect(ctx.authApi.getSession).not.toHaveBeenCalled();
      expectNoBusinessCalls();
    },
  );

  it("retains credentialed preflight and no-store/referrer headers", async () => {
    const preflight = await request(ctx.app)
      .options(approvePath)
      .set("Origin", "http://localhost:5173")
      .set("Access-Control-Request-Method", "POST");
    expect(preflight.status).toBe(204);
    expect(preflight.headers["access-control-allow-credentials"]).toBe("true");
    expect(preflight.headers["access-control-allow-origin"]).toBe(
      "http://localhost:5173",
    );
    const result = await call("approve").set("Origin", "http://localhost:5173");
    expect(result.status).toBe(200);
    expect(result.headers["cache-control"]).toBe("no-store");
    expect(result.headers["referrer-policy"]).toBe("no-referrer");
  });

  it("blocks the eleventh approval before session and business calls, without limiting other routes", async () => {
    for (let i = 0; i < 10; i++) {
      // eslint-disable-next-line no-await-in-loop -- Verify the sequential budget.
      expect((await call("approve")).status).toBe(200);
    }
    const blocked = await call("approve");
    expect(blocked.status).toBe(429);
    expect(blocked.body.code).toBe("TOO_MANY_REQUESTS");
    expect(ctx.authApi.getSession).toHaveBeenCalledTimes(10);
    expect(ctx.repository.approveUser).toHaveBeenCalledTimes(10);
    expect((await call("list")).status).toBe(200);
    expect((await call("delete")).status).toBe(200);
    expect((await request(ctx.app).get("/api/auth/session")).status).toBe(200);
    expect((await request(ctx.app).post("/api/admin/unknown")).status).toBe(
      404,
    );
  });
});

describe("admin contract and validation", () => {
  it.each([undefined, "pending"])(
    "lists tokenless accounts with status=%s",
    async (status) => {
      const result = await request(ctx.app).get(
        `/api/admin/users${status ? "?status=pending" : ""}`,
      );
      expect(result.status).toBe(200);
      expect(result.body).toEqual({
        users: [{ ...account, createdAt: account.createdAt.toISOString() }],
      });
      expect(ctx.repository.listUsers).toHaveBeenCalledExactlyOnceWith(status);
    },
  );

  it.each(["approved", "pending&status=pending", "pending&status[nested]=bad"])(
    "rejects unsupported/ambiguous status %s",
    async (query) => {
      expect(
        (await request(ctx.app).get(`/api/admin/users?status=${query}`)).status,
      ).toBe(422);
      expectNoBusinessCalls();
    },
  );

  it.each([
    { id: "%20", label: "blank" },
    { id: "%00", label: "control byte" },
    { id: "a%0Ab", label: "newline" },
    { id: "x".repeat(4097), label: "oversized" },
  ])(
    "rejects invalid opaque user IDs before writes ($label)",
    async ({ id }) => {
      expect(
        (await request(ctx.app).post(`/api/admin/users/${id}/approve`)).status,
      ).toBe(422);
      expect(
        (await request(ctx.app).delete(`/api/admin/users/${id}`)).status,
      ).toBe(422);
      expectNoBusinessCalls();
    },
  );

  it("authorizes before reporting invalid input", async () => {
    ctx.authRepository.findAuthUser.mockResolvedValue({
      role: "user",
      approved: true,
    });
    expect(
      (
        await request(ctx.app).post(
          `/api/admin/users/${"x".repeat(4097)}/approve`,
        )
      ).status,
    ).toBe(403);
    expectNoBusinessCalls();
  });

  it("approves by user ID and rejects missing/already-approved accounts", async () => {
    expect((await call("approve")).status).toBe(200);
    expect(ctx.repository.approveUser).toHaveBeenCalledExactlyOnceWith(
      account.id,
    );
    ctx.repository.approveUser.mockResolvedValue(undefined);
    const result = await call("approve");
    expect(result.status).toBe(404);
    expect(result.body.error).toBe("User not found or already approved");
  });

  it("uses the trusted actor for self-deletion, ignoring forged input", async () => {
    const result = await request(ctx.app)
      .delete("/api/admin/users/actor")
      .set("X-User-Id", "other")
      .send({ actor: { id: "other", role: "admin" } });
    expect(result.status).toBe(403);
    expect(ctx.repository.deleteUser).not.toHaveBeenCalled();
    ctx.repository.deleteUser.mockResolvedValue(undefined);
    expect((await call("delete")).status).toBe(404);
  });

  it("keeps the malformed JSON envelope and skips business work", async () => {
    const result = await request(ctx.app)
      .post(approvePath)
      .set("Content-Type", "application/json")
      .send("{invalid");
    expect(result.status).toBe(400);
    expect(result.body).toMatchObject({
      ok: false,
      code: "BAD_REQUEST",
      error: "Invalid JSON body",
    });
    expectNoBusinessCalls();
  });

  it("removes all legacy administration routes without insecure aliases", async () => {
    const results = await Promise.all([
      request(ctx.app).get("/api/auth/users"),
      request(ctx.app).get("/api/auth/pending-users"),
      request(ctx.app).post("/api/auth/confirm/obsolete-token"),
      request(ctx.app).delete(`/api/auth/users/${account.id}`),
    ]);
    expect(results.map((result) => result.status)).toEqual([
      404, 404, 404, 404,
    ]);
    expect(ctx.authApi.getSession).not.toHaveBeenCalled();
    expectNoBusinessCalls();
  });
});

function call(operation: string) {
  switch (operation) {
    case "list":
      return request(ctx.app).get("/api/admin/users");
    case "pending":
      return request(ctx.app).get("/api/admin/users?status=pending");
    case "approve":
      return request(ctx.app).post(approvePath);
    case "delete":
      return request(ctx.app).delete(`/api/admin/users/${account.id}`);
    default:
      throw new Error("Unknown test operation");
  }
}
function expectNoBusinessCalls() {
  for (const method of Object.values(ctx.repository))
    expect(method).not.toHaveBeenCalled();
}
