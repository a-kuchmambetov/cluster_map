import { EventEmitter } from "node:events";
import type { NextFunction, Request, Response } from "express";
import { afterEach, describe, expect, it, vi } from "vitest";
import { requestLogger } from "./requestLogger";

function makeArgs({
    method = "GET",
    originalUrl = "/api/test",
    statusCode = 200,
    errorCode,
}: {
    method?: string;
    originalUrl?: string;
    statusCode?: number;
    errorCode?: string;
} = {}) {
    const emitter = new EventEmitter();
    const locals: Record<string, unknown> = {};
    if (errorCode !== undefined) locals.errorCode = errorCode;
    const res = Object.assign(emitter, { statusCode, locals }) as unknown as Response;
    const req = { method, originalUrl } as unknown as Request;
    const next = vi.fn() as unknown as NextFunction;
    return { req, res, next, emitter };
}

describe("requestLogger", () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("calls next immediately", () => {
        const { req, res, next } = makeArgs();
        requestLogger(req, res, next);
        expect(next).toHaveBeenCalledOnce();
    });

    it("writes a log line when the response finishes", () => {
        const spy = vi.spyOn(console, "log").mockImplementation(() => {});
        const { req, res, next, emitter } = makeArgs();
        requestLogger(req, res, next);
        emitter.emit("finish");
        expect(spy).toHaveBeenCalledOnce();
    });

    it("log line contains method, path, and status code", () => {
        const spy = vi.spyOn(console, "log").mockImplementation(() => {});
        const { req, res, next, emitter } = makeArgs({ method: "GET", originalUrl: "/api/clusters", statusCode: 200 });
        requestLogger(req, res, next);
        emitter.emit("finish");
        const line = spy.mock.calls[0][0] as string;
        expect(line).toContain("GET");
        expect(line).toContain("/api/clusters");
        expect(line).toContain("200");
    });

    it("appends the error code in brackets when res.locals.errorCode is set", () => {
        const spy = vi.spyOn(console, "log").mockImplementation(() => {});
        const { req, res, next, emitter } = makeArgs({ errorCode: "CLUSTER_NOT_FOUND" });
        requestLogger(req, res, next);
        emitter.emit("finish");
        const line = spy.mock.calls[0][0] as string;
        expect(line).toContain("[CLUSTER_NOT_FOUND]");
    });

    it("does not append a bracket when res.locals.errorCode is not set", () => {
        const spy = vi.spyOn(console, "log").mockImplementation(() => {});
        const { req, res, next, emitter } = makeArgs();
        requestLogger(req, res, next);
        emitter.emit("finish");
        const line = spy.mock.calls[0][0] as string;
        expect(line).not.toContain("[");
    });

    it("strips the query string from the logged path", () => {
        const spy = vi.spyOn(console, "log").mockImplementation(() => {});
        const { req, res, next, emitter } = makeArgs({ originalUrl: "/api/clusters?foo=bar" });
        requestLogger(req, res, next);
        emitter.emit("finish");
        const line = spy.mock.calls[0][0] as string;
        expect(line).toContain("/api/clusters");
        expect(line).not.toContain("foo=bar");
    });
});
