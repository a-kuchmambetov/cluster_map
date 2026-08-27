import { z } from "zod";

export const placeCellConfigSchema = z.object({
    kind: z.literal("place"),
    id: z.string(),
    number: z.number().int().positive(),
});

export const gapCellConfigSchema = z.object({
    kind: z.literal("gap"),
});

export const cellConfigSchema = z.discriminatedUnion("kind", [placeCellConfigSchema, gapCellConfigSchema]);

export const clusterRowConfigSchema = z.object({
    id: z.string(),
    number: z.number().int().positive(),
    label: z.string(),
    cells: z.array(cellConfigSchema),
});

export const clusterConfigSchema = z.object({
    id: z.string(),
    number: z.number().int().positive(),
    label: z.string(),
    key: z.string(),
    rows: z.array(clusterRowConfigSchema),
});

export const clustersConfigFileSchema = z.object({
    clusters: z.array(clusterConfigSchema),
});

export const clusterNumberParamSchema = z.object({
    clusterNumber: z.coerce.number().int().positive(),
});
