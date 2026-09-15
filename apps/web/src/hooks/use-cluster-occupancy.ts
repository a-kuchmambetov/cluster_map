import { useCallback, useEffect, useRef, useState } from "react";
import type { ClusterOccupancyResponse, OccupancyDelta, } from "@repo/types";
import { getClusterOccupancy } from "../api/cluster-map";
import { applyOccupancyDelta } from "@/utils/apply-occupancy-delta";
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

            return true;
        } catch (err) {
            const nextError =
                err instanceof Error
                    ? err
                    : new Error("Unknown error");

            setError(nextError);

            if (dataRef.current !== null) {
                setStale(true);
            }

            return false;
        } finally {
            setLoading(false);
            setRefreshing(false);
        }

    }, [clusterNumber]);

    const applyDelta = useCallback((delta: OccupancyDelta) => {
        const current = dataRef.current;

        if (!current) {
            return;
        }

        const next: ClusterOccupancyResponse = {
            ...current,
            occupied: applyOccupancyDelta(
                current.occupied,
                delta,
            ),
            lastUpdated: new Date().toISOString(),
        };

        dataRef.current = next;
        setData(next);
        setError(null);
        setStale(false);
    }, []);

    const markStale = useCallback(() => {
        if (dataRef.current !== null) {
            setStale(true);
        }
    }, []);

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
        applyDelta,
        markStale,
    };
};