import { EventEmitter } from "node:events";
import type { Request, Response, NextFunction } from "express";
import { afterEach, describe, it, expect, vi } from "vitest";
import { getClusterEventsHandler } from "./clusters.controller";
import { getSession } from "../auth/auth.service";
const mocks = vi.hoisted(() => ({
  unsubscribe: vi.fn(),
  emit: undefined as undefined | ((event: string, data: string) => void),
}));
vi.mock("../auth/auth.service", () => ({ getSession: vi.fn() }));
vi.mock("./clusters.service", () => ({
  loadClusterConfig: () => ({ id: "c1" }),
}));
vi.mock("./clusters.pool", () => ({
  subscribe: (_id: string, emit: typeof mocks.emit) => {
    mocks.emit = emit;
    return mocks.unsubscribe;
  },
}));
afterEach(() => {
  vi.useRealTimers();
  vi.resetAllMocks();
});
describe("stream session revalidation", () => {
  it("closes the connection, unsubscribes and stops events when access expires", async () => {
    vi.useFakeTimers();
    const res = Object.assign(new EventEmitter(), {
      setHeader: vi.fn(),
      flushHeaders: vi.fn(),
      write: vi.fn(),
      end: vi.fn(),
    });
    vi.mocked(getSession).mockRejectedValue(new Error("Expired"));
    getClusterEventsHandler(
      { params: { clusterNumber: "1" }, headers: {} } as unknown as Request,
      res as unknown as Response,
      vi.fn() as NextFunction,
    );
    await vi.advanceTimersByTimeAsync(20_000);
    expect(res.end).toHaveBeenCalledOnce();
    expect(mocks.unsubscribe).toHaveBeenCalledOnce();
    mocks.emit?.("occupancy-delta", "{}");
    expect(res.write).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("writes a keep-alive comment and keeps the connection open when the session is still valid", async () => {
    vi.useFakeTimers();
    const res = Object.assign(new EventEmitter(), {
      setHeader: vi.fn(),
      flushHeaders: vi.fn(),
      write: vi.fn(),
      end: vi.fn(),
    });
    vi.mocked(getSession).mockResolvedValue({
      user: {
        id: "1",
        name: "Test",
        email: "test@example.com",
        emailVerified: false,
        image: null,
        twoFactorEnabled: false,
        role: "user",
      },
    });
    getClusterEventsHandler(
      { params: { clusterNumber: "1" }, headers: {} } as unknown as Request,
      res as unknown as Response,
      vi.fn() as NextFunction,
    );
    await vi.advanceTimersByTimeAsync(20_000);
    expect(res.write).toHaveBeenCalledWith(": keep-alive\n\n");
    expect(res.end).not.toHaveBeenCalled();
    expect(mocks.unsubscribe).not.toHaveBeenCalled();
  });
});
