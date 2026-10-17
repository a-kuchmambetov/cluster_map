import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createReadinessCheck } from "../../../src/routes/readiness.js";

const env = {
  WEB_ORIGIN: "https://map.example",
  BETTER_AUTH_URL: "https://map.example",
  NODE_ENV: "production",
};
const checkSchema = vi.fn<() => Promise<void>>();
const isApplicationReady = createReadinessCheck(env, checkSchema);

describe("application readiness", () => {
  beforeEach(() => {
    checkSchema.mockReset();
  });
  afterEach(() => vi.useRealTimers());
  it("accepts a usable schema", async () => {
    checkSchema.mockResolvedValue(undefined);
    expect(await isApplicationReady()).toBe(true);
  });
  it("rejects a missing schema column", async () => {
    checkSchema.mockRejectedValue(new Error("column does not exist"));
    expect(await isApplicationReady()).toBe(false);
  });
  it.each([
    { WEB_ORIGIN: "https://map.example/" },
    { WEB_ORIGIN: "http://map.example" },
    { BETTER_AUTH_URL: "http://map.example" },
  ])("rejects invalid origin settings: %j", async (settings) => {
    expect(
      await createReadinessCheck({ ...env, ...settings }, checkSchema)(),
    ).toBe(false);
    expect(checkSchema).not.toHaveBeenCalled();
  });
  it("times out a stalled schema check and clears the timer", async () => {
    vi.useFakeTimers();
    checkSchema.mockImplementation(() => new Promise(() => {}));
    const result = isApplicationReady();
    await vi.advanceTimersByTimeAsync(3000);
    expect(await result).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });
});
