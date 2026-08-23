import type { OccupancyRow } from "./clusters.types";

const OCCUPANCY_FIXTURES: Record<string, OccupancyRow[]> = {
    c1: [{ row: 1, place: 2, intraName: "jdoe", displayName: "John Doe", photo: null }],
    c2: [{ row: 1, place: 1, intraName: null, displayName: "Guest User", photo: null }],
};

// Stand-in for @repo/db's getClusterOccupancy (blocked per DB-contract.md §4/§7).
// Only this function body changes once the real implementation ships.
export async function getClusterOccupancy(clusterKey: string): Promise<OccupancyRow[]> {
    return OCCUPANCY_FIXTURES[clusterKey] ?? [];
}
