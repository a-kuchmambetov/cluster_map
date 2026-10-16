import dotenv from "dotenv";
import { resolve } from "node:path";
import { z } from "zod";

dotenv.config({ path: resolve(process.cwd(), "../../.env") });

const emptyToUndefined = (value: unknown) => (value === "" ? undefined : value);

const envSchema = z.object({
  PG_USER: z.string().default("app"),
  PG_DB: z.string().default("app"),
  PG_HOST: z.string().default("localhost"),
  PG_PORT: z.string().default("5432"),
  PG_PASSWORD: z.string().default("app"),
  ADMIN_EMAIL: z.preprocess(
    emptyToUndefined,
    z.string().email().toLowerCase().optional(),
  ),
});

export const env = envSchema.parse(process.env);

const { PG_USER, PG_PASSWORD, PG_HOST, PG_PORT, PG_DB } = env;
export const DATABASE_URL = `postgres://${encodeURIComponent(PG_USER)}:${encodeURIComponent(PG_PASSWORD)}@${PG_HOST}:${PG_PORT}/${PG_DB}`;
