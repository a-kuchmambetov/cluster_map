import request from "supertest";
import { describe, expect, it } from "vitest";
import { app } from "../../app";

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
