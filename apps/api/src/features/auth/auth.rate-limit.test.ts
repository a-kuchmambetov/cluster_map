import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "@repo/errors";
import { createApp } from "../../app.js";
import { createTestDependencies } from "../../test/fakes.js";

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "log").mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

function makeApp(trustProxyHops: number) {
  const deps = createTestDependencies();
  deps.env.TRUST_PROXY_HOPS = trustProxyHops;
  deps.authService.confirm.mockRejectedValue(
    AppError.unauthorized("Authentication required"),
  );
  return createApp(deps);
}

describe("auth limits behind a reverse proxy", () => {
  it("gives each client its own budget and rejects spoofed forwarding prefixes", async () => {
    const app = makeApp(1);
    const approve = (forwardedFor: string) =>
      request(app)
        .post("/api/auth/confirm/approval-token")
        .set("X-Forwarded-For", forwardedFor);

    for (let attempt = 0; attempt < 10; attempt++) {
      // eslint-disable-next-line no-await-in-loop -- Verify the sequential attempt budget.
      expect((await approve("198.51.100.1")).status).toBe(401);
    }
    const blocked = await approve("198.51.100.1");
    expect(blocked.status).toBe(429);
    expect(blocked.body).toMatchObject({
      code: "TOO_MANY_REQUESTS",
      error: "Too many authentication attempts. Try again later.",
    });
    expect(Number(blocked.headers["retry-after"])).toBeGreaterThan(0);
    expect((await approve("198.51.100.2")).status).toBe(401);
    expect((await approve("203.0.113.99, 198.51.100.1")).status).toBe(429);
  });

  it("ignores forwarded client identities when no proxy is trusted", async () => {
    const app = makeApp(0);
    for (let attempt = 0; attempt < 11; attempt++) {
      // eslint-disable-next-line no-await-in-loop -- The eleventh request must be the blocked one.
      const response = await request(app)
        .post("/api/auth/confirm/approval-token")
        .set("X-Forwarded-For", `198.51.100.${attempt + 1}`);
      expect(response.status).toBe(attempt < 10 ? 401 : 429);
    }
  });
});
