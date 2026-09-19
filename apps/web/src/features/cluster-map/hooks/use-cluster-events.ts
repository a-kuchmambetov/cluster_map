import { useEffect } from "react";
import {
  subscribeClusterEvents,
  type ClusterEventsOptions,
} from "../api/cluster-events";

export const useClusterEvents = (options: ClusterEventsOptions) => {
  const { clusterNumber, enabled, onDelta, onDbUnavailable, refetchOccupancy } =
    options;
  useEffect(
    () =>
      subscribeClusterEvents({
        clusterNumber,
        enabled,
        onDelta,
        onDbUnavailable,
        refetchOccupancy,
      }),
    [clusterNumber, enabled, onDelta, onDbUnavailable, refetchOccupancy],
  );
};
