import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "@repo/errors";
import { errorMiddleware } from "@middleware/error";
import * as service from "./auth.service";
import { authRouter } from "./auth.routes";

vi.mock("./auth.service", () => ({
  getSession: vi.fn(),
  getPendingUsers: vi.fn(),
  logout: vi.fn(),
  register: vi.fn(),
  confirm: vi.fn(),
  login: vi.fn(),
  initiateGitHubSignIn: vi.fn(),
  handleGitHubCallback: vi.fn(),
}));
const app = express()
  .use(express.json())
  .use("/api/auth", authRouter)
  .use(errorMiddleware);
const credentials = { email: "person@example.com", password: "test-password" };
beforeEach(() => vi.clearAllMocks());
describe("custom auth routes", () => {
  it("validates input before calling registration", async () => {
    expect(
      (await request(app).post("/api/auth/register").send({ email: "bad" }))
        .status,
    ).toBe(422);
    expect(service.register).not.toHaveBeenCalled();
  });
  it("registers using validated input and forwarded headers", async () => {
    vi.mocked(service.register).mockResolvedValue({
      message: "Awaiting administrator approval",
    });
    const result = await request(app)
      .post("/api/auth/register")
      .set("Origin", "http://localhost:5173")
      .send({ ...credentials, name: " Person " });
    expect(result.status).toBe(200);
    expect(service.register).toHaveBeenCalledWith(
      { ...credentials, name: "Person" },
      expect.any(Headers),
    );
  });
  it("rejects an untrusted browser origin", async () => {
    expect(
      (
        await request(app)
          .post("/api/auth/login")
          .set("Origin", "https://untrusted.example")
          .send(credentials)
      ).status,
    ).toBe(403);
    expect(service.login).not.toHaveBeenCalled();
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
  it("preserves multiple session cookies separately", async () => {
    const headers = new Headers();
    headers.append("set-cookie", "session=one; HttpOnly; Path=/");
    headers.append("set-cookie", "other=two; HttpOnly; Path=/");
    vi.mocked(service.login).mockResolvedValue({
      headers,
      body: {
        user: {
          id: "1",
          email: credentials.email,
          name: "Person",
          emailVerified: true,
          role: "user",
          image: null,
        },
      },
    });
    const result = await request(app).post("/api/auth/login").send(credentials);
    expect(result.status).toBe(200);
    expect(result.headers["set-cookie"]).toEqual(headers.getSetCookie());
    expect(result.body.token).toBeUndefined();
  });
  it("uses the existing error envelope", async () => {
    vi.mocked(service.login).mockRejectedValue(
      AppError.unauthorized("Invalid credentials"),
    );
    const result = await request(app).post("/api/auth/login").send(credentials);
    expect(result.status).toBe(401);
    expect(result.body).toMatchObject({ ok: false, code: "UNAUTHORIZED" });
  });
  it("does not expose default Better Auth routes", async () => {
    expect(
      (await request(app).post("/api/auth/sign-up/email").send(credentials))
        .status,
    ).toBe(404);
  });
  it("limits repeated authentication requests", async () => {
    const results = await Promise.all(
      Array.from({ length: 11 }, () =>
        request(app).post("/api/auth/login").send({}),
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

  it("defaults callbackURL to / when the parameter is absent", async () => {
    vi.mocked(service.initiateGitHubSignIn).mockResolvedValue({
      headers: new Headers(),
      response: { url: "https://github.com/login/oauth/authorize", redirect: true },
    });
    await request(app).get("/api/auth/sign-in/github");
    expect(service.initiateGitHubSignIn).toHaveBeenCalledWith(
      "/",
      expect.any(Headers),
    );
  });

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
  it("does not throttle routine session checks with the login limiter", async () => {
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
