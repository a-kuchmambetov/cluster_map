import { readFileSync } from "node:fs";

const readSecretFile = (path?: string) => {
    if (!path) return undefined;
    return readFileSync(path, "utf8").trim();
};

const pgUser = process.env.PG_USER;
const pgDb = process.env.PG_DB;
const pgHost = process.env.PG_HOST ?? "localhost";
const pgPort = process.env.PG_PORT ?? "5432";
const pgPassword = process.env.PG_PASSWORD ?? readSecretFile(process.env.PG_PASSWORD_FILE);

export const DATABASE_URL = `postgres://${pgUser}:${pgPassword}@${pgHost}:${pgPort}/${pgDb}`;
