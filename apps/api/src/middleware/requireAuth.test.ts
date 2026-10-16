import express from "express";
import request from "supertest";
import { describe, it, expect, vi } from "vitest";
import { AppError } from "@repo/errors";

import { createClustersRouter } from "../features/clusters/clusters.routes";
import { errorMiddleware } from "./error";
const getSession = vi.fn();
const app = express()
  .use("/api/clusters", createClustersRouter({ getSession }))
  .use(errorMiddleware);
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
  it("reaches the stream handler after authenticating", async () => {
    getSession.mockResolvedValue({ user: { id: "approved-user" } });
    const response = await request(app)
      .get("/api/clusters/999/events")
      .timeout({ deadline: 2000 });
    expect(response.status).toBe(404);
    expect(response.body.code).toBe("CLUSTER_NOT_FOUND");
    expect(response.headers["cache-control"]).toBe("no-store");
  });
});
