import dotenv from "dotenv";
import { resolve } from "node:path";
import { z } from "zod";

dotenv.config({ path: resolve(process.cwd(), "../../.env") });

const emptyToUndefined = (value: unknown) => (value === "" ? undefined : value);

const envSchema = z
  .object({
    PG_USER: z.string().default("app"),
    PG_DB: z.string().default("app"),
    PG_HOST: z.string().default("localhost"),
    PG_PORT: z.string().default("5432"),
    PG_PASSWORD: z.string().default("app"),
    ADMIN_EMAIL: z.preprocess(
      emptyToUndefined,
      z.string().email().toLowerCase().optional(),
    ),
    ADMIN_PASSWORD: z.preprocess(
      emptyToUndefined,
      z.string().min(8).max(128).optional(),
    ),
    ADMIN_NAME: z.string().min(1).default("Administrator"),
    BETTER_AUTH_SECRET: z.preprocess(
      emptyToUndefined,
      z.string().min(32).optional(),
    ),
    BETTER_AUTH_URL: z.preprocess(
      emptyToUndefined,
      z.string().url().optional(),
    ),
  })
  .superRefine((data, ctx) => {
    const hasEmail = !!data.ADMIN_EMAIL;
    const hasPassword = !!data.ADMIN_PASSWORD;

    if (hasEmail !== hasPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "ADMIN_EMAIL and ADMIN_PASSWORD must be provided together or omitted together.",
        path: ["ADMIN_EMAIL"],
      });
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "ADMIN_EMAIL and ADMIN_PASSWORD must be provided together or omitted together.",
        path: ["ADMIN_PASSWORD"],
      });
    }

    if (hasEmail && hasPassword) {
      if (!data.BETTER_AUTH_SECRET) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "BETTER_AUTH_SECRET is required when ADMIN_EMAIL and ADMIN_PASSWORD are set.",
          path: ["BETTER_AUTH_SECRET"],
        });
      }
      if (!data.BETTER_AUTH_URL) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "BETTER_AUTH_URL is required when ADMIN_EMAIL and ADMIN_PASSWORD are set.",
          path: ["BETTER_AUTH_URL"],
        });
      }
    }
  });

export const env = envSchema.parse(process.env);

const { PG_USER, PG_PASSWORD, PG_HOST, PG_PORT, PG_DB } = env;
export const DATABASE_URL = `postgres://${encodeURIComponent(PG_USER)}:${encodeURIComponent(PG_PASSWORD)}@${PG_HOST}:${PG_PORT}/${PG_DB}`;
