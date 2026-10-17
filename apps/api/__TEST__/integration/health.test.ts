import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { createRuntime } from "../../src/lifecycle/runtime.js";
import { createTestDependencies } from "../helpers/fakes.js";

describe("liveness and readiness", () => {
  it("returns process liveness without invoking either failing check, even while draining", async () => {
    const deps = createTestDependencies();
    deps.checkDb.mockRejectedValue(new Error("database down"));
    deps.checkReady.mockRejectedValue(new Error("schema down"));
    const runtime = createRuntime();
    const app = createApp({ ...deps, runtime });
    for (const drain of [false, true]) {
      if (drain) runtime.beginDrain();
      // Ordered state transition: check liveness before and after draining.
      // eslint-disable-next-line no-await-in-loop
      const response = await request(app).get("/api/health");
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ status: "ok" });
      expect(response.headers["cache-control"]).toBe("no-store");
    }
    expect(deps.checkDb).not.toHaveBeenCalled();
    expect(deps.checkReady).not.toHaveBeenCalled();
  });
  it.each([
    [true, true, 200],
    [false, true, 503],
    [true, false, 503],
  ])("combines DB=%s and schema/config=%s", async (db, ready, status) => {
    const deps = createTestDependencies();
    deps.checkDb.mockResolvedValue(db as boolean);
    deps.checkReady.mockResolvedValue(ready as boolean);
    const response = await request(createApp(deps)).get("/api/health/ready");
    expect(response.status).toBe(status);
    expect(response.body).toEqual({
      status: status === 200 ? "ready" : "not-ready",
    });
  });
  it("rejects readiness and new application work while draining", async () => {
    const deps = createTestDependencies();
    const runtime = createRuntime();
    const app = createApp({ ...deps, runtime });
    runtime.beginDrain();
    await Promise.all(
      ["/api/health/ready", "/api/clusters", "/api/auth/session"].map(
        async (path) => {
          const response = await request(app).get(path);
          expect(response.status).toBe(503);
          expect(response.body).toEqual({ status: "not-ready" });
        },
      ),
    );
    expect(deps.checkDb).not.toHaveBeenCalled();
    expect(deps.checkReady).not.toHaveBeenCalled();
    expect(deps.authService.getSession).not.toHaveBeenCalled();
  });
  it("rechecks draining after an in-flight readiness check", async () => {
    const deps = createTestDependencies();
    const runtime = createRuntime();
    deps.checkReady.mockImplementation(async () => {
      runtime.beginDrain();
      return true;
    });
    expect(
      (await request(createApp({ ...deps, runtime })).get("/api/health/ready"))
        .status,
    ).toBe(503);
  });
});

it.each(["checkDb", "checkReady"] as const)(
  "keeps unexpected %s failures private and returns 503",
  async (check) => {
    const deps = createTestDependencies();
    deps[check].mockRejectedValue(new Error("postgres://app:password@db/app"));
    const response = await request(createApp(deps)).get("/api/health/ready");
    expect(response.status).toBe(503);
    expect(response.body).toEqual({ status: "not-ready" });
  },
);
