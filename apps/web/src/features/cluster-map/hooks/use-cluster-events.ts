import { useEffect } from "react";
import {
  subscribeClusterEvents,
  type ClusterEventsOptions,
} from "../api/cluster-events";

export const useClusterEvents = (options: ClusterEventsOptions) => {
  const { clusterNumber, enabled, onSnapshot, onDelta, onStale } = options;
  useEffect(
    () =>
      subscribeClusterEvents({
        clusterNumber,
        enabled,
        onSnapshot,
        onDelta,
        onStale,
      }),
    [clusterNumber, enabled, onSnapshot, onDelta, onStale],
  );
};
