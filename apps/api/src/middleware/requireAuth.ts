import type { RequestHandler } from "express";
import { fromNodeHeaders } from "better-auth/node";
import type { AuthService } from "../features/auth/auth.service";

export function createRequireAuth({
  getSession,
}: Pick<AuthService, "getSession">): RequestHandler {
  return async (req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    try {
      await getSession(fromNodeHeaders(req.headers));
      next();
    } catch (error) {
      next(error);
    }
  };
}
