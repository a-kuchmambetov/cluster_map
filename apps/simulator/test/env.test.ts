import { describe, expect, it } from "vitest";
import { envSchema } from "../src/env.js";

describe("envSchema", () => {
  it("defaults simulator to disabled", () => {
    const result = envSchema.safeParse({});
    expect(result.success).toBe(true);
    expect(result.data!.SIMULATOR_ENABLED).toBe(false);
  });

  it("parses enabled flag as a boolean", () => {
    const result = envSchema.safeParse({ SIMULATOR_ENABLED: "true" });
    expect(result.success).toBe(true);
    expect(result.data!.SIMULATOR_ENABLED).toBe(true);
  });

  it("rejects probability sums greater than 1", () => {
    const result = envSchema.safeParse({
      SIMULATOR_CLAIM_PROBABILITY: "0.8",
      SIMULATOR_RELEASE_PROBABILITY: "0.3",
    });
    expect(result.success).toBe(false);
  });

  it("accepts valid probability combinations", () => {
    const result = envSchema.safeParse({
      SIMULATOR_CLAIM_PROBABILITY: "0.6",
      SIMULATOR_RELEASE_PROBABILITY: "0.3",
    });
    expect(result.success).toBe(true);
  });
});
