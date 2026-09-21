import { useState } from "react";
import { useClusters } from "./use-clusters";
import { useClusterLayout } from "./use-cluster-layout";
import { useClusterOccupancy } from "./use-cluster-occupancy";
import { buildClusterMapView } from "../model/build-cluster-map-view";
import { useClusterEvents } from "./use-cluster-events";

export const useClusterMap = () => {
  const {
    data: clustersData,
    loading: clustersLoading,
    error: clustersError,
  } = useClusters();

  const [selectedCluster, setSelectedCluster] = useState(1);

  const {
    data: layoutData,
    loading: layoutLoading,
    error: layoutError,
    refetch: refetchLayout,
  } = useClusterLayout(selectedCluster);

  const {
    data: occupancyData,
    loading: occupancyLoading,
    refreshing: occupancyRefreshing,
    stale: occupancyStale,
    error: occupancyError,
    refetch: refetchOccupancy,
    applyDelta,
    markStale,
  } = useClusterOccupancy(selectedCluster);

  useClusterEvents({
    clusterNumber: selectedCluster,
    enabled: occupancyData !== null,
    onDelta: applyDelta,
    onDbUnavailable: markStale,
    refetchOccupancy,
  });

  const mapData =
    layoutData && occupancyData
      ? buildClusterMapView(layoutData, occupancyData)
      : null;

  const mapLoading =
    (!layoutData && layoutLoading) || (!occupancyData && occupancyLoading);

  const mapError =
    (!layoutData ? layoutError : null) ??
    (!occupancyData ? occupancyError : null);

  return {
    clustersData,
    clustersLoading,
    clustersError,
    selectedCluster,
    setSelectedCluster,
    mapData,
    mapLoading,
    mapError,
    occupancyRefreshing,
    occupancyStale,
    refetchLayout,
    refetchOccupancy,
  };
};
