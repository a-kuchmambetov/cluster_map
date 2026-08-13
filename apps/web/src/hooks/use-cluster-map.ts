import { useEffect, useState } from "react";
import type { ClusterMapResponse } from "@repo/types";
// REMOVE THIS LATER 
import { mockClusterMaps } from "../api/mock-cluster-map";

// Loads the map data for the selected cluster.
// Currently uses mock data until the real API is ready.
export const useClusterMap = (clusterNumber: number) => {
    const [data, setData] = useState<ClusterMapResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
        // Start a new request.
        setLoading(true);
        setError(null);

        const loadMap = async () => {
            try {
                // REMOVE THIS LATER
                // TO TEST THE DELAY 
                await new Promise((resolve) => setTimeout(resolve, 500));

                const mockMap = mockClusterMaps[clusterNumber];

                if (!mockMap) {
                    throw new Error(`Cluster ${clusterNumber} not found`);
                }

                setData(mockMap);
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