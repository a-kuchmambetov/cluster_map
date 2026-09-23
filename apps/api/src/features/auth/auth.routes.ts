import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { AppError } from "@repo/errors";
import { env } from "@config/env";
import { validateRequest } from "@middleware/validateRequest";
import {
  sessionHandler,
  pendingUsersHandler,
  logoutHandler,
  registerHandler,
  confirmHandler,
  loginHandler,
  githubSignInHandler,
  githubCallbackHandler,
  enableTwoFactorHandler,
  verifyTOTPHandler,
  disableTwoFactorHandler,
} from "./auth.controller";
import {
  registerSchema,
  confirmSchema,
  loginSchema,
  enableTwoFactorSchema,
  verifyTOTPSchema,
  disableTwoFactorSchema,
} from "./auth.schema";

export const authRouter: Router = Router();
authRouter.use((_req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Referrer-Policy", "no-referrer");
  next();
});
authRouter.use((req, _res, next) => {
  // Non-browser clients may omit Origin. Reject explicit untrusted browser origins.
  if (
    req.method === "POST" &&
    ((req.headers.origin &&
      req.headers.origin !== new URL(env.WEB_ORIGIN).origin) ||
      (req.headers["sec-fetch-site"] === "cross-site" && !req.headers.origin))
  ) {
    return next(AppError.forbidden("Untrusted origin"));
  }
  next();
});
authRouter.get("/sign-in/github", githubSignInHandler);
authRouter.get("/callback/github", githubCallbackHandler);
authRouter.get("/session", sessionHandler);
authRouter.get("/pending-users", pendingUsersHandler);
authRouter.post("/logout", logoutHandler);
authRouter.use(
  rateLimit({
    windowMs: 60_000,
    limit: 10,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler: (_req, _res, next) =>
      next(
        new AppError({
          statusCode: 429,
          code: "TOO_MANY_REQUESTS",
          message: "Too many authentication attempts. Try again later.",
        }),
      ),
  }),
);
authRouter.post(
  "/two-factor/enable",
  validateRequest(enableTwoFactorSchema),
  enableTwoFactorHandler,
);
authRouter.post(
  "/two-factor/verify-totp",
  validateRequest(verifyTOTPSchema),
  verifyTOTPHandler,
);
authRouter.post(
  "/two-factor/disable",
  validateRequest(disableTwoFactorSchema),
  disableTwoFactorHandler,
);
authRouter.post("/register", validateRequest(registerSchema), registerHandler);
authRouter.post(
  "/confirm/:id",
  validateRequest({ params: confirmSchema }),
  confirmHandler,
);
authRouter.post("/login", validateRequest(loginSchema), loginHandler);
