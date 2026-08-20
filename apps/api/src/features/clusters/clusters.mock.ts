export type OccupancyRow = {
    row: number;
    place: number;
    intraName: string | null;
    displayName: string | null;
    photo: string | null;
};

const OCCUPANCY_FIXTURES: Record<string, OccupancyRow[]> = {
    c1: [{ row: 1, place: 2, intraName: "jdoe", displayName: "John Doe", photo: null }],
    c2: [{ row: 1, place: 1, intraName: null, displayName: "Guest User", photo: null }],
};

export async function getClusterOccupancy(clusterKey: string): Promise<OccupancyRow[]> {
    return OCCUPANCY_FIXTURES[clusterKey] ?? [];
}
