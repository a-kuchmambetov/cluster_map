import type { RequestHandler } from "express";
import { fromNodeHeaders } from "better-auth/node";
import type { AuthService } from "../features/auth/auth.service.js";

export function createRequireAuth({
  getSession,
}: Pick<AuthService, "getSession">): RequestHandler {
  return async (req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    // Clear stale state before awaiting. Only this middleware establishes identity.
    delete res.locals.actor;
    delete res.locals.authSession;
    const session = await getSession(fromNodeHeaders(req.headers));
    res.locals.actor = Object.freeze({
      id: session.user.id,
      role: session.user.role,
    });
    res.locals.authSession = session;
    next();
  };
}
