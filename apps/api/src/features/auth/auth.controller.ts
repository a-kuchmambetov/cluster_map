import type { NextFunction, Request, Response } from "express";
import { fromNodeHeaders } from "better-auth/node";
import * as service from "./auth.service";

export async function registerHandler(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    res
      .status(200)
      .json(await service.register(req.body, fromNodeHeaders(req.headers)));
  } catch (error) {
    next(error);
  }
}
export async function confirmHandler(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    res.json(
      await service.confirm(req.params.id, fromNodeHeaders(req.headers)),
    );
  } catch (error) {
    next(error);
  }
}
export async function loginHandler(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const result = await service.login(req.body, fromNodeHeaders(req.headers));
    for (const cookie of result.headers.getSetCookie())
      res.append("Set-Cookie", cookie);
    res.json(result.body);
  } catch (error) {
    next(error);
  }
}

export async function sessionHandler(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    res.json(await service.getSession(fromNodeHeaders(req.headers)));
  } catch (error) {
    next(error);
  }
}
export async function logoutHandler(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const result = await service.logout(fromNodeHeaders(req.headers));
    for (const cookie of result.headers.getSetCookie())
      res.append("Set-Cookie", cookie);
    res.json({ message: "Logged out" });
  } catch (error) {
    next(error);
  }
}
