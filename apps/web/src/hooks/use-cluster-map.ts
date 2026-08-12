import { useEffect, useState } from "react";
import type { ClusterMapResponse } from "@repo/types";
import { mockClusterMap } from "../api/mock-cluster-map";

// Loads the map data for spicific cluster
// currently only for one to have some rendering tests 
export const useClusterMap = (clusterNumber: number) => {
    const [data, setData] = useState<ClusterMapResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
        try {
            setData(mockClusterMap);
        } catch (err) {
            setError(err instanceof Error ? err : new Error("Unknown error"));
        } finally {
            setLoading(false);
        }
    }, [clusterNumber]);

    return { data, loading, error };
};