import type {
  ClusterListResponse,
  ClusterLayoutResponse,
  ClusterOccupancyResponse,
} from "@repo/types";

import { apiRequest } from "@/lib/http";
export const getClusters = (signal?: AbortSignal) =>
  apiRequest<ClusterListResponse>("/clusters", { signal });
export const getClusterLayout = (clusterNumber: number, signal?: AbortSignal) =>
  apiRequest<ClusterLayoutResponse>(`/clusters/${clusterNumber}/layout`, {
    signal,
  });
export const getClusterOccupancy = (
  clusterNumber: number,
  signal?: AbortSignal,
) =>
  apiRequest<ClusterOccupancyResponse>(`/clusters/${clusterNumber}/occupancy`, {
    signal,
  });
