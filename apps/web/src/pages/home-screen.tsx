import { useState } from "react";
import { useClusters } from "@/hooks/use-clusters";
import { useClusterMap } from "@/hooks/use-cluster-map";
import { ClusterSelector } from "@/components/application/cluster-map/cluster-selector";
import { ClusterMap } from "@/components/application/cluster-map/cluster-map";

export const HomeScreen = () => {
    const {
        data: clustersData,
        loading: clustersLoading,
        error: clustersError,
    } = useClusters();

    const [selectedCluster, setSelectedCluster] = useState(1);

    const {
        data: mapData,
        loading: mapLoading,
        error: mapError,
    } = useClusterMap(selectedCluster);

    if (clustersLoading) {
        return <div>Loading clusters...</div>;
    }

    if (clustersError) {
        return <div>Failed to load clusters...</div>;
    }

    return (
        <div className="p-8">
            <h1 className="text-2xl font-semibold">
                Cluster Map
            </h1>

            <ClusterSelector
                clusters={clustersData?.clusters ?? []}
                selectedCluster={selectedCluster}
                onSelect={setSelectedCluster}
            />

            {mapLoading && (
                <p className="mt-6">Loading map...</p>
            )}

            {mapError && (
                <p className="mt-6">
                    Failed to load map: {mapError.message}
                </p>
            )}

            {mapData && !mapLoading && (
                <ClusterMap map={mapData} />
            )}
        </div>
    );
};