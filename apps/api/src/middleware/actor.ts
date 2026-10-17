import type { RequestHandler, Response } from "express";
import type { AuthSessionResponse } from "@repo/types";
import { AppError } from "@repo/errors";
import {
  handler,
  type HandlerContext,
  type RequestSchemas,
} from "./handler.js";

import type { Actor } from "../features/auth/auth.types.js";

declare global {
  namespace Express {
    interface Locals {
      actor?: Actor;
      authSession?: AuthSessionResponse;
    }
  }
}

export function getActor(res: Response): Actor {
  const actor = res.locals.actor;
  if (!actor) throw AppError.unauthorized("Authentication required");
  return actor;
}

export function getAuthenticatedSession(res: Response): AuthSessionResponse {
  getActor(res);
  const session = res.locals.authSession;
  if (!session) throw AppError.unauthorized("Authentication required");
  return session;
}

export function requireRole(role: Actor["role"]): RequestHandler {
  return (_req, res, next) => {
    if (getActor(res).role !== role)
      throw AppError.forbidden("Administrator access required");
    next();
  };
}

// Controllers get a required actor only through this checked boundary. Plain
// handlers retain optional locals and their existing parsed-output inference.
export function authenticatedHandler<Schemas extends RequestSchemas>(
  schemas: Schemas,
  controller: (
    context: HandlerContext<Schemas> & { actor: Actor },
    res: Response,
  ) => unknown,
): RequestHandler {
  return (req, res, next) => {
    const actor = getActor(res);
    return handler(schemas, (context, response) =>
      controller({ ...context, actor }, response),
    )(req, res, next);
  };
}
