import { ClusterSelector } from "./components/cluster-selector";
import { ClusterMap } from "./components/cluster-map";
import { ClusterMapSkeleton } from "./components/cluster-map-skeleton";
import { useClusterMap } from "./hooks/use-cluster-map";

export const ClusterMapScreen = () => {
  const {
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
  } = useClusterMap();

  if (clustersLoading) {
    return (
      <div className="mx-auto w-full max-w-[1280px] px-4 py-6 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-semibold tracking-tight">Clusters</h1>

        <div className="mt-6 rounded-2xl border border-secondary bg-primary p-6 shadow-sm">
          <div className="text-sm text-tertiary">Loading clusters...</div>
        </div>
      </div>
    );
  }

  if (clustersError) {
    return (
      <div className="mx-auto w-full max-w-[1280px] px-4 py-6 sm:px-6 lg:px-8">
        <h1 className="text-2xl font-semibold">Clusters</h1>

        <div className="mt-6 rounded-2xl border border-secondary bg-primary p-6 shadow-sm">
          <div className="font-medium">Unable to load clusters</div>

          <div className="mt-1 text-sm text-tertiary">
            Please try again later.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1280px] px-4 py-6 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-semibold tracking-tight">Clusters</h1>

      <div className="mt-3 space-y-5">
        <div>
          <ClusterSelector
            clusters={clustersData?.clusters ?? []}
            selectedCluster={selectedCluster}
            onSelect={setSelectedCluster}
          />
        </div>

        {mapLoading && <ClusterMapSkeleton />}

        {mapError && (
          <div className="rounded-2xl border border-cluster-border bg-cluster-surface p-5 shadow-xs sm:p-6">
            <div className="text-sm font-semibold text-primary">
              Unable to load this cluster
            </div>

            <div className="mt-1 text-sm text-tertiary">{mapError.message}</div>

            <button
              type="button"
              onClick={() => {
                void refetchLayout();
                void refetchOccupancy();
              }}
              className="mt-4 rounded-lg bg-cluster-accent px-4 py-2 text-sm font-medium text-cluster-accent-text transition-colors duration-150 hover:bg-cluster-accent-hover focus-visible:ring-2 focus-visible:ring-cluster-accent/40 focus-visible:ring-offset-2 focus-visible:outline-none"
            >
              Try again
            </button>
          </div>
        )}

        {mapData && !mapLoading && !mapError && (
          <ClusterMap
            map={mapData}
            refreshing={occupancyRefreshing}
            stale={occupancyStale}
          />
        )}
      </div>
    </div>
  );
};
