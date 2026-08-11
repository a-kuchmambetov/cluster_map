import type {
    ClusterListResponse,
    ClusterMapResponse,
} from "@repo/types";

const API_BASE_URL = `${import.meta.env.VITE_API_URL}/api`;


// Fetches the list of available clusters.
export const getClusters = async (): Promise<ClusterListResponse> => {
    const response = await fetch(`${API_BASE_URL}/clusters`);

    if (!response.ok) {
        throw new Error(`Failed to fetch clusters: ${response.status}`);
    }

    return response.json();
};

// Fetches the map and current occupancy for one cluster.
export const getClusterMap = async (
    clusterNumber: number,
): Promise<ClusterMapResponse> => {
    const response = await fetch(
        `${API_BASE_URL}/clusters/${clusterNumber}/map`,
    );

    if (!response.ok) {
        throw new Error(`Failed to fetch cluster map: ${response.status}`);
    }

    return response.json();
};
