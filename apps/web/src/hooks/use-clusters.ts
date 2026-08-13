import { useEffect, useState } from "react";
import type { ClusterListResponse } from "@repo/types";
// REMOVE LATER
// ADDED FOR TEST
import { mockClusters } from "../api/mock-cluster-map";

// Loads the available clusters for the cluster selector.
export const useClusters = () => {
    const [data, setData] = useState<ClusterListResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
        // Start a new request.
        setLoading(true);
        setError(null);

        const loadClusters = async () => {
            try {
                // REMOVE LATER
                // ADDED FOR TEST
                await new Promise((resolve) => setTimeout(resolve, 500));

                setData(mockClusters);
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

        loadClusters();
    }, []);

    return { data, loading, error };
};