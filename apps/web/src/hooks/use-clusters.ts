import { useEffect, useState } from "react";
import type { ClusterListResponse } from "@repo/types";
import { getClusters } from "../api/cluster-map";
import { mockClusters } from "../api/mock-cluster-map";

// Loads the available clusters.
// Uses mock data when VITE_USE_MOCK_API=true.
export const useClusters = () => {
    const [data, setData] = useState<ClusterListResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
        const loadClusters = async () => {
            try {
                setLoading(true);
                setError(null);

                console.log("MOCK API:", import.meta.env.VITE_USE_MOCK_API);
                // Use fake data during frontend development,
                // otherwise request data from the real API.
                const result =
                    import.meta.env.VITE_USE_MOCK_API === "true"
                        ? mockClusters
                        : await getClusters();

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

        loadClusters();
    }, []);

    return { data, loading, error };
};