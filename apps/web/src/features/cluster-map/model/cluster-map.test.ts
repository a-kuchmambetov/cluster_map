import { describe, expect, it } from "vitest";
import type { ClusterLayoutResponse, OccupiedEntry } from "@repo/types";
import { applyOccupancyDelta } from "./apply-occupancy-delta";
import { buildClusterMapView } from "./build-cluster-map-view";

const peer = { intraName: "student", displayName: "Student", photo: null };
const entry = (row: number, place: number): OccupiedEntry => ({
  row,
  place,
  peer,
});

describe("map model", () => {
  it("joins occupancy by row and place, preserves gaps, and excludes unknown places from totals", () => {
    const layout: ClusterLayoutResponse = {
      cluster: { id: "c1", number: 1, label: "Cluster 1" },
      rows: [1, 2].map((number) => ({
        id: `r${number}`,
        number,
        label: `Row ${number}`,
        cells: [
          { kind: "place", id: `p${number}`, number: 1 },
          { kind: "gap" },
        ],
      })),
    };
    const map = buildClusterMapView(layout, {
      occupied: [entry(2, 1), entry(9, 9)],
      lastUpdated: "2026-09-19T12:00:00Z",
    });
    expect(map.summary).toEqual({ total: 2, occupied: 1, free: 1 });
    expect(map.rows[0].cells[0]).toMatchObject({ status: "free", peer: null });
    expect(map.rows[1].cells[0]).toMatchObject({ status: "occupied", peer });
    expect(map.rows[0].cells[1]).toEqual({ kind: "gap" });
    expect(map.lastUpdated).toBe("2026-09-19T12:00:00Z");
    expect(layout.rows[0].cells[0]).not.toHaveProperty("status");
  });

  it("applies frees before additions, replaces peer data, and leaves the input intact", () => {
    const current = [entry(1, 1), entry(1, 2), entry(2, 1)];
    const changed = {
      ...entry(1, 2),
      peer: { ...peer, displayName: "Changed" },
    };
    const next = applyOccupancyDelta(current, {
      freed: [
        { row: 1, place: 1 },
        { row: 1, place: 2 },
      ],
      occupied: [changed, entry(3, 1)],
    });
    expect(next).toEqual(
      expect.arrayContaining([entry(2, 1), changed, entry(3, 1)]),
    );
    expect(next).toHaveLength(3);
    expect(current).toEqual([entry(1, 1), entry(1, 2), entry(2, 1)]);
  });
});
