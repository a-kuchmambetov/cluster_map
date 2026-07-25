import dotenv from "dotenv";
import { resolve } from "path";
import { z } from "zod";

dotenv.config({ path: resolve(process.cwd(), "../../.env") });

const envSchema = z.object({
    API_PORT: z.coerce.number().default(5000),
    WEB_ORIGIN: z.string().default("http://localhost:5173"),
});

export const env = envSchema.parse(process.env);
