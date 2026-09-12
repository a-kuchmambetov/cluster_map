import { describe, expect, it } from "vitest";
import { resolveRowPositions } from "./clusters.service";
import type { CellConfig } from "./clusters.types";

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
