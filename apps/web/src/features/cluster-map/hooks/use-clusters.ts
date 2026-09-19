import { useEffect, useState } from "react";
import type { ClusterListResponse } from "@repo/types";
import { getClusters } from "../api/cluster-map";

// Loads the available clusters.
export const useClusters = () => {
  const [data, setData] = useState<ClusterListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const loadClusters = async () => {
      try {
        setLoading(true);
        setError(null);

        const result = await getClusters(controller.signal);
        if (!controller.signal.aborted) setData(result);
      } catch (err) {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err : new Error("Unknown error"));
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };

    void loadClusters();
    return () => controller.abort();
  }, []);

  return { data, loading, error };
};
