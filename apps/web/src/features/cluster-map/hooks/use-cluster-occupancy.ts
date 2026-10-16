import { useCallback } from "react";
import type { ClusterOccupancyResponse, OccupancyDelta } from "@repo/types";
import { getClusterOccupancy } from "../api/cluster-map";
import { applyOccupancyDelta } from "../model/apply-occupancy-delta";
import { useClusterSnapshot } from "./use-cluster-snapshot";

export const useClusterOccupancy = (clusterNumber: number) => {
  const { updateData, ...snapshot } = useClusterSnapshot(
    clusterNumber,
    getClusterOccupancy,
  );
  const applyDelta = useCallback(
    (delta: OccupancyDelta) => {
      const lastUpdated = new Date().toISOString();
      updateData((current) => ({
        ...current,
        occupied: applyOccupancyDelta(current.occupied, delta),
        lastUpdated,
      }));
    },
    [updateData],
  );
  // Stream snapshots replace the data and clear stale state.
  const applySnapshot = useCallback(
    (next: ClusterOccupancyResponse) => {
      updateData(() => next);
    },
    [updateData],
  );
  return { ...snapshot, applyDelta, applySnapshot };
};
