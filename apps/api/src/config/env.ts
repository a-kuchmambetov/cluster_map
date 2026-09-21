import dotenv from "dotenv";
import { resolve } from "path";
import { z } from "zod";

dotenv.config({ path: resolve(process.cwd(), "../../.env") });

const envSchema = z.object({
  API_PORT: z.coerce.number().default(5001), // 5000 is occupied by AirPlay Receiver on macOS
  API_PORT: z.coerce.number().default(5001),
  WEB_ORIGIN: z.string().default("http://localhost:5173"),
  //
  PG_USER: z.string().default("app"),
  PG_DB: z.string().default("app"),
  PG_HOST: z.string().default("localhost"),
  PG_PORT: z.string().default("5432"),
  PG_PASSWORD: z.string().default("app"),
});

export const env = envSchema.parse(process.env);

const pgUser: string = process.env.PG_USER ?? "app";
const pgDb = process.env.PG_DB ?? "app";
const pgHost = process.env.PG_HOST ?? "localhost";
const pgPort = process.env.PG_PORT ?? "5432";
const pgPassword = process.env.PG_PASSWORD ?? "app";

export const DATABASE_URL = `postgres://${encodeURIComponent(pgUser)}:${encodeURIComponent(pgPassword)}@${pgHost}:${pgPort}/${pgDb}`;

const authEnvSchema = z.object({
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.string().url(),
  GITHUB_CLIENT_ID: z.string().min(1),
  GITHUB_CLIENT_SECRET: z.string().min(1),
});
export type AuthEnv = z.infer<typeof authEnvSchema>;
export function getAuthEnv(): AuthEnv {
  return authEnvSchema.parse(process.env);
}
