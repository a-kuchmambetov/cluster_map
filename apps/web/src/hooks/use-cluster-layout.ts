import { useCallback, useEffect, useState } from "react";
import type { ClusterLayoutResponse } from "@repo/types";
import { getClusterLayout } from "../api/cluster-map";
import { mockClusterLayouts } from "../api/mock-cluster-map";

// Loads the physical layout for the selected cluster.
export const useClusterLayout = (clusterNumber: number) => {
    const [data, setData] = useState<ClusterLayoutResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    const loadLayout = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);

            const result =
                import.meta.env.VITE_USE_MOCK_API === "true"
                    ? mockClusterLayouts[clusterNumber]
                    : await getClusterLayout(clusterNumber);

            if (!result) {
                throw new Error(
                    `Layout for cluster ${clusterNumber} not found`,
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
        void loadLayout();
    }, [loadLayout]);

    return {
        data,
        loading,
        error,
        refetch: loadLayout,
    };
};
