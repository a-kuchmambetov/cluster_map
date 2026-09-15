import { useState } from "react";
import { useClusters } from "@/hooks/use-clusters";
import { useClusterLayout } from "@/hooks/use-cluster-layout";
import { useClusterOccupancy } from "@/hooks/use-cluster-occupancy";
import { buildClusterMapView } from "@/utils/build-cluster-map-view";
import { ClusterSelector } from "@/components/application/cluster-map/cluster-selector";
import { ClusterMap } from "@/components/application/cluster-map/cluster-map";
import { useClusterEvents } from "@/hooks/use-cluster-events";

export const HomeScreen = () => {
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
        (!layoutData && layoutLoading) ||
        (!occupancyData && occupancyLoading);

    const mapError =
        (!layoutData ? layoutError : null) ??
        (!occupancyData ? occupancyError : null);

    if (clustersLoading) {
        return (
            <div className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8">
                <h1 className="text-2xl font-semibold">
                    Cluster Map
                </h1>

                <div className="mt-6 rounded-2xl border border-secondary bg-primary p-6 shadow-sm">
                    <div className="text-sm text-tertiary">
                        Loading clusters...
                    </div>
                </div>
            </div>
        );
    }

    if (clustersError) {
        return (
            <div className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8">
                <h1 className="text-2xl font-semibold">
                    Cluster Map
                </h1>

                <div className="mt-6 rounded-2xl border border-secondary bg-primary p-6 shadow-sm">
                    <div className="font-medium">
                        Unable to load clusters
                    </div>

                    <div className="mt-1 text-sm text-tertiary">
                        Please try again later.
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8">
            <h1 className="text-2xl font-semibold">
                Cluster Map
            </h1>

            <div className="mt-6 space-y-6">
                <ClusterSelector
                    clusters={clustersData?.clusters ?? []}
                    selectedCluster={selectedCluster}
                    onSelect={setSelectedCluster}
                />

                {mapLoading && (
                    <div className="rounded-2xl border border-secondary bg-primary p-4 shadow-sm sm:p-6">
                        <div className="animate-pulse">
                            {/* Header skeleton */}
                            <div className="flex items-center justify-between gap-4">
                                <div className="h-6 w-28 rounded-md bg-secondary" />

                                <div className="flex gap-4">
                                    <div className="h-10 w-12 rounded-md bg-secondary" />
                                    <div className="h-10 w-12 rounded-md bg-secondary" />
                                    <div className="h-10 w-12 rounded-md bg-secondary" />
                                </div>
                            </div>

                            {/* Fake map rows */}
                            <div className="mt-8 space-y-4">
                                <div className="h-4 w-16 rounded bg-secondary" />
                                <div className="h-20 w-3/4 rounded-xl bg-secondary" />

                                <div className="h-4 w-16 rounded bg-secondary" />
                                <div className="h-20 w-2/3 rounded-xl bg-secondary" />

                                <div className="h-4 w-16 rounded bg-secondary" />
                                <div className="h-20 w-4/5 rounded-xl bg-secondary" />
                            </div>

                            {/* Footer skeleton */}
                            <div className="mt-6 border-t border-secondary pt-4">
                                <div className="h-4 w-40 rounded bg-secondary" />
                            </div>
                        </div>
                    </div>
                )}

                {mapError && (
                    <div className="rounded-2xl border border-secondary bg-primary p-6 shadow-sm">
                        <div className="font-medium">
                            Unable to load this cluster
                        </div>

                        <div className="mt-1 text-sm text-tertiary">
                            {mapError.message}
                        </div>

                        <button
                            type="button"
                            onClick={() => {
                                void refetchLayout();
                                void refetchOccupancy();
                            }}
                            className="
                                mt-4 rounded-lg bg-[#c47820] px-4 py-2
                                text-sm font-medium text-white
                                transition-opacity hover:opacity-90
                                focus-visible:outline-none
                                focus-visible:ring-2
                                focus-visible:ring-[#c47820]/30
                                focus-visible:ring-offset-2
                            ">
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