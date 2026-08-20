import request from "supertest";
import { describe, expect, it } from "vitest";
import { app } from "../../app";
import { validateClusterConfig } from "./clusters.service";
import type { ClusterConfig } from "./clusters.types";

describe("GET /api/clusters", () => {
    it("returns the fixture cluster list", async () => {
        const response = await request(app).get("/api/clusters");

        expect(response.status).toBe(200);
        expect(response.body).toEqual({
            clusters: [
                { id: "c1", number: 1, label: "Cluster 1" },
                { id: "c2", number: 2, label: "Cluster 2" },
            ],
        });
    });
});

describe("GET /api/clusters/:clusterNumber/map", () => {
    it("returns an occupied cell, a free cell, and a gap cell for cluster 1", async () => {
        const response = await request(app).get("/api/clusters/1/map");

        expect(response.status).toBe(200);

        const cells = response.body.rows[0].cells;
        expect(cells).toContainEqual(
            expect.objectContaining({ kind: "place", status: "occupied", peer: expect.any(Object) }),
        );
        expect(cells).toContainEqual(expect.objectContaining({ kind: "place", status: "free", peer: null }));
        expect(cells).toContainEqual({ kind: "gap" });
    });

    it("returns 404 CLUSTER_NOT_FOUND for an unknown cluster number", async () => {
        const response = await request(app).get("/api/clusters/999/map");

        expect(response.status).toBe(404);
        expect(response.body.code).toBe("CLUSTER_NOT_FOUND");
    });

    it("returns 422 for a non-numeric cluster number", async () => {
        const response = await request(app).get("/api/clusters/abc/map");

        expect(response.status).toBe(422);
        expect(response.body.code).toBe("VALIDATION_ERROR");
    });
});

describe("GET /api/clusters/:clusterNumber/config-validation", () => {
    it("returns valid: true with no errors for the clean fixture config", async () => {
        const response = await request(app).get("/api/clusters/1/config-validation");

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ clusterNumber: 1, valid: true, errors: [] });
    });
});

describe("validateClusterConfig", () => {
    it("reports duplicate row ids/numbers and duplicate place ids/numbers", () => {
        const brokenConfig: ClusterConfig = {
            id: "c1",
            number: 1,
            label: "Cluster 1",
            key: "c1",
            rows: [
                {
                    id: "c1r1",
                    number: 1,
                    label: "Row 1",
                    cells: [
                        { kind: "place", id: "c1r1p1", number: 1 },
                        { kind: "place", id: "c1r1p1", number: 1 },
                    ],
                },
                {
                    id: "c1r1",
                    number: 1,
                    label: "Row 1 (duplicate)",
                    cells: [{ kind: "place", id: "c1r2p1", number: 1 }],
                },
            ],
        };

        const errors = validateClusterConfig(brokenConfig, 0);

        expect(errors).toContainEqual({
            code: "DUPLICATE_ROW_ID",
            message: "Row id c1r1 is not unique",
            path: "clusters[0].rows[1].id",
        });
        expect(errors).toContainEqual({
            code: "DUPLICATE_ROW_NUMBER",
            message: "Row number 1 is not unique",
            path: "clusters[0].rows[1].number",
        });
        expect(errors).toContainEqual({
            code: "DUPLICATE_PLACE_ID",
            message: "Place id c1r1p1 is not unique",
            path: "clusters[0].rows[0].cells[1].id",
        });
        expect(errors).toContainEqual({
            code: "DUPLICATE_PLACE_NUMBER",
            message: "Place number 1 is not unique within row 1",
            path: "clusters[0].rows[0].cells[1].number",
        });
    });

    it("returns no errors for a clean config", () => {
        const cleanConfig: ClusterConfig = {
            id: "c1",
            number: 1,
            label: "Cluster 1",
            key: "c1",
            rows: [
                {
                    id: "c1r1",
                    number: 1,
                    label: "Row 1",
                    cells: [
                        { kind: "place", id: "c1r1p1", number: 1 },
                        { kind: "gap" },
                        { kind: "place", id: "c1r1p2", number: 2 },
                    ],
                },
            ],
        };

        expect(validateClusterConfig(cleanConfig, 0)).toEqual([]);
    });
});
