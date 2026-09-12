import { describe, expect, it } from "vitest";
import { listClusterConfigs, resolveRowPositions } from "../../features/clusters/clusters.service";
import type { ClusterConfig, ResolvedPlaceCellConfig } from "../../features/clusters/clusters.types";

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
