import { z } from "zod";

export const positionSchema = z.enum(["top", "bottom"]);

export const placeCellConfigSchema = z.object({
    kind: z.literal("place"),
    id: z.string(),
    number: z.number().int().positive(),
    position: positionSchema.optional(),
});

export const gapCellConfigSchema = z.object({
    kind: z.literal("gap"),
});

export const cellConfigSchema = z.discriminatedUnion("kind", [placeCellConfigSchema, gapCellConfigSchema]);

export const clusterRowConfigSchema = z
    .object({
        id: z.string(),
        number: z.number().int().positive(),
        label: z.string(),
        cells: z.array(cellConfigSchema),
    })
    .superRefine((row, ctx) => {
        const seenIds = new Set<string>();
        const seenNumbers = new Set<number>();

        row.cells.forEach((cell, index) => {
            if (cell.kind !== "place") return;

            if (seenIds.has(cell.id)) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: `Place id '${cell.id}' is not unique in row '${row.id}'`,
                    path: ["cells", index, "id"],
                });
            } else {
                seenIds.add(cell.id);
            }

            if (seenNumbers.has(cell.number)) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: `Place number ${cell.number} is not unique in row '${row.id}'`,
                    path: ["cells", index, "number"],
                });
            } else {
                seenNumbers.add(cell.number);
            }
        });
    });

export const clusterConfigSchema = z
    .object({
        id: z.string(),
        number: z.number().int().positive(),
        label: z.string(),
        rows: z.array(clusterRowConfigSchema),
    })
    .superRefine((cluster, ctx) => {
        const seenIds = new Set<string>();
        const seenNumbers = new Set<number>();

        cluster.rows.forEach((row, index) => {
            if (seenIds.has(row.id)) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: `Row id '${row.id}' is not unique in cluster '${cluster.id}'`,
                    path: ["rows", index, "id"],
                });
            } else {
                seenIds.add(row.id);
            }

            if (seenNumbers.has(row.number)) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: `Row number ${row.number} is not unique in cluster '${cluster.id}'`,
                    path: ["rows", index, "number"],
                });
            } else {
                seenNumbers.add(row.number);
            }
        });
    });

export const clustersConfigFileSchema = z
    .object({
        clusters: z.array(clusterConfigSchema),
    })
    .superRefine((file, ctx) => {
        const seenIds = new Set<string>();
        const seenNumbers = new Set<number>();

        file.clusters.forEach((cluster, index) => {
            if (seenIds.has(cluster.id)) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: `Cluster id '${cluster.id}' is not unique`,
                    path: ["clusters", index, "id"],
                });
            } else {
                seenIds.add(cluster.id);
            }

            if (seenNumbers.has(cluster.number)) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: `Cluster number ${cluster.number} is not unique`,
                    path: ["clusters", index, "number"],
                });
            } else {
                seenNumbers.add(cluster.number);
            }
        });
    });

export const clusterNumberParamSchema = z.object({
    clusterNumber: z.coerce.number().int().positive(),
});
