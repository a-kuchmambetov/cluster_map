import { AppError } from "@repo/errors";
import { getClusterOccupancy, type OccupancyRow } from "./clusters.mock";
import { listClusterConfigs, loadClusterConfig } from "./clusters.repository";
import type {
    Cell,
    ClusterConfig,
    ClusterMapResponse,
    ClusterRow,
    ConfigValidationError,
    ConfigValidationResponse,
    Peer,
    Warning,
} from "./clusters.types";

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

export function validateClusterConfig(config: ClusterConfig, clusterIndex: number): ConfigValidationError[] {
    const errors: ConfigValidationError[] = [];
    const seenRowIds = new Set<string>();
    const seenRowNumbers = new Set<number>();
    const seenPlaceIds = new Set<string>();

    config.rows.forEach((row, rowIndex) => {
        if (seenRowIds.has(row.id)) {
            errors.push({
                code: "DUPLICATE_ROW_ID",
                message: `Row id ${row.id} is not unique`,
                path: `clusters[${clusterIndex}].rows[${rowIndex}].id`,
            });
        } else {
            seenRowIds.add(row.id);
        }

        if (seenRowNumbers.has(row.number)) {
            errors.push({
                code: "DUPLICATE_ROW_NUMBER",
                message: `Row number ${row.number} is not unique`,
                path: `clusters[${clusterIndex}].rows[${rowIndex}].number`,
            });
        } else {
            seenRowNumbers.add(row.number);
        }

        const seenPlaceNumbersInRow = new Set<number>();

        row.cells.forEach((cell, cellIndex) => {
            if (cell.kind !== "place") {
                return;
            }

            if (seenPlaceIds.has(cell.id)) {
                errors.push({
                    code: "DUPLICATE_PLACE_ID",
                    message: `Place id ${cell.id} is not unique`,
                    path: `clusters[${clusterIndex}].rows[${rowIndex}].cells[${cellIndex}].id`,
                });
            } else {
                seenPlaceIds.add(cell.id);
            }

            if (seenPlaceNumbersInRow.has(cell.number)) {
                errors.push({
                    code: "DUPLICATE_PLACE_NUMBER",
                    message: `Place number ${cell.number} is not unique within row ${row.number}`,
                    path: `clusters[${clusterIndex}].rows[${rowIndex}].cells[${cellIndex}].number`,
                });
            } else {
                seenPlaceNumbersInRow.add(cell.number);
            }
        });
    });

    return errors;
}

export function getClusterConfigValidation(clusterNumber: number): ConfigValidationResponse {
    const configs = listClusterConfigs();
    const clusterIndex = configs.findIndex((config) => config.number === clusterNumber);

    if (clusterIndex === -1) {
        throw AppError.clusterNotFound(`Cluster ${clusterNumber} not found`);
    }

    const errors = validateClusterConfig(configs[clusterIndex], clusterIndex);

    return {
        clusterNumber,
        valid: errors.length === 0,
        errors,
    };
}
