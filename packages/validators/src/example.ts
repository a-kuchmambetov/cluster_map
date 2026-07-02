import { z } from "zod";

const SubjectEnum = z.enum(["general", "role", "contract", "collab"]);

export const exampleSchema = z.strictObject({
    name: z.string().min(1).max(255),
    email: z.string().email(),
    subject: SubjectEnum,
    message: z.string().min(1),
});

export type Example = z.infer<typeof exampleSchema>;
