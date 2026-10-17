import { z } from "zod";

// Better Auth uses opaque text IDs; demo/bootstrap data can also contain UUIDs.
// Bound length without assuming a UUID or changing the supplied identifier.
export const userIdParamsSchema = z.object({
  id: z
    .string()
    .min(1)
    .max(4096)
    .regex(/^[^\s\p{Cc}]+$/u, "Invalid user ID"),
});
export const usersQuerySchema = z.object({
  status: z.literal("pending").optional(),
});
