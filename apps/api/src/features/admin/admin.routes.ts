import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { AppError } from "@repo/errors";
import type { Runtime } from "../../lifecycle/runtime.js";
import { trackWork } from "../../middleware/trackWork.js";
import { createRequireAuth } from "../../middleware/requireAuth.js";
import { requireRole } from "../../middleware/actor.js";
import {
  authSecurityHeaders,
  requireTrustedOrigin,
} from "../../middleware/authTransport.js";
import type { AuthService } from "../auth/auth.service.js";
import { createAdminController } from "./admin.controller.js";
import type { AdminService } from "./admin.service.js";

export function createAdminRouter(
  authService: Pick<AuthService, "getSession">,
  service: AdminService,
  webOrigin: string,
  runtime?: Runtime,
): Router {
  const router = Router();
  const controller = createAdminController(service);
  router.use(authSecurityHeaders(), requireTrustedOrigin(webOrigin));
  const authenticate = trackWork(runtime, createRequireAuth(authService));
  const authorize = requireRole("admin");
  // Explicitly attach to approval, including rejected auth attempts, preserving
  // the existing per-IP budget without throttling session reads or other routes.
  const approvalLimit = rateLimit({
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
  });
  router.get(
    "/users",
    authenticate,
    authorize,
    trackWork(runtime, controller.usersHandler),
  );
  router.post(
    "/users/:id/approve",
    approvalLimit,
    authenticate,
    authorize,
    trackWork(runtime, controller.approveUserHandler),
  );
  router.delete(
    "/users/:id",
    authenticate,
    authorize,
    trackWork(runtime, controller.deleteUserHandler),
  );
  return router;
}
