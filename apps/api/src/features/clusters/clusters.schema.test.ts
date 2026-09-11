import { describe, expect, it } from "vitest";
import { clustersConfigFileSchema } from "./clusters.schema";

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
