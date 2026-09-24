import type { Request, Response } from "express";
import { afterEach, describe, expect, it, vi } from "vitest";
import { healthHandler, isDatabaseReachable } from "./health";

const execute = vi.hoisted(() => vi.fn());
vi.mock("@repo/db", () => ({ db: { execute } }));

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.useRealTimers();
  execute.mockReset();
});

describe("database health diagnostics", () => {
  it("logs the driver cause without exposing credentials", async () => {
    vi.stubEnv("PG_PASSWORD", "private/password");
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const cause = Object.assign(
      new Error("Authentication failed: private/password"),
      {
        code: "28P01",
      },
    );
    execute.mockRejectedValue(
      new Error("Failed query at postgres://app:private%2Fpassword@db/app", {
        cause,
      }),
    );

    expect(await isDatabaseReachable()).toBe(false);
    const output = log.mock.calls[0][0] as string;
    expect(output).not.toContain("private/password");
    expect(output).not.toContain("private%2Fpassword");
    expect(JSON.parse(output)).toMatchObject({
      event: "database_health_check_failed",
      phase: "query",
      errors: [{ name: "Error" }, { code: "28P01" }],
    });
  });

  it("logs when the query exceeds the health check timeout", async () => {
    vi.useFakeTimers();
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    execute.mockImplementation(() => new Promise(() => {}));
    const result = isDatabaseReachable();
    await vi.advanceTimersByTimeAsync(2000);

    expect(await result).toBe(false);
    expect(JSON.parse(log.mock.calls[0][0] as string)).toMatchObject({
      phase: "query",
      elapsedMs: 2000,
      timeoutMs: 2000,
      errors: [{ message: "Database ping timed out" }],
    });
  });
});

function makeRes() {
  const json = vi.fn();
  const status = vi.fn().mockReturnValue({ json });
  return { res: { json, status } as unknown as Response, json, status };
}

describe("healthHandler", () => {
  it("responds 200 with db ok when the database is reachable", async () => {
    const { res, json, status } = makeRes();
    await healthHandler(() => Promise.resolve(true))({} as Request, res);

    expect(status).not.toHaveBeenCalled();
    expect(json).toHaveBeenCalledWith({ status: "ok", db: "ok" });
  });

  it("responds 503 with db unreachable when the database is not reachable", async () => {
    const { res, json, status } = makeRes();
    await healthHandler(() => Promise.resolve(false))({} as Request, res);

    expect(status).toHaveBeenCalledWith(503);
    expect(json).toHaveBeenCalledWith({
      status: "degraded",
      db: "unreachable",
    });
  });
});
