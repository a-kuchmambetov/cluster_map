import { z } from "zod";

export const registerSchema = z.object({
  name: z.string().trim().min(1).max(200),
  email: z.string().trim().email().max(254),
  password: z.string().min(8).max(128),
});
export const loginSchema = registerSchema.pick({ email: true, password: true });
export const confirmSchema = z.object({ id: z.string().min(1).max(4096) });

export const enableTwoFactorSchema = z.object({
  password: z.string().min(1),
  // Only TOTP is supported. OTP requires configuring a mail/SMS transport,
  // which is not set up. The field is accepted so the client can be explicit
  // and so the constraint is visible rather than buried in the service.
  method: z.literal("totp").default("totp"),
});
export const verifyTOTPSchema = z.object({
  code: z.string().length(6),
  trustDevice: z.boolean().optional(),
});
export const disableTwoFactorSchema = z.object({
  password: z.string().min(1),
});
