import { useEffect, useState } from "react";
import type { ClusterListResponse } from "@repo/types";
import { getClusters } from "../api/cluster-map";

// Loads the available clusters.
export const useClusters = () => {
    const [data, setData] = useState<ClusterListResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
        const loadClusters = async () => {
            try {
                setLoading(true);
                setError(null);

                const result = await getClusters();
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

        void loadClusters();
    }, []);

    return { data, loading, error };
};