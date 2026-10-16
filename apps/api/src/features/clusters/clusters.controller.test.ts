import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createClustersRouter } from "./clusters.routes.js";
import { clusterNumberParamSchema } from "./clusters.schema.js";
import { errorMiddleware } from "../../middleware/error.js";
import { createTestDependencies } from "../../test/fakes.js";

const listClusterConfigsMock = vi.fn();
const getClusterLayoutMock = vi.fn();
const getClusterOccupancyDataMock = vi.fn();
const getClusterConfigValidationMock = vi.fn();

vi.mock("./clusters.service.js", () => ({
  listClusterConfigs: (...args: unknown[]) => listClusterConfigsMock(...args),
  getClusterLayout: (...args: unknown[]) => getClusterLayoutMock(...args),
  getClusterOccupancyData: (...args: unknown[]) =>
    getClusterOccupancyDataMock(...args),
  getClusterConfigValidation: (...args: unknown[]) =>
    getClusterConfigValidationMock(...args),
}));

const { authService } = createTestDependencies();
const app = express()
  .use("/api/clusters", createClustersRouter(authService))
  .use(errorMiddleware);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("listClusters", () => {
  it("maps the service result to { clusters } and sends it", async () => {
    listClusterConfigsMock.mockReturnValueOnce([
      { id: "c1", number: 1, label: "Cluster 1", rows: [] },
      { id: "c2", number: 2, label: "Cluster 2", rows: [] },
    ]);

    const response = await request(app).get("/api/clusters");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      clusters: [
        { id: "c1", number: 1, label: "Cluster 1" },
        { id: "c2", number: 2, label: "Cluster 2" },
      ],
    });
  });

  it("forwards thrown errors to the error middleware", async () => {
    listClusterConfigsMock.mockImplementationOnce(() => {
      throw new Error("config unreadable");
    });

    const response = await request(app).get("/api/clusters");

    expect(response.status).toBe(500);
    expect(response.body).toMatchObject({
      code: "INTERNAL_SERVER_ERROR",
      error: "config unreadable",
    });
  });
});

describe("getClusterLayoutHandler", () => {
  it("parses the clusterNumber once, passes a number to the service and sends the result", async () => {
    const parse = vi.spyOn(clusterNumberParamSchema, "parse");
    const layout = {
      cluster: { id: "c1", number: 1, label: "Cluster 1" },
      rows: [],
    };
    getClusterLayoutMock.mockReturnValueOnce(layout);

    const response = await request(app).get("/api/clusters/1/layout");

    expect(response.status).toBe(200);
    expect(parse).toHaveBeenCalledOnce();
    expect(getClusterLayoutMock).toHaveBeenCalledWith(1);
    expect(response.body).toEqual(layout);
    parse.mockRestore();
  });

  it("forwards thrown errors to the error middleware", async () => {
    getClusterLayoutMock.mockImplementationOnce(() => {
      throw new Error("cluster not found");
    });

    const response = await request(app).get("/api/clusters/1/layout");

    expect(response.status).toBe(500);
    expect(response.body.error).toBe("cluster not found");
  });
});

describe("getClusterOccupancyHandler", () => {
  it("passes the parsed clusterNumber to the service and sends the result", async () => {
    const occupancy = {
      occupied: [],
      lastUpdated: "2026-01-01T00:00:00.000Z",
    };
    getClusterOccupancyDataMock.mockResolvedValueOnce(occupancy);

    const response = await request(app).get("/api/clusters/2/occupancy");

    expect(response.status).toBe(200);
    expect(getClusterOccupancyDataMock).toHaveBeenCalledWith(2);
    expect(response.body).toEqual(occupancy);
  });

  it("forwards rejected promises to the error middleware", async () => {
    getClusterOccupancyDataMock.mockRejectedValueOnce(new Error("db error"));

    const response = await request(app).get("/api/clusters/1/occupancy");

    expect(response.status).toBe(500);
    expect(response.body.error).toBe("db error");
  });
});

describe("getClusterConfigValidationHandler", () => {
  it("passes the parsed clusterNumber to the service and sends the result", async () => {
    const result = { clusterNumber: 1, valid: true, errors: [] };
    getClusterConfigValidationMock.mockResolvedValueOnce(result);

    const response = await request(app).get(
      "/api/clusters/1/config-validation",
    );

    expect(response.status).toBe(200);
    expect(getClusterConfigValidationMock).toHaveBeenCalledWith(1);
    expect(response.body).toEqual(result);
  });

  it("forwards rejected promises to the error middleware", async () => {
    getClusterConfigValidationMock.mockRejectedValueOnce(new Error("db error"));

    const response = await request(app).get(
      "/api/clusters/1/config-validation",
    );

    expect(response.status).toBe(500);
    expect(response.body.error).toBe("db error");
  });
});

it.each(["layout", "occupancy", "config-validation", "events"])(
  "rejects an invalid cluster number before the %s service runs",
  async (endpoint) => {
    const response = await request(app).get(`/api/clusters/abc/${endpoint}`);

    expect(response.status).toBe(422);
    expect(response.body).toMatchObject({
      ok: false,
      status: "fail",
      code: "VALIDATION_ERROR",
      details: [{ path: "clusterNumber", code: "invalid_type" }],
    });
    expect(getClusterLayoutMock).not.toHaveBeenCalled();
    expect(getClusterOccupancyDataMock).not.toHaveBeenCalled();
    expect(getClusterConfigValidationMock).not.toHaveBeenCalled();
  },
);
