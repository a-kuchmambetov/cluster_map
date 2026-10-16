import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { ClusterOccupancyResponse, OccupiedEntry } from "@repo/types";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useClusterOccupancy } from "./use-cluster-occupancy";

const getClusterOccupancyMock = vi.fn();
vi.mock("../api/cluster-map", () => ({
  getClusterOccupancy: (...args: unknown[]) => getClusterOccupancyMock(...args),
}));

const entry = (
  place: number,
  intraName: string | null = null,
): OccupiedEntry => ({
  row: 1,
  place,
  peer: { intraName, displayName: null, photo: null },
});

describe("cluster occupancy stream updates", () => {
  let root: Root;
  let container: HTMLDivElement;
  let result: ReturnType<typeof useClusterOccupancy>;
  function Harness() {
    result = useClusterOccupancy(1);
    return null;
  }
  beforeEach(async () => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    getClusterOccupancyMock.mockResolvedValue({
      occupied: [entry(1)],
      lastUpdated: "2026-01-01T00:00:00Z",
    } satisfies ClusterOccupancyResponse);
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    await act(async () => {
      root.render(<Harness />);
    });
  });
  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("replaces stale data with a stream snapshot and applies later deltas to it", async () => {
    await act(async () => {
      result.applyDelta({ occupied: [entry(9)], freed: [] });
      result.markStale();
    });
    expect(result.stale).toBe(true);

    const snapshot = {
      occupied: [entry(2, "jdoe")],
      lastUpdated: "2026-01-01T00:01:00Z",
    };
    await act(async () => {
      result.applySnapshot(snapshot);
    });
    expect(result.data).toEqual(snapshot);
    expect(result.stale).toBe(false);

    await act(async () => {
      result.applyDelta({
        occupied: [entry(3)],
        freed: [{ row: 1, place: 2 }],
      });
    });
    expect(result.data?.occupied).toEqual([entry(3)]);
    expect(getClusterOccupancyMock).toHaveBeenCalledOnce();
  });
});
