import type {
  ClusterListResponse,
  ClusterLayoutResponse,
  ClusterOccupancyResponse,
} from "@repo/types";

import { API_BASE_URL } from "@/config/api";

// Fetches the list of available clusters.
export const getClusters = async (
  signal?: AbortSignal,
): Promise<ClusterListResponse> => {
  const response = await fetch(`${API_BASE_URL}/clusters`, { signal });

  if (!response.ok) {
    throw new Error(`Failed to fetch clusters: ${response.status}`);
  }

  return response.json();
};

// Fetches the physical layout for one cluster.
export const getClusterLayout = async (
  clusterNumber: number,
  signal?: AbortSignal,
): Promise<ClusterLayoutResponse> => {
  const response = await fetch(
    `${API_BASE_URL}/clusters/${clusterNumber}/layout`,
    { signal },
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch cluster layout: ${response.status}`);
  }

  return response.json();
};

// Fetches the current occupied places for one cluster.
export const getClusterOccupancy = async (
  clusterNumber: number,
  signal?: AbortSignal,
): Promise<ClusterOccupancyResponse> => {
  const response = await fetch(
    `${API_BASE_URL}/clusters/${clusterNumber}/occupancy`,
    { signal },
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch cluster occupancy: ${response.status}`);
  }

  return response.json();
};
