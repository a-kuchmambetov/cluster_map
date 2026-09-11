import type { z } from "zod";
import type {
    cellConfigSchema,
    clusterConfigSchema,
    clusterRowConfigSchema,
    clustersConfigFileSchema,
    gapCellConfigSchema,
    placeCellConfigSchema,
    positionSchema,
} from "./clusters.schema";

export type Position = z.infer<typeof positionSchema>;
export type PlaceCellConfig = z.infer<typeof placeCellConfigSchema>;
export type GapCellConfig = z.infer<typeof gapCellConfigSchema>;
export type CellConfig = z.infer<typeof cellConfigSchema>;
export type ClusterRowConfig = z.infer<typeof clusterRowConfigSchema>;
export type ClusterConfig = z.infer<typeof clusterConfigSchema>;
export type ClustersConfigFile = z.infer<typeof clustersConfigFileSchema>;

// PlaceCellConfig with position resolved to a definite value (never undefined).
export type ResolvedPlaceCellConfig = Omit<PlaceCellConfig, "position"> & { position: Position };
export type ResolvedCellConfig = ResolvedPlaceCellConfig | GapCellConfig;

export type OccupancyRow = {
    row: number;
    place: number;
    intraName: string | null;
    displayName: string | null;
    photo: string | null;
};
