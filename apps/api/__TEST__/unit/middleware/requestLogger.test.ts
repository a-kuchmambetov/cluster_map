import { EventEmitter } from "node:events";
import type { NextFunction, Request, Response } from "express";
import { describe, expect, it, vi } from "vitest";
import { createRequestLogger } from "../../../src/middleware/requestLogger.js";
import { captureLogs } from "../../helpers/logs.js";

function setup(url = "/api/test", id?: string) {
  const logs = captureLogs();
  const req = {
    method: "GET",
    originalUrl: url,
    headers: {
      "x-request-id": id,
      cookie: "secret-cookie",
      authorization: "Bearer secret",
    },
  } as unknown as Request;
  const res = Object.assign(new EventEmitter(), {
    statusCode: 200,
    locals: {} as Record<string, unknown>,
    setHeader: vi.fn(),
    writableFinished: false,
  });
  const next = vi.fn();
  createRequestLogger(logs.logger)(
    req,
    res as unknown as Response,
    next as NextFunction,
  );
  return { ...logs, req, res, next };
}
describe("request logging", () => {
  it("exposes a bounded request id and logs a completed request exactly once", () => {
    const id = "87b99203-f9af-4f8a-96b3-e1e6b41b6f88";
    const { res, entries, next } = setup("/api/test?secret=value", id);
    expect(next).toHaveBeenCalledOnce();
    expect(res.setHeader).toHaveBeenCalledWith("X-Request-ID", id);
    res.writableFinished = true;
    res.emit("finish");
    res.emit("close");
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      event: "request_completed",
      requestId: id,
      path: "/api/test",
      outcome: "finished",
      statusCode: 200,
    });
    expect(JSON.stringify(entries)).not.toMatch(/secret|cookie|authorization/);
  });
  it.each(["bad\nforged", "a".repeat(500), "secret-token", ""])(
    "replaces unsafe or unbounded external request ids",
    (id) => {
      const { res } = setup("/", id);
      expect(res.locals.requestId).toMatch(/^[a-f0-9-]{36}$/);
      expect(res.locals.requestId).not.toBe(id);
    },
  );
  it.each([
    "/api/auth/confirm/secret-token?code=oauth-secret",
    "/api/%61uth/confirm/secret-token",
    "/api/auth%2fconfirm%2fsecret-token",
  ])("redacts confirmation token paths: %s", (url) => {
    const { res, entries } = setup(url);
    res.emit("close");
    expect(entries[0]).toMatchObject({
      path: "/api/auth/confirm/[REDACTED]",
      outcome: "aborted",
    });
    expect(JSON.stringify(entries)).not.toContain("secret");
  });
  it.each([
    "/api/admin/users/private-id/approve?code=private-query",
    "/api/%61dmin/users/private-id/approve",
    "/api/admin/users/private-id",
    "/api/admin/users/private%2fid/approve",
  ])("redacts admin user IDs: %s", (url) => {
    const { res, entries } = setup(url);
    res.emit("close");
    expect(entries[0].path).toMatch(
      /^\/api\/admin\/users\/\[REDACTED\](?:\/approve)?$/,
    );
    expect(JSON.stringify(entries)).not.toContain("private");
  });
  it("logs an aborted SSE response once, with its error code", () => {
    const { res, entries } = setup("/api/clusters/1/events");
    res.locals.errorCode = "INTERNAL_SERVER_ERROR";
    res.emit("close");
    res.emit("finish");
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      outcome: "aborted",
      errorCode: "INTERNAL_SERVER_ERROR",
    });
    expect(res.listenerCount("finish")).toBe(0);
    expect(res.listenerCount("close")).toBe(0);
  });
});
