import { z } from "zod";

export const confirmSchema = z.object({ id: z.string().min(1).max(4096) });
