import { useCallback, useEffect, useState } from "react";
import type { ClusterOccupancyResponse } from "@repo/types";
import { getClusterOccupancy } from "../api/cluster-map";
import { mockClusterOccupancies } from "../api/mock-cluster-map";

// Loads the current occupancy for the selected cluster.
export const useClusterOccupancy = (clusterNumber: number) => {
    const [data, setData] = useState<ClusterOccupancyResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    const loadOccupancy = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);

            const result =
                import.meta.env.VITE_USE_MOCK_API === "true"
                    ? mockClusterOccupancies[clusterNumber]
                    : await getClusterOccupancy(clusterNumber);

            if (!result) {
                throw new Error(
                    `Occupancy for cluster ${clusterNumber} not found`,
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
    }, [clusterNumber]);

    useEffect(() => {
        void loadOccupancy();
    }, [loadOccupancy]);

    return {
        data,
        loading,
        error,
        refetch: loadOccupancy,
    };
};
