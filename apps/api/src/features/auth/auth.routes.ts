import type { Runtime } from "../../lifecycle/runtime.js";
import { trackWork } from "../../middleware/trackWork.js";
import { createRequireAuth } from "../../middleware/requireAuth.js";
import {
  authSecurityHeaders,
  requireTrustedOrigin,
} from "../../middleware/authTransport.js";
import { Router } from "express";
import type { AuthService } from "./auth.service.js";
import { createAuthController } from "./auth.controller.js";

export function createAuthRouter(
  service: AuthService,
  webOrigin: string,
  runtime?: Runtime,
): Router {
  const controller = createAuthController(service, webOrigin);
  const router = Router();
  router.use(authSecurityHeaders(), requireTrustedOrigin(webOrigin));
  router.get(
    "/sign-in/github",
    trackWork(runtime, controller.githubSignInHandler),
  );
  router.get(
    "/callback/github",
    trackWork(runtime, controller.githubCallbackHandler),
  );
  router.get(
    "/session",
    trackWork(runtime, createRequireAuth(service)),
    controller.sessionHandler,
  );
  router.post("/logout", trackWork(runtime, controller.logoutHandler));
  return router;
}
