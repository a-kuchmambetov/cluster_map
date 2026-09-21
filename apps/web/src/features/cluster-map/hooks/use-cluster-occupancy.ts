import { useCallback } from "react";
import type { OccupancyDelta } from "@repo/types";
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
  return { ...snapshot, applyDelta };
};
