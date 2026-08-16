import { useEffect, useState } from "react";
import type { ClusterMapResponse } from "@repo/types";
import { getClusterMap } from "../api/cluster-map";
import { mockClusterMaps } from "../api/mock-cluster-map";

// Loads the map for the selected cluster.
// Uses mock data when VITE_USE_MOCK_API=true.
export const useClusterMap = (clusterNumber: number) => {
    const [data, setData] = useState<ClusterMapResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
        const loadMap = async () => {
            try {
                setLoading(true);
                setError(null);

                // Use fake data during frontend development,
                // otherwise request data from the real API.
                const result =
                    import.meta.env.VITE_USE_MOCK_API === "true"
                        ? mockClusterMaps[clusterNumber]
                        : await getClusterMap(clusterNumber);

                if (!result) {
                    throw new Error(
                        `Cluster ${clusterNumber} not found`,
                    );
                }

                setData(result);
            } catch (err) {
                setError(
                    err instanceof Error
                        ? err
                        : new Error("Unknown error"),
                );
            } finally {
                setLoading(false);
            }
        };

        loadMap();
    }, [clusterNumber]);

    return { data, loading, error };
};