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

export async function githubSignInHandler(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const callbackURL =
      typeof req.query.callbackURL === "string" ? req.query.callbackURL : "/";
    const result = await service.initiateGitHubSignIn(
      callbackURL,
      fromNodeHeaders(req.headers),
    );
    for (const cookie of result.headers.getSetCookie())
      res.append("Set-Cookie", cookie);
    res.redirect(result.response.url!);
  } catch (error) {
    next(error);
  }
}

export async function githubCallbackHandler(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const result = await service.handleGitHubCallback(
      req.query as Record<string, string | undefined>,
      fromNodeHeaders(req.headers),
    );
    for (const cookie of result.headers.getSetCookie())
      res.append("Set-Cookie", cookie);
    res.redirect(result.headers.get("Location") ?? "/");
  } catch (error) {
    next(error);
  }
}

export async function pendingUsersHandler(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    res.json(await service.getPendingUsers(fromNodeHeaders(req.headers)));
  } catch (error) {
    next(error);
  }
}
