import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  auth: {
    BETTER_AUTH_URL: "https://map.example",
    BETTER_AUTH_SECRET: "x".repeat(32),
  },
  limit: vi.fn(),
}));
vi.mock("../config/env", () => ({
  env: { WEB_ORIGIN: "https://map.example" },
  getAuthEnv: () => mocks.auth,
}));
vi.mock("../config/auth.js", () => ({ auth: {} }));
vi.mock("@repo/db", () => ({
  db: { select: () => ({ from: () => ({ limit: mocks.limit }) }) },
  user: {},
  session: {},
  account: {},
  verification: {},
  cluster: {},
  row: {},
  position: {},
  userHiveInfo: {},
}));
import { isApplicationReady } from "./readiness";
describe("application readiness", () => {
  beforeEach(() => {
    mocks.limit.mockReset();
  });
  it("accepts a usable schema", async () => {
    mocks.limit.mockResolvedValue([]);
    expect(await isApplicationReady()).toBe(true);
  });
  it("rejects a missing schema column", async () => {
    mocks.limit.mockRejectedValue(new Error("column does not exist"));
    expect(await isApplicationReady()).toBe(false);
  });
});
