import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../../src/app.js";
import { createDatabaseCheck } from "../../src/routes/health.js";
import { createTestDependencies } from "../helpers/fakes.js";

const executeMock = vi.fn();

const deps = createTestDependencies();
const app = createApp({ ...deps, checkDb: createDatabaseCheck(executeMock) });

describe("GET /api/health", () => {
  afterEach(() => {
    executeMock.mockReset();
  });

  it("returns 200 with db ok when the database is reachable", async () => {
    executeMock.mockResolvedValueOnce(undefined);

    const response = await request(app).get("/api/health");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "ok", db: "ok" });
  });

  it("returns 503 with db unreachable when the database is not reachable", async () => {
    executeMock.mockRejectedValueOnce(new Error("connection refused"));

    const response = await request(app).get("/api/health");

    expect(response.status).toBe(503);
    expect(response.body).toEqual({
      status: "degraded",
      db: "unreachable",
    });
  });
});

describe("GET /api/health/ready", () => {
  it.each([true, false])(
    "reflects the injected readiness result: %s",
    async (ready) => {
      deps.checkReady.mockResolvedValue(ready);
      const response = await request(app).get("/api/health/ready");
      expect(response.status).toBe(ready ? 200 : 503);
      expect(response.body).toEqual({ status: ready ? "ready" : "not-ready" });
    },
  );
});
