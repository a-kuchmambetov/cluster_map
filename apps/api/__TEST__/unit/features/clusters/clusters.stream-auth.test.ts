import { createRuntime } from "../../../../src/lifecycle/runtime.js";
import { EventEmitter } from "node:events";
import type { Request, Response, NextFunction } from "express";
import { afterEach, describe, it, expect, vi } from "vitest";
import { createClusterEventsHandler } from "../../../../src/features/clusters/clusters.controller.js";
const getSession = vi.fn();
const getClusterEventsHandler = createClusterEventsHandler({ getSession });
const mocks = vi.hoisted(() => ({
  unsubscribe: vi.fn(),
  emit: undefined as undefined | ((event: string, data: string) => void),
  onSubscribe: undefined as
    | undefined
    | ((emit: (event: string, data: string) => void) => void),
}));
vi.mock("../../../../src/features/clusters/clusters.service.js", () => ({
  loadClusterConfig: () => ({ id: "c1" }),
}));
vi.mock("../../../../src/features/clusters/clusters.pool.js", () => ({
  subscribe: (_id: string, emit: typeof mocks.emit) => {
    mocks.emit = emit;
    if (emit) mocks.onSubscribe?.(emit);
    return mocks.unsubscribe;
  },
}));
afterEach(() => {
  vi.useRealTimers();
  vi.resetAllMocks();
  mocks.onSubscribe = undefined;
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

describe("stream subscription", () => {
  it("writes a snapshot emitted synchronously while subscribing", () => {
    const res = Object.assign(new EventEmitter(), {
      setHeader: vi.fn(),
      flushHeaders: vi.fn(),
      write: vi.fn(),
      end: vi.fn(),
    });
    const snapshot = JSON.stringify({ occupied: [], lastUpdated: null });
    mocks.onSubscribe = (emit) => emit("occupancy-snapshot", snapshot);
    getClusterEventsHandler(
      { params: { clusterNumber: "1" }, headers: {} } as unknown as Request,
      res as unknown as Response,
      vi.fn() as NextFunction,
    );
    expect(res.flushHeaders).toHaveBeenCalledBefore(res.write);
    expect(res.write).toHaveBeenCalledWith(
      `event: occupancy-snapshot\ndata: ${snapshot}\n\n`,
    );
    res.emit("close");
    expect(mocks.unsubscribe).toHaveBeenCalledOnce();
  });
});

it("drains streams and pending session work without late keepalive writes", async () => {
  vi.useFakeTimers();
  const runtime = createRuntime();
  let resolve!: () => void;
  getSession.mockImplementation(
    () =>
      new Promise<void>((done) => {
        resolve = done;
      }),
  );
  const res = Object.assign(new EventEmitter(), {
    setHeader: vi.fn(),
    flushHeaders: vi.fn(),
    write: vi.fn(),
    end: vi.fn(),
  });
  createClusterEventsHandler({ getSession }, runtime)(
    { params: { clusterNumber: "1" }, headers: {} } as unknown as Request,
    res as unknown as Response,
    vi.fn() as NextFunction,
  );
  await vi.advanceTimersByTimeAsync(20_000);
  runtime.beginDrain();
  expect(res.end).toHaveBeenCalledOnce();
  expect(mocks.unsubscribe).toHaveBeenCalledOnce();
  expect(res.listenerCount("close")).toBe(0);
  expect(vi.getTimerCount()).toBe(0);
  const idle = vi.fn();
  void runtime.whenIdle().then(idle);
  await Promise.resolve();
  expect(idle).not.toHaveBeenCalled();
  resolve();
  await runtime.whenIdle();
  await vi.advanceTimersByTimeAsync(60_000);
  mocks.emit?.("occupancy-delta", "{}");
  expect(res.write).not.toHaveBeenCalled();
  expect(res.end).toHaveBeenCalledOnce();
  expect(vi.getTimerCount()).toBe(0);
});
