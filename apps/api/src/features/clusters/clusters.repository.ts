import type { OccupancyRow } from "./clusters.types";
import {
    cluster,
    db,
    position,
    row,
    user,
    userHiveInfo,
} from "@repo/db";
import { and, eq } from "drizzle-orm";

// const OCCUPANCY_FIXTURES: Record<string, OccupancyRow[]> = {
//     c1: [{ row: 1, place: 2, intraName: "jdoe", displayName: "John Doe", photo: null }],
//     c2: [{ row: 1, place: 1, intraName: null, displayName: "Guest User", photo: null }],
// };

// export async function getClusterOccupancy(clusterKey: string): Promise<OccupancyRow[]> {
//     return OCCUPANCY_FIXTURES[clusterKey] ?? [];
// };

export async function getClusterOccupancy(clusterId: string): Promise<OccupancyRow[]> {
    const occupancy = await db
        .select({
            row: row.number,
            place: position.seatNumber,
            intraName: userHiveInfo.login,
            displayName: user.name,
            photo: user.image,
        })
        .from(position)
        .innerJoin(row, eq(position.rowId, row.id))
        .innerJoin(cluster, eq(row.clusterId, cluster.id))
        .leftJoin(userHiveInfo, eq(position.holderId, userHiveInfo.id))
        .leftJoin(user, eq(userHiveInfo.id, user.id))
        .where(
            and(
                eq(cluster.name, clusterId),
                eq(position.occupied, true),
            ),
        );
    return occupancy;
}
