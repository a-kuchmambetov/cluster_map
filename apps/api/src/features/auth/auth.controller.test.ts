import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "@repo/errors";
import { errorMiddleware } from "@middleware/error";
import * as service from "./auth.service";
import { authRouter } from "./auth.routes";

vi.mock("./auth.service", () => ({
  register: vi.fn(),
  confirm: vi.fn(),
  login: vi.fn(),
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
