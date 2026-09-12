import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { AppError } from "@repo/errors";
import type { ConfigValidationError, ConfigValidationResponse } from "@repo/types";
import { getClusterOccupancy } from "./clusters.repository";
import { clustersConfigFileSchema } from "./clusters.schema";
import type { CellConfig, ClusterConfig, ClusterLayoutResponse, ClusterOccupancyResponse, Position, ResolvedCellConfig } from "./clusters.types";

const DEFAULT_POSITION: Position = "top";

/**
 * Walk a row's cells in order and produce the effective position for every place.
 * Rules:
 *   - Explicit position wins.
 *   - If absent, flip the position of the nearest preceding non-gap place.
 *   - Gaps are transparent: they don't reset or inherit the alternation.
 *   - The first place in a row with no explicit value defaults to "top".
 */
export function resolveRowPositions(cells: CellConfig[]): ResolvedCellConfig[] {
    let lastPosition: Position | null = null;

    return cells.map((cell) => {
        if (cell.kind === "gap") {
            return cell;
        }

        const position: Position =
            cell.position !== undefined
                ? cell.position
                : lastPosition !== null
                  ? lastPosition === "top"
                      ? "bottom"
                      : "top"
                  : DEFAULT_POSITION;

        lastPosition = position;
        return { ...cell, position };
    });
}

const CONFIG_PATH = resolve(process.cwd(), "src/config/clusters.json");

function readConfigFile(): ClusterConfig[] {
    let raw: string;
    try {
        raw = readFileSync(CONFIG_PATH, "utf-8");
    } catch (error) {
        throw AppError.internal("Failed to read cluster layout config", error);
    }

    let parsed: unknown;
    try {
        parsed = JSON.parse(raw);
    } catch (error) {
        throw AppError.internal("Cluster layout config is not valid JSON", error);
    }

    const result = clustersConfigFileSchema.safeParse(parsed);
    if (!result.success) {
        throw AppError.internal("Cluster layout config failed schema validation", result.error.issues);
    }

    return result.data.clusters;
}

export function listClusterConfigs(): ClusterConfig[] {
    return readConfigFile();
}

export function loadClusterConfig(clusterNumber: number): ClusterConfig {
    const cluster = readConfigFile().find((config) => config.number === clusterNumber);

    if (!cluster) {
        throw AppError.clusterNotFound(`Cluster ${clusterNumber} not found`);
    }

    return cluster;
}

// Returns the cluster's static layout from the config. No DB query.
// Rows are sorted highest number first (top to bottom physical order).
// Cells are returned as-is from the config: position is present only where
// the config sets it explicitly; the frontend resolves the alternation.
export function getClusterLayout(clusterNumber: number): ClusterLayoutResponse {
    const config = loadClusterConfig(clusterNumber);
    return {
        cluster: { id: config.id, number: config.number, label: config.label },
        rows: [...config.rows].sort((a, b) => b.number - a.number),
    };
}

// Returns only the currently occupied places for a cluster.
// Every place not listed is free by implication.
// DB errors propagate uncaught; the error middleware surfaces them as 500.
export async function getClusterOccupancyData(clusterNumber: number): Promise<ClusterOccupancyResponse> {
    const config = loadClusterConfig(clusterNumber);
    const rows = await getClusterOccupancy(config.id);
    return {
        occupied: rows.map((r) => ({
            row: r.row,
            place: r.place,
            peer: { intraName: r.intraName, displayName: r.displayName, photo: r.photo },
        })),
        lastUpdated: new Date().toISOString(),
    };
}

// Checks whether current DB occupancy is consistent with the layout config.
// The config is structurally valid by construction (Zod catches problems at
// load time). This detects semantic mismatches: a DB record pointing at a
// (row, place) pair that doesn't exist in the config means the config is
// probably out of date.
export async function getClusterConfigValidation(clusterNumber: number): Promise<ConfigValidationResponse> {
    const configs = listClusterConfigs();
    const clusterIndex = configs.findIndex((config) => config.number === clusterNumber);

    if (clusterIndex === -1) {
        throw AppError.clusterNotFound(`Cluster ${clusterNumber} not found`);
    }

    const config = configs[clusterIndex];

    const validPlaceKeys = new Set<string>();
    for (const row of config.rows) {
        for (const cell of row.cells) {
            if (cell.kind === "place") {
                validPlaceKeys.add(`${row.number}:${cell.number}`);
            }
        }
    }

    const occupancyRows = await getClusterOccupancy(config.id);

    const errors: ConfigValidationError[] = [];
    for (const occupancyRow of occupancyRows) {
        const key = `${occupancyRow.row}:${occupancyRow.place}`;
        if (!validPlaceKeys.has(key)) {
            errors.push({
                code: "ORPHANED_OCCUPANCY",
                message: `DB record for row ${occupancyRow.row}, place ${occupancyRow.place} has no matching place in the layout`,
                path: `clusters[${clusterIndex}]`,
            });
        }
    }

    return { clusterNumber, valid: errors.length === 0, errors };
}
