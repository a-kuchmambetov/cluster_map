import type { NextFunction, Request, Response } from "express";
import { describe, expect, it, vi } from "vitest";
import {
    getClusterConfigValidationHandler,
    getClusterLayoutHandler,
    getClusterOccupancyHandler,
    listClusters,
} from "./clusters.controller";

const listClusterConfigsMock = vi.fn();
const getClusterLayoutMock = vi.fn();
const getClusterOccupancyDataMock = vi.fn();
const getClusterConfigValidationMock = vi.fn();

vi.mock("./clusters.service", () => ({
    listClusterConfigs: (...args: unknown[]) => listClusterConfigsMock(...args),
    getClusterLayout: (...args: unknown[]) => getClusterLayoutMock(...args),
    getClusterOccupancyData: (...args: unknown[]) => getClusterOccupancyDataMock(...args),
    getClusterConfigValidation: (...args: unknown[]) => getClusterConfigValidationMock(...args),
}));

function makeHandlerArgs(params: Record<string, unknown> = {}) {
    const json = vi.fn();
    const req = { params } as unknown as Request;
    const res = { json } as unknown as Response;
    const next = vi.fn() as unknown as NextFunction;
    return { req, res, next, json };
}

describe("listClusters", () => {
    it("maps the service result to { clusters } and sends it", async () => {
        const serviceResult = [
            { id: "c1", number: 1, label: "Cluster 1", rows: [] },
            { id: "c2", number: 2, label: "Cluster 2", rows: [] },
        ];
        listClusterConfigsMock.mockReturnValueOnce(serviceResult);

        const { req, res, next, json } = makeHandlerArgs();
        await listClusters(req, res, next);

        expect(json).toHaveBeenCalledWith({
            clusters: [
                { id: "c1", number: 1, label: "Cluster 1" },
                { id: "c2", number: 2, label: "Cluster 2" },
            ],
        });
        expect(next).not.toHaveBeenCalled();
    });

    it("forwards thrown errors to next", async () => {
        const err = new Error("config unreadable");
        listClusterConfigsMock.mockImplementationOnce(() => {
            throw err;
        });

        const { req, res, next } = makeHandlerArgs();
        await listClusters(req, res, next);

        expect(next).toHaveBeenCalledWith(err);
    });
});

describe("getClusterLayoutHandler", () => {
    it("passes the parsed clusterNumber to the service and sends the result", async () => {
        const layout = { cluster: { id: "c1", number: 1, label: "Cluster 1" }, rows: [] };
        getClusterLayoutMock.mockReturnValueOnce(layout);

        const { req, res, next, json } = makeHandlerArgs({ clusterNumber: "1" });
        await getClusterLayoutHandler(req, res, next);

        expect(getClusterLayoutMock).toHaveBeenCalledWith(1);
        expect(json).toHaveBeenCalledWith(layout);
        expect(next).not.toHaveBeenCalled();
    });

    it("forwards thrown errors to next", async () => {
        const err = new Error("cluster not found");
        getClusterLayoutMock.mockImplementationOnce(() => {
            throw err;
        });

        const { req, res, next } = makeHandlerArgs({ clusterNumber: "1" });
        await getClusterLayoutHandler(req, res, next);

        expect(next).toHaveBeenCalledWith(err);
    });
});

describe("getClusterOccupancyHandler", () => {
    it("passes the parsed clusterNumber to the service and sends the result", async () => {
        const occupancy = { occupied: [], lastUpdated: "2026-01-01T00:00:00.000Z" };
        getClusterOccupancyDataMock.mockResolvedValueOnce(occupancy);

        const { req, res, next, json } = makeHandlerArgs({ clusterNumber: "2" });
        await getClusterOccupancyHandler(req, res, next);

        expect(getClusterOccupancyDataMock).toHaveBeenCalledWith(2);
        expect(json).toHaveBeenCalledWith(occupancy);
        expect(next).not.toHaveBeenCalled();
    });

    it("forwards thrown errors to next", async () => {
        const err = new Error("db error");
        getClusterOccupancyDataMock.mockRejectedValueOnce(err);

        const { req, res, next } = makeHandlerArgs({ clusterNumber: "1" });
        await getClusterOccupancyHandler(req, res, next);

        expect(next).toHaveBeenCalledWith(err);
    });
});

describe("getClusterConfigValidationHandler", () => {
    it("passes the parsed clusterNumber to the service and sends the result", async () => {
        const result = { clusterNumber: 1, valid: true, errors: [] };
        getClusterConfigValidationMock.mockResolvedValueOnce(result);

        const { req, res, next, json } = makeHandlerArgs({ clusterNumber: "1" });
        await getClusterConfigValidationHandler(req, res, next);

        expect(getClusterConfigValidationMock).toHaveBeenCalledWith(1);
        expect(json).toHaveBeenCalledWith(result);
        expect(next).not.toHaveBeenCalled();
    });

    it("forwards thrown errors to next", async () => {
        const err = new Error("db error");
        getClusterConfigValidationMock.mockRejectedValueOnce(err);

        const { req, res, next } = makeHandlerArgs({ clusterNumber: "1" });
        await getClusterConfigValidationHandler(req, res, next);

        expect(next).toHaveBeenCalledWith(err);
    });
});
