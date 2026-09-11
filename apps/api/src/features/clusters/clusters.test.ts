import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { app } from "../../app";
import { clustersConfigFileSchema } from "./clusters.schema";
import { listClusterConfigs, resolveRowPositions } from "./clusters.service";
import type { CellConfig, ClusterConfig, OccupancyRow, ResolvedPlaceCellConfig } from "./clusters.types";

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

vi.mock("./clusters.repository", () => ({
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

describe("clustersConfigFileSchema — uniqueness validation", () => {
    function minimal(overrides: object) {
        return clustersConfigFileSchema.safeParse({
            clusters: [
                {
                    id: "c1",
                    number: 1,
                    label: "Cluster 1",
                    rows: [
                        {
                            id: "c1r1",
                            number: 1,
                            label: "Row 1",
                            cells: [
                                { kind: "place", id: "c1r1p1", number: 1 },
                                { kind: "place", id: "c1r1p2", number: 2 },
                            ],
                        },
                    ],
                    ...overrides,
                },
            ],
        });
    }

    it("accepts a structurally valid config", () => {
        expect(minimal({}).success).toBe(true);
    });

    it("rejects duplicate place ids within a row and names the id", () => {
        const result = minimal({
            rows: [
                {
                    id: "c1r1",
                    number: 1,
                    label: "Row 1",
                    cells: [
                        { kind: "place", id: "c1r1p1", number: 1 },
                        { kind: "place", id: "c1r1p1", number: 2 }, // duplicate id
                    ],
                },
            ],
        });

        expect(result.success).toBe(false);
        if (!result.success) {
            const messages = result.error.issues.map((i) => i.message);
            expect(messages.some((m) => m.includes("c1r1p1"))).toBe(true);
        }
    });

    it("rejects duplicate place numbers within a row and names the row", () => {
        const result = minimal({
            rows: [
                {
                    id: "c1r1",
                    number: 1,
                    label: "Row 1",
                    cells: [
                        { kind: "place", id: "c1r1p1", number: 1 },
                        { kind: "place", id: "c1r1p2", number: 1 }, // duplicate number
                    ],
                },
            ],
        });

        expect(result.success).toBe(false);
        if (!result.success) {
            const messages = result.error.issues.map((i) => i.message);
            expect(messages.some((m) => m.includes("c1r1"))).toBe(true);
        }
    });

    it("rejects duplicate row ids within a cluster and names the id", () => {
        const result = minimal({
            rows: [
                { id: "c1r1", number: 1, label: "Row 1", cells: [] },
                { id: "c1r1", number: 2, label: "Row 2", cells: [] }, // duplicate id
            ],
        });

        expect(result.success).toBe(false);
        if (!result.success) {
            const messages = result.error.issues.map((i) => i.message);
            expect(messages.some((m) => m.includes("c1r1"))).toBe(true);
        }
    });

    it("rejects duplicate row numbers within a cluster and names the cluster", () => {
        const result = minimal({
            rows: [
                { id: "c1r1", number: 1, label: "Row 1", cells: [] },
                { id: "c1r2", number: 1, label: "Row 2", cells: [] }, // duplicate number
            ],
        });

        expect(result.success).toBe(false);
        if (!result.success) {
            const messages = result.error.issues.map((i) => i.message);
            expect(messages.some((m) => m.includes("c1"))).toBe(true);
        }
    });

    it("rejects duplicate cluster ids across the file and names the id", () => {
        const result = clustersConfigFileSchema.safeParse({
            clusters: [
                { id: "c1", number: 1, label: "Cluster 1", rows: [] },
                { id: "c1", number: 2, label: "Cluster 2", rows: [] }, // duplicate id
            ],
        });

        expect(result.success).toBe(false);
        if (!result.success) {
            const messages = result.error.issues.map((i) => i.message);
            expect(messages.some((m) => m.includes("c1"))).toBe(true);
        }
    });

    it("rejects duplicate cluster numbers across the file and names the number", () => {
        const result = clustersConfigFileSchema.safeParse({
            clusters: [
                { id: "c1", number: 1, label: "Cluster 1", rows: [] },
                { id: "c2", number: 1, label: "Cluster 2", rows: [] }, // duplicate number
            ],
        });

        expect(result.success).toBe(false);
        if (!result.success) {
            const messages = result.error.issues.map((i) => i.message);
            expect(messages.some((m) => m.includes("1"))).toBe(true);
        }
    });
});

describe("resolveRowPositions", () => {
    const place = (id: string, position?: "top" | "bottom"): CellConfig =>
        position !== undefined
            ? { kind: "place", id, number: parseInt(id), position }
            : { kind: "place", id, number: parseInt(id) };
    const gap = (): CellConfig => ({ kind: "gap" });

    it("alternates top/bottom from the default when no positions are specified", () => {
        const cells: CellConfig[] = [place("1"), place("2"), place("3"), place("4")];
        const resolved = resolveRowPositions(cells);

        expect(resolved).toEqual([
            { kind: "place", id: "1", number: 1, position: "top" },
            { kind: "place", id: "2", number: 2, position: "bottom" },
            { kind: "place", id: "3", number: 3, position: "top" },
            { kind: "place", id: "4", number: 4, position: "bottom" },
        ]);
    });

    it("starts from bottom when the first place specifies bottom explicitly", () => {
        const cells: CellConfig[] = [place("1", "bottom"), place("2"), place("3")];
        const resolved = resolveRowPositions(cells);

        expect(resolved).toEqual([
            { kind: "place", id: "1", number: 1, position: "bottom" },
            { kind: "place", id: "2", number: 2, position: "top" },
            { kind: "place", id: "3", number: 3, position: "bottom" },
        ]);
    });

    it("mid-row override resets the alternation and the rest follows from it", () => {
        // places 1–2 alternate normally, place 3 forces top (same as place 1),
        // places 4–5 alternate from that override
        const cells: CellConfig[] = [place("1"), place("2"), place("3", "top"), place("4"), place("5")];
        const resolved = resolveRowPositions(cells);

        expect(resolved).toEqual([
            { kind: "place", id: "1", number: 1, position: "top" },
            { kind: "place", id: "2", number: 2, position: "bottom" },
            { kind: "place", id: "3", number: 3, position: "top" },
            { kind: "place", id: "4", number: 4, position: "bottom" },
            { kind: "place", id: "5", number: 5, position: "top" },
        ]);
    });

    it("gaps are transparent — alternation continues across a gap as if it weren't there", () => {
        // place 1 → top, gap, place 2 should flip from top → bottom (gap skipped)
        const cells: CellConfig[] = [place("1"), gap(), place("2"), place("3")];
        const resolved = resolveRowPositions(cells);

        expect(resolved).toEqual([
            { kind: "place", id: "1", number: 1, position: "top" },
            { kind: "gap" },
            { kind: "place", id: "2", number: 2, position: "bottom" },
            { kind: "place", id: "3", number: 3, position: "top" },
        ]);
    });

    it("multiple gaps in a row do not disturb the alternation", () => {
        const cells: CellConfig[] = [place("1"), gap(), gap(), place("2"), gap(), place("3")];
        const resolved = resolveRowPositions(cells);

        expect(resolved).toEqual([
            { kind: "place", id: "1", number: 1, position: "top" },
            { kind: "gap" },
            { kind: "gap" },
            { kind: "place", id: "2", number: 2, position: "bottom" },
            { kind: "gap" },
            { kind: "place", id: "3", number: 3, position: "top" },
        ]);
    });

    it("a row of only gaps resolves without error", () => {
        const cells: CellConfig[] = [gap(), gap()];
        expect(resolveRowPositions(cells)).toEqual([{ kind: "gap" }, { kind: "gap" }]);
    });

    it("an empty row resolves to an empty array", () => {
        expect(resolveRowPositions([])).toEqual([]);
    });
});

describe("real config — resolved positions and place counts", () => {
    const clusters = listClusterConfigs();
    const c1 = clusters.find((c) => c.number === 1)!;
    const c2 = clusters.find((c) => c.number === 2)!;
    const c3 = clusters.find((c) => c.number === 3)!;

    function placePositions(cluster: ClusterConfig, rowNumber: number): ("top" | "bottom")[] {
        const row = cluster.rows.find((r) => r.number === rowNumber);
        if (!row) throw new Error(`Row ${rowNumber} not found in cluster ${cluster.id}`);
        return resolveRowPositions(row.cells)
            .filter((c): c is ResolvedPlaceCellConfig => c.kind === "place")
            .map((c) => c.position);
    }

    function placeCount(cluster: ClusterConfig): number {
        return cluster.rows.flatMap((r) => r.cells).filter((c) => c.kind === "place").length;
    }

    it("c1 has 79 places", () => expect(placeCount(c1)).toBe(79));
    it("c2 has 76 places", () => expect(placeCount(c2)).toBe(76));
    it("c3 has 32 places", () => expect(placeCount(c3)).toBe(32));

    // Cluster 1
    it("c1 R6: 21 places, starts bottom, alternates, gap-transparent", () => {
        expect(placePositions(c1, 6)).toEqual([
            "bottom", "top", "bottom", "top", "bottom", "top", "bottom", "top", "bottom",
            "top", "bottom", "top", "bottom", "top", "bottom", "top", "bottom", "top", "bottom", "top", "bottom",
        ]);
    });

    it("c1 R5: identical structure to R6", () => {
        expect(placePositions(c1, 5)).toEqual(placePositions(c1, 6));
    });

    it("c1 R4: starts top, p9=bottom after gap (gap does not continue alternation)", () => {
        expect(placePositions(c1, 4)).toEqual([
            "top", "bottom", "top", "bottom", "top", "bottom", "top", "bottom",
            "bottom", "top", "bottom",
        ]);
    });

    it("c1 R3: three consecutive tops at p4, p5, p6 across gaps", () => {
        expect(placePositions(c1, 3)).toEqual([
            "top", "bottom", "top",
            "top",
            "top",
            "top", "bottom", "top", "bottom",
        ]);
    });

    it("c1 R2: starts top, gap continues alternation (p2=bottom, p3=top)", () => {
        expect(placePositions(c1, 2)).toEqual([
            "top", "bottom",
            "top", "bottom", "top", "bottom",
        ]);
    });

    it("c1 R1: starts top, p9=bottom after gap (same pattern as R4)", () => {
        expect(placePositions(c1, 1)).toEqual([
            "top", "bottom", "top", "bottom", "top", "bottom", "top", "bottom",
            "bottom", "top", "bottom",
        ]);
    });

    // Cluster 2
    it("c2 R6, R5, R3, R2: 13 places each, starts top, no gaps", () => {
        const expected = ["top", "bottom", "top", "bottom", "top", "bottom", "top", "bottom", "top", "bottom", "top", "bottom", "top"];
        expect(placePositions(c2, 6)).toEqual(expected);
        expect(placePositions(c2, 5)).toEqual(expected);
        expect(placePositions(c2, 3)).toEqual(expected);
        expect(placePositions(c2, 2)).toEqual(expected);
    });

    it("c2 R4: starts top, p9=bottom after gap", () => {
        expect(placePositions(c2, 4)).toEqual([
            "top", "bottom", "top", "bottom", "top", "bottom", "top", "bottom",
            "bottom", "top", "bottom", "top",
        ]);
    });

    it("c2 R1: identical pattern to R4", () => {
        expect(placePositions(c2, 1)).toEqual(placePositions(c2, 4));
    });

    // Cluster 3
    it("c3 R5, R4, R3: 6 places each, starts top, no gaps", () => {
        const expected = ["top", "bottom", "top", "bottom", "top", "bottom"];
        expect(placePositions(c3, 5)).toEqual(expected);
        expect(placePositions(c3, 4)).toEqual(expected);
        expect(placePositions(c3, 3)).toEqual(expected);
    });

    it("c3 R2: 7 places, starts bottom", () => {
        expect(placePositions(c3, 2)).toEqual([
            "bottom", "top", "bottom", "top", "bottom", "top", "bottom",
        ]);
    });

    it("c3 R1: identical to R2", () => {
        expect(placePositions(c3, 1)).toEqual(placePositions(c3, 2));
    });
});
