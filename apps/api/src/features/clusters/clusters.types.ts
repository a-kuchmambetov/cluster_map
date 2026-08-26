import type { z } from "zod";
import type {
    cellConfigSchema,
    clusterConfigSchema,
    clusterRowConfigSchema,
    clustersConfigFileSchema,
    gapCellConfigSchema,
    placeCellConfigSchema,
} from "./clusters.schema";

export type PlaceCellConfig = z.infer<typeof placeCellConfigSchema>;
export type GapCellConfig = z.infer<typeof gapCellConfigSchema>;
export type CellConfig = z.infer<typeof cellConfigSchema>;
export type ClusterRowConfig = z.infer<typeof clusterRowConfigSchema>;
export type ClusterConfig = z.infer<typeof clusterConfigSchema>;
export type ClustersConfigFile = z.infer<typeof clustersConfigFileSchema>;

export type OccupancyRow = {
    row: number;
    place: number;
    intraName: string | null;
    displayName: string | null;
    photo: string | null;
};
