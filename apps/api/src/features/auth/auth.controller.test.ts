import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "@repo/errors";
import { createTestDependencies } from "../../test/fakes.js";
import { createApp } from "../../app.js";

const deps = createTestDependencies();
const { env, authService: service } = deps;
let app = createApp(deps);
beforeEach(() => {
  vi.resetAllMocks();
  app = createApp(deps);
});
describe("custom auth routes", () => {
  it("preserves credentialed CORS preflight for the web app", async () => {
    const result = await request(app)
      .options("/api/auth/logout")
      .set("Origin", env.WEB_ORIGIN)
      .set("Access-Control-Request-Method", "POST")
      .set("Access-Control-Request-Headers", "content-type");

    expect(result.status).toBe(204);
    expect(result.headers["access-control-allow-origin"]).toBe(env.WEB_ORIGIN);
    expect(result.headers["access-control-allow-credentials"]).toBe("true");
  });

  it("keeps the malformed JSON error envelope and skips the controller", async () => {
    const result = await request(app)
      .post("/api/auth/confirm/signed-token")
      .set("Content-Type", "application/json")
      .send("{invalid");

    expect(result.status).toBe(400);
    expect(result.body).toEqual({
      ok: false,
      status: "fail",
      code: "BAD_REQUEST",
      error: "Invalid JSON body",
    });
    expect(service.confirm).not.toHaveBeenCalled();
  });

  it("rejects an untrusted browser origin", async () => {
    expect(
      (
        await request(app)
          .post("/api/auth/confirm/signed-token")
          .set("Origin", "https://untrusted.example")
      ).status,
    ).toBe(403);
    expect(service.confirm).not.toHaveBeenCalled();
  });
  it("passes the confirmation token and prevents caching/referrer leakage", async () => {
    vi.mocked(service.confirm).mockResolvedValue({ message: "Confirmed" });
    const result = await request(app).post("/api/auth/confirm/signed-token");
    expect(result.status).toBe(200);
    expect(result.headers["cache-control"]).toBe("no-store");
    expect(result.headers["referrer-policy"]).toBe("no-referrer");
    expect(service.confirm).toHaveBeenCalledWith(
      "signed-token",
      expect.any(Headers),
    );
  });
  it("uses the existing error envelope", async () => {
    vi.mocked(service.confirm).mockRejectedValue(
      AppError.unauthorized("Authentication required"),
    );
    const result = await request(app).post("/api/auth/confirm/signed-token");
    expect(result.status).toBe(401);
    expect(result.body).toMatchObject({ ok: false, code: "UNAUTHORIZED" });
  });
  it.each(["confirm", "users"])(
    "validates the %s token before calling its service",
    async (route) => {
      const path = `/api/auth/${route}/${"x".repeat(4097)}`;
      const result = await (route === "confirm"
        ? request(app).post(path)
        : request(app).delete(path));

      expect(result.status).toBe(422);
      expect(result.body).toMatchObject({
        ok: false,
        status: "fail",
        code: "VALIDATION_ERROR",
        details: [{ path: "id", code: "too_big" }],
      });
      expect(service.confirm).not.toHaveBeenCalled();
      expect(service.deleteUser).not.toHaveBeenCalled();
    },
  );
  it("does not expose password or default Better Auth routes", async () => {
    const responses = await Promise.all(
      [
        "/api/auth/sign-up/email",
        "/api/auth/sign-in/email",
        "/api/auth/register",
        "/api/auth/login",
        "/api/auth/two-factor/enable",
      ].map((path) => request(app).post(path).send({})),
    );
    expect(responses.map((response) => response.status)).toEqual([
      404, 404, 404, 404, 404,
    ]);
  });
  it("limits repeated approval attempts", async () => {
    vi.mocked(service.confirm).mockResolvedValue({ message: "Confirmed" });
    const results = await Promise.all(
      Array.from({ length: 11 }, () =>
        request(app).post("/api/auth/confirm/signed-token"),
      ),
    );
    const result = results.at(-1);
    expect(result!.status).toBe(429);
    expect(result!.body.code).toBe("TOO_MANY_REQUESTS");
  });
});

describe("GitHub OAuth routes", () => {
  it("redirects to GitHub and forwards the state cookie", async () => {
    const stateHeaders = new Headers();
    stateHeaders.append("set-cookie", "better-auth.state=s; HttpOnly; Path=/");
    vi.mocked(service.initiateGitHubSignIn).mockResolvedValue({
      headers: stateHeaders,
      response: {
        url: "https://github.com/login/oauth/authorize?state=s",
        redirect: true,
      },
    });
    const result = await request(app).get(
      "/api/auth/sign-in/github?callbackURL=/dashboard",
    );
    expect(result.status).toBe(302);
    expect(result.headers["location"]).toBe(
      "https://github.com/login/oauth/authorize?state=s",
    );
    expect(result.headers["set-cookie"]).toContain(
      "better-auth.state=s; HttpOnly; Path=/",
    );
    expect(service.initiateGitHubSignIn).toHaveBeenCalledWith(
      "/dashboard",
      expect.any(Headers),
    );
  });

  it.each([
    "",
    "?callbackURL=/one&callbackURL=/two",
    "?callbackURL[path]=/dashboard",
    "?callbackURL[]=/dashboard",
  ])(
    "defaults callbackURL for absent or non-string queries: %s",
    async (query) => {
      vi.mocked(service.initiateGitHubSignIn).mockResolvedValue({
        headers: new Headers(),
        response: {
          url: "https://github.com/login/oauth/authorize",
          redirect: true,
        },
      });
      const result = await request(app).get(`/api/auth/sign-in/github${query}`);
      expect(result.status).toBe(302);
      expect(service.initiateGitHubSignIn).toHaveBeenCalledWith(
        new URL("/", env.WEB_ORIGIN).href,
        expect.any(Headers),
      );
    },
  );

  it("preserves encoded callbackURL strings", async () => {
    vi.mocked(service.initiateGitHubSignIn).mockResolvedValue({
      headers: new Headers(),
      response: {
        url: "https://github.com/login/oauth/authorize",
        redirect: true,
      },
    });
    const callbackURL = "/dashboard?tab=map&label=a+b";

    const result = await request(app).get(
      `/api/auth/sign-in/github?callbackURL=${encodeURIComponent(callbackURL)}`,
    );

    expect(result.status).toBe(302);
    expect(service.initiateGitHubSignIn).toHaveBeenCalledWith(
      callbackURL,
      expect.any(Headers),
    );
  });

  it.each([
    {
      search: "code=a%2Bb%2Fc%3D%20&state=s%26t%3Dx",
      query: { code: "a+b/c= ", state: "s&t=x" },
    },
    {
      search: "error=access_denied&error_description=User+cancelled&state=xyz",
      query: {
        error: "access_denied",
        error_description: "User cancelled",
        state: "xyz",
      },
    },
    {
      search: "code=one&code=two&state=xyz&extra[nested]=value",
      query: { code: ["one", "two"], state: "xyz", extra: { nested: "value" } },
    },
  ])(
    "preserves existing OAuth callback query parsing: $search",
    async ({ search, query }) => {
      vi.mocked(service.handleGitHubCallback).mockResolvedValue(
        new Response(null, { status: 400 }),
      );

      const result = await request(app)
        .get(`/api/auth/callback/github?${search}`)
        .set("Cookie", "better-auth.state=signed-state");

      expect(result.status).toBe(302);
      expect(service.handleGitHubCallback).toHaveBeenCalledWith(
        query,
        expect.any(Headers),
      );
      expect(
        vi.mocked(service.handleGitHubCallback).mock.calls[0][1].get("cookie"),
      ).toBe("better-auth.state=signed-state");
    },
  );

  it.each([403, 500, 200])(
    "returns callback failures (%s) to the web login page",
    async (status) => {
      vi.mocked(service.handleGitHubCallback).mockResolvedValue(
        new Response(null, { status }),
      );
      const result = await request(app).get(
        "/api/auth/callback/github?code=abc&state=xyz",
      );
      const location = new URL(result.headers.location);
      expect(location.origin).toBe(new URL(env.WEB_ORIGIN).origin);
      expect(location.pathname).toBe("/login");
      expect(location.searchParams.get("error")).toBe(
        status === 403 ? "github_access_denied" : "github_sign_in_failed",
      );
    },
  );

  it("sets the session cookie and redirects to callbackURL after a successful callback", async () => {
    const callbackResponse = new Response(null, {
      status: 302,
      headers: {
        Location: "http://localhost:5173/dashboard",
        "Set-Cookie": "better-auth.session_token=tok; HttpOnly; Path=/",
      },
    });
    vi.mocked(service.handleGitHubCallback).mockResolvedValue(callbackResponse);
    const result = await request(app).get(
      "/api/auth/callback/github?code=abc&state=xyz",
    );
    expect(result.status).toBe(302);
    expect(result.headers["location"]).toBe("http://localhost:5173/dashboard");
    expect(result.headers["set-cookie"][0]).toContain(
      "better-auth.session_token=tok",
    );
    expect(service.handleGitHubCallback).toHaveBeenCalledWith(
      { code: "abc", state: "xyz" },
      expect.any(Headers),
    );
  });
});

describe("session lifecycle routes", () => {
  it("does not throttle routine session checks with the approval limiter", async () => {
    vi.mocked(service.getSession).mockResolvedValue({
      user: {
        id: "1",
        name: "Test",
        email: "test@example.com",
        emailVerified: false,
        role: "user",
        image: null,
      },
    });
    const results = await Promise.all(
      Array.from({ length: 12 }, () => request(app).get("/api/auth/session")),
    );
    expect(results.every((result) => result.status === 200)).toBe(true);
  });
  it("clears cookies on logout and rejects untrusted origins", async () => {
    vi.mocked(service.logout).mockResolvedValue({
      headers: new Headers({
        "set-cookie": "session=; Max-Age=0; HttpOnly; Path=/",
      }),
      response: { success: true, url: undefined, redirect: undefined },
    });
    const result = await request(app).post("/api/auth/logout");
    expect(result.status).toBe(200);
    expect(result.headers["set-cookie"][0]).toContain("Max-Age=0");
    expect(
      (
        await request(app)
          .post("/api/auth/logout")
          .set("Origin", "https://untrusted.example")
      ).status,
    ).toBe(403);
  });
});

it("lists users through the admin service", async () => {
  vi.mocked(service.getUsers).mockResolvedValue({ users: [] });
  const result = await request(app).get("/api/auth/users");
  expect(result.status).toBe(200);
  expect(result.body).toEqual({ users: [] });
  expect(service.getUsers).toHaveBeenCalledWith(expect.any(Headers));
});
it("deletes the specified account and rejects cross-site deletion", async () => {
  const rejected = await request(app)
    .delete("/api/auth/users/target")
    .set("Origin", "https://untrusted.example");
  expect(rejected.status).toBe(403);
  expect(service.deleteUser).not.toHaveBeenCalled();
  vi.mocked(service.deleteUser).mockResolvedValue({ message: "User deleted" });
  const result = await request(app)
    .delete("/api/auth/users/target")
    .set("Origin", new URL(env.WEB_ORIGIN).origin);
  expect(result.status).toBe(200);
  expect(service.deleteUser).toHaveBeenCalledWith(
    "target",
    expect.any(Headers),
  );
});
