import type { z } from "zod";
import type { registerSchema, loginSchema } from "./auth.schema";

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
