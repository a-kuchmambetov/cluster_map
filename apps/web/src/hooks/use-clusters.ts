import { useEffect, useState } from "react";
import type { ClusterListResponse } from "@repo/types";
import { mockClusters } from "../api/mock-cluster-map";

// Loads the available clusters for the cluster selector.
export const useClusters = () => {
    const [data, setData] = useState<ClusterListResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
        try {
            setData(mockClusters);
        } catch (err) {
            setError(err instanceof Error ? err : new Error("Unknown error"));
        } finally {
            setLoading(false);
        }
    }, []);

    return { data, loading, error };
};