import { useCallback, useEffect, useRef, useState } from "react";
import type { ClusterOccupancyResponse } from "@repo/types";
import { getClusterOccupancy } from "../api/cluster-map";
import { mockClusterOccupancies } from "../api/mock-cluster-map";

// Loads and refreshes the current occupancy for the selected cluster.
export const useClusterOccupancy = (clusterNumber: number) => {
    const [data, setData] = useState<ClusterOccupancyResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [stale, setStale] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    const dataRef = useRef<ClusterOccupancyResponse | null>(null);

    const loadOccupancy = useCallback(async () => {
        const hasData = dataRef.current !== null;

        if (hasData) {
            setRefreshing(true);
        } else {
            setLoading(true);
        }

        setError(null);

        try {

            const result =
                import.meta.env.VITE_USE_MOCK_API === "true"
                    ? mockClusterOccupancies[clusterNumber]
                    : await getClusterOccupancy(clusterNumber);

            if (!result) {
                throw new Error(
                    `Occupancy for cluster ${clusterNumber} not found`,
                );
            }

            dataRef.current = result;
            setData(result);
            setStale(false);
        } catch (err) {
            const nextError =
                err instanceof Error
                    ? err
                    : new Error("Unknown error");

            setError(nextError);

            if (dataRef.current !== null) {
                setStale(true);
            }
        } finally {
            setLoading(false);
            setRefreshing(false);
        }

    }, [clusterNumber]);

    useEffect(() => {
        dataRef.current = null;
        setData(null);
        setError(null);
        setStale(false);
        setLoading(true);

        void loadOccupancy();
    }, [clusterNumber, loadOccupancy]);

    return {
        data,
        loading,
        refreshing,
        stale,
        error,
        refetch: loadOccupancy,
    };
};