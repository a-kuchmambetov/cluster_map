import { z } from "zod";

export const registerSchema = z.object({
  name: z.string().trim().min(1).max(200),
  email: z.string().trim().email().max(254),
  password: z.string().min(8).max(128),
});
export const loginSchema = registerSchema.pick({ email: true, password: true });
export const confirmSchema = z.object({ id: z.string().min(1).max(4096) });
