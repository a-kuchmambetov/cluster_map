import dotenv from "dotenv";
import { readFileSync } from "node:fs";
import { resolve } from "path";
import { z } from "zod";

dotenv.config({ path: resolve(process.cwd(), "../../.env") });

const readSecretFile = (path?: string) => {
    if (!path) return undefined;
    return readFileSync(path, "utf8").trim();
};

if (!process.env.PG_PASSWORD) {
    const dbPswd = readSecretFile(process.env.PG_PASSWORD_FILE);
    process.env.PG_PASSWORD = dbPswd;
}

const envSchema = z.object({
    API_PORT: z.coerce.number().default(5000),
    WEB_ORIGIN: z.string().default("http://localhost:3000"),
    PG_USER: z.string().min(1),
    PG_DB: z.string().min(1),
    PG_PASSWORD: z.string().min(1),
    PG_HOST: z.string().default("localhost"),
});

export const env = envSchema.parse(process.env);
