import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { app } from "../../app";
import type { OccupancyRow } from "../../features/clusters/clusters.types";

// Cluster 1, row 1 layout: places 1–8, a gap, then places 9–11.
// Two occupied seats exercise the two peer shapes the contract describes:
//   place 2 — full peer (intraName + displayName both present)
//   place 5 — guest peer (null intraName, displayName only)
// Everything else in the row is free, and the gap is present.
const C1_R1_OCCUPANCY: OccupancyRow[] = [
    { row: 1, place: 2, intraName: "jdoe", displayName: "John Doe", photo: null },
    { row: 1, place: 5, intraName: null, displayName: "Guest User", photo: null },
];

const getClusterOccupancyMock = vi.fn();

vi.mock("../../features/clusters/clusters.repository", () => ({
    getClusterOccupancy: (...args: unknown[]) => getClusterOccupancyMock(...args),
}));

describe("GET /api/clusters", () => {
    it("returns the cluster list", async () => {
        const response = await request(app).get("/api/clusters");

        expect(response.status).toBe(200);
        expect(response.body).toEqual({
            clusters: [
                { id: "c1", number: 1, label: "Cluster 1" },
                { id: "c2", number: 2, label: "Cluster 2" },
                { id: "c3", number: 3, label: "Cluster 3" },
            ],
        });
    });
});

describe("GET /api/clusters/:clusterNumber/layout", () => {
    it("returns cluster info, rows sorted top to bottom (highest number first), cells with no status or peer", async () => {
        const response = await request(app).get("/api/clusters/1/layout");

        expect(response.status).toBe(200);
        expect(response.body.cluster).toEqual({ id: "c1", number: 1, label: "Cluster 1" });

        const { rows } = response.body;
        expect(rows.length).toBeGreaterThan(0);
        // rows are sorted descending by number: first is the topmost physical row
        expect(rows[0].number).toBeGreaterThan(rows[rows.length - 1].number);

        // spot-check row 1 (last in the sorted array for cluster 1)
        const r1 = rows.find((r: { number: number }) => r.number === 1);
        expect(r1).toBeDefined();
        expect(r1.cells).toContainEqual({ kind: "gap" });
        expect(r1.cells).toContainEqual(expect.objectContaining({ kind: "place", id: expect.any(String), number: expect.any(Number) }));
        // cells carry no occupancy data
        for (const cell of r1.cells) {
            expect(cell).not.toHaveProperty("status");
            expect(cell).not.toHaveProperty("peer");
        }
    });

    it("returns 404 CLUSTER_NOT_FOUND for an unknown cluster number", async () => {
        const response = await request(app).get("/api/clusters/999/layout");

        expect(response.status).toBe(404);
        expect(response.body.code).toBe("CLUSTER_NOT_FOUND");
    });

    it("returns 422 for a non-numeric cluster number", async () => {
        const response = await request(app).get("/api/clusters/abc/layout");

        expect(response.status).toBe(422);
        expect(response.body.code).toBe("VALIDATION_ERROR");
    });
});

describe("GET /api/clusters/:clusterNumber/occupancy", () => {
    afterEach(() => {
        getClusterOccupancyMock.mockReset();
    });

    it("returns occupied entries with full and guest peer shapes, and a lastUpdated timestamp", async () => {
        getClusterOccupancyMock.mockResolvedValueOnce(C1_R1_OCCUPANCY);

        const response = await request(app).get("/api/clusters/1/occupancy");

        expect(response.status).toBe(200);
        // full peer: both name fields present
        expect(response.body.occupied).toContainEqual({
            row: 1,
            place: 2,
            peer: { intraName: "jdoe", displayName: "John Doe", photo: null },
        });
        // guest peer: intraName is null
        expect(response.body.occupied).toContainEqual({
            row: 1,
            place: 5,
            peer: { intraName: null, displayName: "Guest User", photo: null },
        });
        expect(typeof response.body.lastUpdated).toBe("string");
    });

    it("returns an empty occupied array when no places are occupied", async () => {
        getClusterOccupancyMock.mockResolvedValueOnce([]);

        const response = await request(app).get("/api/clusters/1/occupancy");

        expect(response.status).toBe(200);
        expect(response.body.occupied).toEqual([]);
    });

    it("returns a record with all-null peer fields when the DB marks a place occupied with no holder", async () => {
        getClusterOccupancyMock.mockResolvedValueOnce([
            { row: 1, place: 3, intraName: null, displayName: null, photo: null },
        ]);

        const response = await request(app).get("/api/clusters/1/occupancy");

        expect(response.status).toBe(200);
        expect(response.body.occupied).toContainEqual({
            row: 1,
            place: 3,
            peer: { intraName: null, displayName: null, photo: null },
        });
    });

    it("returns 404 CLUSTER_NOT_FOUND for an unknown cluster number", async () => {
        const response = await request(app).get("/api/clusters/999/occupancy");

        expect(response.status).toBe(404);
        expect(response.body.code).toBe("CLUSTER_NOT_FOUND");
    });

    it("returns 422 for a non-numeric cluster number", async () => {
        const response = await request(app).get("/api/clusters/abc/occupancy");

        expect(response.status).toBe(422);
        expect(response.body.code).toBe("VALIDATION_ERROR");
    });

    it("returns 500 when the database is unavailable", async () => {
        getClusterOccupancyMock.mockRejectedValueOnce(new Error("connection refused"));

        const response = await request(app).get("/api/clusters/1/occupancy");

        expect(response.status).toBe(500);
    });
});

describe("GET /api/clusters/:clusterNumber/config-validation", () => {
    afterEach(() => {
        getClusterOccupancyMock.mockReset();
    });

    it("returns valid: true when all occupancy records match the config", async () => {
        // row 1, place 1 exists in cluster 1
        getClusterOccupancyMock.mockResolvedValueOnce([
            { row: 1, place: 1, intraName: "jdoe", displayName: "John Doe", photo: null },
        ]);

        const response = await request(app).get("/api/clusters/1/config-validation");

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ clusterNumber: 1, valid: true, errors: [] });
    });

    it("returns valid: false with ORPHANED_OCCUPANCY when a DB record has no matching place in the config", async () => {
        // row 99, place 99 does not exist in any cluster
        getClusterOccupancyMock.mockResolvedValueOnce([
            { row: 99, place: 99, intraName: null, displayName: null, photo: null },
        ]);

        const response = await request(app).get("/api/clusters/1/config-validation");

        expect(response.status).toBe(200);
        expect(response.body.valid).toBe(false);
        expect(response.body.errors).toContainEqual(
            expect.objectContaining({ code: "ORPHANED_OCCUPANCY" }),
        );
    });

    it("returns 404 CLUSTER_NOT_FOUND for an unknown cluster number", async () => {
        const response = await request(app).get("/api/clusters/999/config-validation");

        expect(response.status).toBe(404);
        expect(response.body.code).toBe("CLUSTER_NOT_FOUND");
    });

    it("returns 422 for a non-numeric cluster number", async () => {
        const response = await request(app).get("/api/clusters/abc/config-validation");

        expect(response.status).toBe(422);
        expect(response.body.code).toBe("VALIDATION_ERROR");
    });
});
