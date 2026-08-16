import { useState } from "react";
import { useClusters } from "@/hooks/use-clusters";
import { useClusterMap } from "@/hooks/use-cluster-map";
import { ClusterSelector } from "@/components/application/cluster-map/cluster-selector";

export const HomeScreen = () => {
    // Load the available clusters.
    const {
        data: clustersData,
        loading: clustersLoading,
        error: clustersError,
    } = useClusters();

    // Remember which cluster the user selected.
    const [selectedCluster, setSelectedCluster] = useState(1);

    // Load the map for the selected cluster.
    const {
        data: mapData,
        loading: mapLoading,
        error: mapError,
    } = useClusterMap(selectedCluster);

    if (clustersLoading) {
        return <div>Loading clusters...</div>;
    }

    if (clustersError) {
        return <div>Failed to load clusters: {clustersError.message}</div>;
    }

    return (
        <div className="p-8">
            <h1 className="text-2xl font-semibold">Cluster Map</h1>

            {/* Cluster selector */}
            <ClusterSelector
                clusters={clustersData?.clusters ?? []}
                selectedCluster={selectedCluster}
                onSelect={setSelectedCluster}
            />

            {/* Map loading/error state */}
            {mapLoading && <p className="mt-6">Loading map...</p>}

            {mapError && (
                <p className="mt-6">
                    Failed to load map: {mapError.message}
                </p>
            )}

            {/* Map data */}
            {mapData && !mapLoading && (
                <div className="mt-8">
                    <h2 className="text-xl font-semibold">
                        {mapData.cluster.label}
                    </h2>

                    <p className="mt-2">
                        Available places: {mapData.summary.free}
                    </p>

                    <div className="mt-6 space-y-4">
                        {mapData.rows.map((row) => (
                            <div key={row.id}>
                                <h3 className="font-medium">{row.label}</h3>

                                <div className="mt-2 flex gap-2">
                                    {row.cells.map((cell, index) => {
                                        if (cell.kind === "gap") {
                                            return (
                                                <div
                                                    key={`${row.id}-gap-${index}`}
                                                    className="w-20"
                                                />
                                            );
                                        }

                                        return (
                                            <div
                                                key={cell.id}
                                                className="flex h-20 w-20 items-center justify-center border"
                                            >
                                                <div className="text-center">
                                                    <div>
                                                        Place {cell.number}
                                                    </div>

                                                    <div>
                                                        {cell.status}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};