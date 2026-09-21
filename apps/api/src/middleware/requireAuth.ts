import type { RequestHandler } from "express";
import { fromNodeHeaders } from "better-auth/node";
import { getSession } from "../features/auth/auth.service";

export const requireAuth: RequestHandler = async (req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  try {
    await getSession(fromNodeHeaders(req.headers));
    next();
  } catch (error) {
    next(error);
  }
};
