import { resolve } from "node:path";
import { loadEnvFile } from "node:process";
import { z } from "zod";

// Resolve from this module so source and compiled entry points use the same file.
// Existing environment variables (including Infisical secrets) take precedence.
try {
  loadEnvFile(resolve(__dirname, "../../../../.env"));
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
}

const envSchema = z.object({
  API_PORT: z.coerce.number().default(5001), // 5000 is occupied by AirPlay Receiver on macOS
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).default(0),
  WEB_ORIGIN: z.string().default("http://localhost:5173"),
  NODE_ENV: z.string().optional(),
  PG_USER: z.string().default("app"),
  PG_DB: z.string().default("app"),
  PG_HOST: z.string().default("localhost"),
  PG_PORT: z.string().default("5432"),
  PG_PASSWORD: z.string().default("app"),
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.string().url(),
  GITHUB_CLIENT_ID: z.string().min(1),
  GITHUB_CLIENT_SECRET: z.string().min(1),
});

export type Env = z.infer<typeof envSchema>;
export const env = envSchema.parse(process.env);
