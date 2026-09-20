import express from "express";
import request from "supertest";
import { describe, it, expect, vi } from "vitest";
import { AppError } from "@repo/errors";
import { getSession } from "../features/auth/auth.service";
import { clustersRouter } from "../features/clusters/clusters.routes";
import { errorMiddleware } from "./error";
vi.mock("../features/auth/auth.service", () => ({ getSession: vi.fn() }));
const app = express().use("/api/clusters", clustersRouter).use(errorMiddleware);
describe("cluster access enforcement", () => {
  it.each([
    "",
    "/1/layout",
    "/1/occupancy",
    "/1/config-validation",
    "/1/events",
  ])("rejects anonymous access to %s", async (path) => {
    vi.mocked(getSession).mockRejectedValue(
      AppError.unauthorized("Authentication required"),
    );
    expect((await request(app).get(`/api/clusters${path}`)).status).toBe(401);
  });
  it("rejects accounts whose approval was revoked", async () => {
    vi.mocked(getSession).mockRejectedValue(
      AppError.forbidden("Access denied"),
    );
    expect((await request(app).get("/api/clusters")).status).toBe(403);
  });
});
