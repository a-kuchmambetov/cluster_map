import { getClusterOccupancy, type OccupancyRow } from "./clusters.mock";
import { loadClusterConfig } from "./clusters.repository";
import type { Cell, ClusterConfig, ClusterMapResponse, ClusterRow, Peer, Warning } from "./clusters.types";

export function resolveDisplayPeer(row: OccupancyRow): Peer {
    return {
        intraName: row.intraName,
        displayName: row.intraName ?? row.displayName ?? null,
        photo: row.photo,
    };
}

export function mergeConfigWithOccupancy(config: ClusterConfig, occupancyRows: OccupancyRow[]): ClusterMapResponse {
    const occupancyByPlaceKey = new Map<string, OccupancyRow[]>();
    for (const occupancyRow of occupancyRows) {
        const key = `${occupancyRow.row}:${occupancyRow.place}`;
        const matches = occupancyByPlaceKey.get(key) ?? [];
        matches.push(occupancyRow);
        occupancyByPlaceKey.set(key, matches);
    }

    const configuredPlaceKeys = new Set<string>();
    for (const rowConfig of config.rows) {
        for (const cellConfig of rowConfig.cells) {
            if (cellConfig.kind === "place") {
                configuredPlaceKeys.add(`${rowConfig.number}:${cellConfig.number}`);
            }
        }
    }

    const warnings: Warning[] = [];
    for (const [key, matches] of occupancyByPlaceKey) {
        const [row, place] = key.split(":");

        if (!configuredPlaceKeys.has(key)) {
            warnings.push({
                code: "ORPHANED_OCCUPANCY",
                message: `Occupancy record for row ${row}, place ${place} has no matching place in the layout config`,
            });
        } else if (matches.length > 1) {
            warnings.push({
                code: "DUPLICATE_OCCUPANCY",
                message: `Found ${matches.length} occupancy records for row ${row}, place ${place}`,
            });
        }
    }

    let free = 0;
    let occupied = 0;

    const rows: ClusterRow[] = config.rows.map((rowConfig) => {
        const cells: Cell[] = rowConfig.cells.map((cellConfig) => {
            if (cellConfig.kind === "gap") {
                return { kind: "gap" };
            }

            const matches = occupancyByPlaceKey.get(`${rowConfig.number}:${cellConfig.number}`) ?? [];

            if (matches.length > 0) {
                occupied += 1;
                return {
                    kind: "place",
                    id: cellConfig.id,
                    number: cellConfig.number,
                    status: "occupied",
                    peer: resolveDisplayPeer(matches[0]),
                };
            }

            free += 1;
            return {
                kind: "place",
                id: cellConfig.id,
                number: cellConfig.number,
                status: "free",
                peer: null,
            };
        });

        return {
            id: rowConfig.id,
            number: rowConfig.number,
            label: rowConfig.label,
            cells,
        };
    });

    return {
        cluster: { id: config.id, number: config.number, label: config.label },
        rows,
        summary: { free, occupied, total: free + occupied },
        lastUpdated: new Date().toISOString(),
        warnings,
    };
}

export async function getClusterMap(clusterNumber: number): Promise<ClusterMapResponse> {
    const config = loadClusterConfig(clusterNumber);
    const occupancyRows = await getClusterOccupancy(config.key);

    return mergeConfigWithOccupancy(config, occupancyRows);
}
