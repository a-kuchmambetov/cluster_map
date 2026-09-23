import { afterEach, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

it("normalizes a trailing slash in the build-time API origin", async () => {
  vi.stubEnv("VITE_API_URL", "https://api.example.com/");
  expect((await import("./api")).API_URL).toBe("https://api.example.com/api");
});

it("uses the build-time API origin", async () => {
  vi.stubEnv("VITE_API_URL", "http://localhost:5001");
  expect((await import("./api")).API_URL).toBe("http://localhost:5001/api");
});

it("uses same-origin API requests when no origin is configured", async () => {
  vi.stubEnv("VITE_API_URL", "");
  expect((await import("./api")).API_URL).toBe("/api");
});
