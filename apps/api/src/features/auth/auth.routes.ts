import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { AppError } from "@repo/errors";
import type { AuthService } from "./auth.service.js";
import { createAuthController } from "./auth.controller.js";

export function createAuthRouter(
  service: AuthService,
  webOrigin: string,
): Router {
  const {
    usersHandler,
    deleteUserHandler,
    sessionHandler,
    pendingUsersHandler,
    logoutHandler,
    confirmHandler,
    githubSignInHandler,
    githubCallbackHandler,
  } = createAuthController(service, webOrigin);
  const authRouter = Router();
  authRouter.use((_req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Referrer-Policy", "no-referrer");
    next();
  });
  authRouter.use((req, _res, next) => {
    // Non-browser clients may omit Origin. Reject explicit untrusted browser origins.
    if (
      ["POST", "DELETE", "PATCH", "PUT"].includes(req.method) &&
      ((req.headers.origin &&
        req.headers.origin !== new URL(webOrigin).origin) ||
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
  authRouter.get("/users", usersHandler);
  authRouter.delete("/users/:id", deleteUserHandler);
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
  authRouter.post("/confirm/:id", confirmHandler);

  return authRouter;
}
