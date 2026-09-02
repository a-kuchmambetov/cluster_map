import dotenv from "dotenv";
import { resolve } from "node:path";
import { defineConfig } from "drizzle-kit";
import { DATABASE_URL } from "./src/env";

dotenv.config({ path: resolve(process.cwd(), "../../.env") });

if (!DATABASE_URL) {
    throw new Error("DATABASE_URL or PG_USER, PG_PASSWORD, and PG_DB must be set");
}

export default defineConfig({
    out: "./migrations",
    schema: ["./src/auth-schema.ts", "./src/schema.ts"],
    dialect: "postgresql",
    dbCredentials: {
        url: DATABASE_URL,
    },
});
