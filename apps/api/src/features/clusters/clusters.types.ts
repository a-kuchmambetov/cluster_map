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

export type Peer = {
    intraName: string | null;
    displayName: string | null;
    photo: string | null;
};

export type Cell =
    | { kind: "place"; id: string; number: number; status: "free" | "occupied"; peer: Peer | null }
    | { kind: "gap" };

export type ClusterRow = {
    id: string;
    number: number;
    label: string;
    cells: Cell[];
};

export type ClusterSummary = {
    free: number;
    occupied: number;
    total: number;
};

export type Warning = {
    code: string;
    message: string;
};

export type ClusterMapResponse = {
    cluster: { id: string; number: number; label: string };
    rows: ClusterRow[];
    summary: ClusterSummary;
    lastUpdated: string | null;
    warnings: Warning[];
};
