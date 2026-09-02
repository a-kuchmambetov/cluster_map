import {
    boolean,
    index,
    integer,
    pgTable,
    serial,
    text,
    timestamp,
    unique,
    varchar,
} from "drizzle-orm/pg-core";
import { user } from "./auth";

export const cluster = pgTable("cluster", {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
});

export const row = pgTable(
    "row",
    {
        id: serial("id").primaryKey(),
        clusterId: integer("cluster_id")
            .notNull()
            .references(() => cluster.id, { onDelete: "cascade" }),
        number: integer("number").notNull(),
    },
    (table) => [
        index("row_cluster_id_idx").on(table.clusterId),
        unique("row_cluster_number_unique").on(table.clusterId, table.number),
    ],
);

export const userHiveInfo = pgTable("user_hive_info", {
    id: text("id")
        .primaryKey()
        .references(() => user.id, { onDelete: "cascade" }),
    login: varchar("login", { length: 255 }).notNull().unique(),
    cohort: varchar("kogorth", { length: 255 }),
});

export const position = pgTable(
    "position",
    {
        id: serial("id").primaryKey(),
        rowId: integer("row_id")
            .notNull()
            .references(() => row.id, { onDelete: "cascade" }),
        seatNumber: integer("seat_number").notNull(),
        occupied: boolean("occupied").notNull().default(false),
        holderId: text("holder_id").references(() => userHiveInfo.id, { onDelete: "set null" }),
        takenAt: timestamp("taken_at"),
    },
    (table) => [
        index("position_row_id_idx").on(table.rowId),
        index("position_holder_id_idx").on(table.holderId),
        unique("position_row_seat_unique").on(table.rowId, table.seatNumber),
    ],
);
