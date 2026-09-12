import type {
    ClusterListResponse,
    ClusterMapResponse,
    ClusterLayoutResponse,
    ClusterOccupancyResponse,
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


// added for the new /layout /occupancy 

// Fetches the physical layout for one cluster.
export const getClusterLayout = async (
    clusterNumber: number,
): Promise<ClusterLayoutResponse> => {
    const response = await fetch(
        `${API_BASE_URL}/clusters/${clusterNumber}/layout`,
    );

    if (!response.ok) {
        throw new Error(
            `Failed to fetch cluster layout: ${response.status}`,
        );
    }

    return response.json();
};

// Fetches the current occupied places for one cluster.
export const getClusterOccupancy = async (
    clusterNumber: number,
): Promise<ClusterOccupancyResponse> => {
    const response = await fetch(
        `${API_BASE_URL}/clusters/${clusterNumber}/occupancy`,
    );

    if (!response.ok) {
        throw new Error(
            `Failed to fetch cluster occupancy: ${response.status}`,
        );
    }

    return response.json();
};