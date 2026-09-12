import type {
    ClusterLayoutResponse,
    ClusterOccupancyResponse,
} from "@repo/types";
import type { ClusterMapView } from "@/types/cluster-map-view";

export const buildClusterMapView = (
    layout: ClusterLayoutResponse,
    occupancy: ClusterOccupancyResponse,
): ClusterMapView => {
    const occupiedByPlace = new Map(
        occupancy.occupied.map((entry) => [
            `${entry.row}:${entry.place}`,
            entry,
        ]),
    );

    let total = 0;
    let occupied = 0;

    const rows = layout.rows.map((row) => ({
        ...row,

        cells: row.cells.map((cell) => {
            if (cell.kind === "gap") {
                return cell;
            }

            total += 1;

            const occupancyEntry = occupiedByPlace.get(
                `${row.number}:${cell.number}`,
            );

            if (occupancyEntry) {
                occupied += 1;

                return {
                    ...cell,
                    status: "occupied" as const,
                    peer: occupancyEntry.peer,
                };
            }

            return {
                ...cell,
                status: "free" as const,
                peer: null,
            };
        }),
    }));

    return {
        cluster: layout.cluster,
        rows,
        summary: {
            free: total - occupied,
            occupied,
            total,
        },
        lastUpdated: occupancy.lastUpdated,

        // Config-validation will supply these later.
        warnings: [],
    };
};