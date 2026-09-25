import dotenv from "dotenv";
import { resolve } from "node:path";
import { z } from "zod";

dotenv.config({ path: resolve(process.cwd(), "../../.env") });

const emptyToUndefined = (value: unknown) => (value === "" ? undefined : value);

const asNumber = (value: unknown) =>
  typeof value === "string" ? Number(value) : value;

export const envSchema = z
  .object({
    PG_USER: z.string().default("app"),
    PG_DB: z.string().default("app"),
    PG_PASSWORD: z.string().default("app"),
    PG_HOST: z.string().default("localhost"),
    PG_PORT: z.string().default("5432"),
    SIMULATOR_ENABLED: z.preprocess(
      emptyToUndefined,
      z
        .union([z.literal("true"), z.literal("false")])
        .default("false")
        .transform((value) => value === "true"),
    ),
    SIMULATOR_USER_COUNT: z
      .preprocess(asNumber, z.number().int().positive())
      .default(20),
    SIMULATOR_INTERVAL_MS: z
      .preprocess(asNumber, z.number().int().positive())
      .default(5000),
    SIMULATOR_CLAIM_PROBABILITY: z
      .preprocess(asNumber, z.number().min(0).max(1))
      .default(0.7),
    SIMULATOR_RELEASE_PROBABILITY: z
      .preprocess(asNumber, z.number().min(0).max(1))
      .default(0.3),
    SIMULATOR_LOCK_KEY: z
      .preprocess(asNumber, z.number().int())
      .default(7269736),
  })
  .refine(
    (data) =>
      data.SIMULATOR_CLAIM_PROBABILITY + data.SIMULATOR_RELEASE_PROBABILITY <=
      1,
    {
      message:
        "SIMULATOR_CLAIM_PROBABILITY + SIMULATOR_RELEASE_PROBABILITY must not exceed 1",
      path: ["SIMULATOR_CLAIM_PROBABILITY"],
    },
  );

export const env = envSchema.parse(process.env);
