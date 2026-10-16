import type { NextFunction, Request, Response } from "express";
import { fromNodeHeaders } from "better-auth/node";
import type { AuthService } from "./auth.service";

export function createAuthController(service: AuthService, webOrigin: string) {
  async function confirmHandler(
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

  async function sessionHandler(
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
  async function logoutHandler(
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

  async function githubSignInHandler(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const callbackURL =
        typeof req.query.callbackURL === "string"
          ? req.query.callbackURL
          : new URL("/", webOrigin).href;
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

  async function githubCallbackHandler(
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
      const location = result.headers.get("Location");
      if (result.status >= 300 && result.status < 400 && location) {
        res.redirect(location);
        return;
      }
      const failureURL = new URL("/login", webOrigin);
      failureURL.searchParams.set(
        "error",
        result.status === 403
          ? "github_access_denied"
          : "github_sign_in_failed",
      );
      res.redirect(failureURL.href);
    } catch (error) {
      next(error);
    }
  }

  async function pendingUsersHandler(
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

  async function usersHandler(req: Request, res: Response, next: NextFunction) {
    try {
      res.json(await service.getUsers(fromNodeHeaders(req.headers)));
    } catch (error) {
      next(error);
    }
  }

  async function deleteUserHandler(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    try {
      res.json(
        await service.deleteUser(req.params.id, fromNodeHeaders(req.headers)),
      );
    } catch (error) {
      next(error);
    }
  }

  return {
    confirmHandler,
    sessionHandler,
    logoutHandler,
    githubSignInHandler,
    githubCallbackHandler,
    pendingUsersHandler,
    usersHandler,
    deleteUserHandler,
  };
}
