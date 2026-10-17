import { EventEmitter } from "node:events";
import type { Server } from "node:http";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createShutdown } from "../../../src/lifecycle/shutdown.js";
import { createRuntime } from "../../../src/lifecycle/runtime.js";
import { captureLogs } from "../../helpers/logs.js";

function setup({
  httpHangs = false,
  databaseHangs = false,
  timeoutMs = 100,
} = {}) {
  const server = Object.assign(new EventEmitter(), {
    closeIdleConnections: vi.fn(),
    close: vi.fn((callback: () => void) => {
      if (!httpHangs) callback();
    }),
  });
  const runtime = createRuntime();
  const closeDatabase = vi.fn(() =>
    databaseHangs ? new Promise<void>(() => {}) : Promise.resolve(),
  );
  const exit = vi.fn();
  const signals = new EventEmitter();
  const logs = captureLogs();
  const shutdown = createShutdown({
    server: server as unknown as Server,
    runtime,
    closeDatabase,
    exit,
    signals,
    logger: logs.logger,
    timeoutMs,
  });
  return {
    ...shutdown,
    ...logs,
    runtime,
    closeDatabase,
    exit,
    signals,
    server,
  };
}
afterEach(() => vi.useRealTimers());
describe("shutdown lifecycle", () => {
  it("marks drain synchronously, handles repeated signals once, waits for owned work before closing DB and flushing", async () => {
    const ctx = setup();
    let resolve!: () => void;
    ctx.runtime.track(
      new Promise<void>((done) => {
        resolve = done;
      }),
    );
    const cleanup = vi.fn();
    ctx.runtime.onDrain(cleanup);
    ctx.installSignals();
    ctx.installSignals();
    expect(ctx.signals.listenerCount("SIGTERM")).toBe(1);
    ctx.signals.emit("SIGTERM");
    ctx.signals.emit("SIGINT");
    const done = ctx.shutdown();
    expect(ctx.shutdown()).toBe(done);
    expect(ctx.runtime.draining).toBe(true);
    expect(cleanup).toHaveBeenCalledOnce();
    expect(ctx.closeDatabase).not.toHaveBeenCalled();
    resolve();
    await done;
    expect(ctx.closeDatabase).toHaveBeenCalledOnce();
    expect(ctx.exit).toHaveBeenCalledExactlyOnceWith(0);
    expect(ctx.entries.map((e) => e.event)).toEqual([
      "shutdown_started",
      "shutdown_completed",
    ]);
    expect(ctx.signals.listenerCount("SIGTERM")).toBe(0);
    expect(ctx.signals.listenerCount("SIGINT")).toBe(0);
    expect(ctx.server.listenerCount("connection")).toBe(0);
  });
  it.each([{ httpHangs: true }, { databaseHangs: true }])(
    "enforces an overall deadline with hung resources: %j",
    async (options) => {
      vi.useFakeTimers();
      const ctx = setup(options);
      const socket = Object.assign(new EventEmitter(), { destroy: vi.fn() });
      ctx.server.emit("connection", socket);
      const done = ctx.shutdown();
      await vi.advanceTimersByTimeAsync(100);
      await done;
      expect(ctx.exit).toHaveBeenCalledExactlyOnceWith(1);
      expect(socket.destroy).toHaveBeenCalledOnce();
      expect(ctx.entries.at(-1)).toMatchObject({
        event: "shutdown_forced",
        forced: true,
      });
      expect(vi.getTimerCount()).toBe(0);
      expect(ctx.closeDatabase).toHaveBeenCalledTimes(
        options.httpHangs ? 0 : 1,
      );
    },
  );
  it("does not let a hung logger flush extend the shutdown deadline", async () => {
    vi.useFakeTimers();
    const ctx = setup();
    // Pino's normal stream flush is replaced only to exercise an async sink stall.
    vi.spyOn(ctx.logger, "flush").mockImplementation(() => {});
    const done = ctx.shutdown();
    await vi.advanceTimersByTimeAsync(100);
    await done;
    expect(ctx.exit).toHaveBeenCalledExactlyOnceWith(1);
    expect(vi.getTimerCount()).toBe(0);
  });
  it.each([{ httpHangs: true }, { databaseHangs: true }])(
    "drains and settles at the deadline when the first log throws and a resource hangs: %j",
    async (options) => {
      vi.useFakeTimers();
      const ctx = setup(options);
      const cleanup = vi.fn();
      ctx.runtime.onDrain(cleanup);
      let armedTimers = 0;
      vi.spyOn(ctx.logger, "info").mockImplementation(() => {
        armedTimers = vi.getTimerCount();
        throw new Error("closed stdout");
      });
      ctx.installSignals();
      expect(() => ctx.signals.emit("SIGTERM")).not.toThrow();
      expect(armedTimers).toBe(1);
      const done = ctx.shutdown();
      expect(ctx.runtime.draining).toBe(true);
      expect(cleanup).toHaveBeenCalledOnce();
      expect(ctx.server.close).toHaveBeenCalledOnce();
      expect(ctx.shutdown()).toBe(done);
      await vi.advanceTimersByTimeAsync(100);
      await done;
      expect(ctx.exit).toHaveBeenCalledExactlyOnceWith(1);
      expect(ctx.closeDatabase).toHaveBeenCalledTimes(
        options.httpHangs ? 0 : 1,
      );
      expect(ctx.signals.listenerCount("SIGTERM")).toBe(0);
      expect(vi.getTimerCount()).toBe(0);
    },
  );
  it.each([false, true])(
    "still closes DB and flushes when info/completion logs throw (failed=%s)",
    async (failed) => {
      const ctx = setup();
      vi.spyOn(ctx.logger, "info").mockImplementation(() => {
        throw new Error("closed stdout");
      });
      vi.spyOn(ctx.logger, "error").mockImplementation(() => {
        throw new Error("closed stderr");
      });
      const flush = vi.spyOn(ctx.logger, "flush");
      await ctx.shutdown("SIGTERM", failed);
      expect(ctx.runtime.draining).toBe(true);
      expect(ctx.closeDatabase).toHaveBeenCalledOnce();
      expect(flush).toHaveBeenCalledOnce();
      expect(ctx.exit).toHaveBeenCalledExactlyOnceWith(failed ? 1 : 0);
    },
  );
  it("preserves cleanup failure and attempts flush even when error logging throws", async () => {
    const ctx = setup();
    ctx.runtime.onDrain(() => {
      throw new Error("stream cleanup failed");
    });
    ctx.closeDatabase.mockRejectedValue(new Error("pool close failed"));
    vi.spyOn(ctx.logger, "error").mockImplementation(() => {
      throw new Error("closed stdout");
    });
    const flush = vi.spyOn(ctx.logger, "flush");
    await ctx.shutdown();
    expect(ctx.closeDatabase).toHaveBeenCalledOnce();
    expect(flush).toHaveBeenCalledOnce();
    expect(ctx.exit).toHaveBeenCalledExactlyOnceWith(1);
  });
  it("attempts a final flush and settles even when fatal logging and flush throw", async () => {
    vi.useFakeTimers();
    const ctx = setup({ httpHangs: true });
    vi.spyOn(ctx.logger, "fatal").mockImplementation(() => {
      throw new Error("closed stdout");
    });
    const flush = vi.spyOn(ctx.logger, "flush").mockImplementation(() => {
      throw new Error("flush failed");
    });
    const done = ctx.shutdown();
    await vi.advanceTimersByTimeAsync(100);
    await done;
    expect(flush).toHaveBeenCalledOnce();
    expect(ctx.exit).toHaveBeenCalledExactlyOnceWith(1);
    expect(vi.getTimerCount()).toBe(0);
  });
  it("reports cleanup failure without skipping other stream cleanups", async () => {
    const ctx = setup();
    const cleanup = vi.fn();
    ctx.runtime.onDrain(() => {
      throw new Error("secret");
    });
    ctx.runtime.onDrain(cleanup);
    await ctx.shutdown();
    expect(cleanup).toHaveBeenCalledOnce();
    expect(ctx.exit).toHaveBeenCalledExactlyOnceWith(1);
    expect(JSON.stringify(ctx.entries)).not.toContain("secret");
  });
  it("reports pool close failure and exits unsuccessfully", async () => {
    const ctx = setup();
    ctx.closeDatabase.mockRejectedValue(new Error("postgres://secret"));
    await ctx.shutdown();
    expect(ctx.exit).toHaveBeenCalledExactlyOnceWith(1);
    expect(ctx.entries.at(-1)).toMatchObject({
      event: "shutdown_failed",
      phase: "drain",
    });
  });
});
