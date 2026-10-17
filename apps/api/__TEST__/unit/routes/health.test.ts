import { afterEach, describe, expect, it, vi } from "vitest";
import { createDatabaseCheck } from "../../../src/routes/health.js";
import { createRuntime } from "../../../src/lifecycle/runtime.js";
import { captureLogs } from "../../helpers/logs.js";

afterEach(() => vi.useRealTimers());
describe("bounded database probes", () => {
  it("logs only safe driver diagnostics, omitting messages, parameters and credentials", async () => {
    const { logger, entries } = captureLogs();
    const cause = Object.assign(
      new Error("private/password private%2Fpassword OAuth-code"),
      { code: "28P01", parameters: ["token"] },
    );
    const execute = vi
      .fn()
      .mockRejectedValue(new Error("postgres://app:secret@db/app", { cause }));
    expect(await createDatabaseCheck(execute, logger)()).toBe(false);
    expect(entries[0]).toMatchObject({
      event: "database_probe_failed",
      diagnostic: { type: "Error", code: "28P01" },
    });
    expect(JSON.stringify(entries)).not.toMatch(
      /private|password|postgres|OAuth|token|parameters/,
    );
  });
  it("coalesces probes, aborts at two seconds and prevents accumulation when cancellation is ignored", async () => {
    vi.useFakeTimers();
    let resolve!: () => void;
    const execute = vi.fn(
      (_signal: AbortSignal) =>
        new Promise<void>((done) => {
          resolve = done;
        }),
    );
    const check = createDatabaseCheck(execute);
    const first = check();
    expect(check()).toBe(first);
    await vi.advanceTimersByTimeAsync(2000);
    expect(await first).toBe(false);
    expect(execute.mock.calls[0][0].aborted).toBe(true);
    expect(await check()).toBe(false);
    expect(execute).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
    resolve();
    await Promise.resolve();
  });
  it("aborts in-flight probes during drain and does not start another", async () => {
    const runtime = createRuntime();
    const execute = vi.fn(
      (signal: AbortSignal) =>
        new Promise<void>((_, reject) =>
          signal.addEventListener("abort", () =>
            reject(new Error("cancelled")),
          ),
        ),
    );
    const check = createDatabaseCheck(execute, undefined, runtime);
    const result = check();
    await Promise.resolve();
    runtime.beginDrain();
    expect(await result).toBe(false);
    await runtime.whenIdle();
    expect(await check()).toBe(false);
    expect(execute).toHaveBeenCalledOnce();
  });
  it("clears its timeout after a successful probe", async () => {
    vi.useFakeTimers();
    expect(await createDatabaseCheck(async () => {})()).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });
});
