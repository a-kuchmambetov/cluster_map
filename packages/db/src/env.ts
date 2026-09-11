import dotenv from "dotenv";
import { resolve } from "node:path";

dotenv.config({ path: resolve(process.cwd(), "../../.env") });

const pgUser: string = process.env.PG_USER ?? "app";
const pgDb = process.env.PG_DB ?? "app";
const pgHost = process.env.PG_HOST ?? "localhost";
const pgPort = process.env.PG_PORT ?? "5432";
const pgPassword = process.env.PG_PASSWORD ?? "app";

export const DATABASE_URL = `postgres://${encodeURIComponent(pgUser)}:${encodeURIComponent(pgPassword)}@${pgHost}:${pgPort}/${pgDb}`;
