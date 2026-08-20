import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { AppError } from "@repo/errors";
import { clustersConfigFileSchema } from "./clusters.schema";
import type { ClusterConfig } from "./clusters.types";

const CONFIG_PATH = resolve(process.cwd(), "config/clusters.json");

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
