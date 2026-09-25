import { describe, expect, it } from "vitest";
import { generateName } from "../src/names.js";

describe("generateName", () => {
  it("combines a first name and a surname", () => {
    const name = generateName();
    const parts = name.split(" ");
    expect(parts).toHaveLength(2);
    expect(parts[0]).toBeTruthy();
    expect(parts[1]).toBeTruthy();
  });

  it("produces a variety of combinations", () => {
    const names = new Set(Array.from({ length: 200 }, () => generateName()));
    expect(names.size).toBeGreaterThan(20);
  });
});
