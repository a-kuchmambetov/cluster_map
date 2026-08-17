import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { DATABASE_URL } from "./env";
import * as authSchema from "./auth-schema";
import * as businessSchema from "./schema";

if (!DATABASE_URL) {
    throw new Error("DATABASE_URL is not set");
}

const pool = new Pool({ connectionString: DATABASE_URL });

export const db = drizzle(pool, {
    schema: {
        ...authSchema,
        ...businessSchema,
    },
});
