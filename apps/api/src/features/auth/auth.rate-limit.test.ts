import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type * as AuthService from "./auth.service";

vi.mock("./auth.service", async (importOriginal) => ({
  ...(await importOriginal<typeof AuthService>()),
  login: vi.fn(async () => {
    const { AppError } = await import("@repo/errors");
    throw AppError.unauthorized("Invalid email or password");
  }),
}));

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv("TRUST_PROXY_HOPS", "1");
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "log").mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("auth limits behind a reverse proxy", () => {
  it("gives each client its own budget and rejects spoofed forwarding prefixes", async () => {
    const { app } = await import("../../app.js");
    const login = (forwardedFor: string) =>
      request(app)
        .post("/api/auth/login")
        .set("X-Forwarded-For", forwardedFor)
        .send({ email: "person@example.com", password: "wrong-password" });

    for (let attempt = 0; attempt < 10; attempt++) {
      // eslint-disable-next-line no-await-in-loop -- Verify the sequential attempt budget.
      expect((await login("198.51.100.1")).status).toBe(401);
    }
    const blocked = await login("198.51.100.1");
    expect(blocked.status).toBe(429);
    expect(blocked.body).toMatchObject({
      code: "TOO_MANY_REQUESTS",
      error: "Too many authentication attempts. Try again later.",
    });
    expect(Number(blocked.headers["retry-after"])).toBeGreaterThan(0);
    expect((await login("198.51.100.2")).status).toBe(401);
    expect((await login("203.0.113.99, 198.51.100.1")).status).toBe(429);
  });

  it("ignores forwarded client identities when no proxy is trusted", async () => {
    vi.stubEnv("TRUST_PROXY_HOPS", "0");
    const { app } = await import("../../app.js");
    for (let attempt = 0; attempt < 11; attempt++) {
      // eslint-disable-next-line no-await-in-loop -- The eleventh request must be the blocked one.
      const response = await request(app)
        .post("/api/auth/login")
        .set("X-Forwarded-For", `198.51.100.${attempt + 1}`)
        .send({ email: "person@example.com", password: "wrong-password" });
      expect(response.status).toBe(attempt < 10 ? 401 : 429);
    }
  });
});
