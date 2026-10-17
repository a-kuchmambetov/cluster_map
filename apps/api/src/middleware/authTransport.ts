import type { RequestHandler } from "express";
import { AppError } from "@repo/errors";

export function authSecurityHeaders(): RequestHandler {
  return (_req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Referrer-Policy", "no-referrer");
    next();
  };
}

export function requireTrustedOrigin(webOrigin: string): RequestHandler {
  const origin = new URL(webOrigin).origin;
  return (req, _res, next) => {
    // Preserve the non-browser API contract; explicit cross-site browser writes
    // must pass the configured origin check before authentication or services.
    if (
      ["POST", "DELETE", "PATCH", "PUT"].includes(req.method) &&
      ((req.headers.origin && req.headers.origin !== origin) ||
        (req.headers["sec-fetch-site"] === "cross-site" && !req.headers.origin))
    )
      return next(AppError.forbidden("Untrusted origin"));
    next();
  };
}
