import type { Request, Response } from "express";
import { fromNodeHeaders } from "better-auth/node";
import { handler } from "@middleware/handler.js";
import type { AuthService } from "./auth.service.js";
import { confirmSchema } from "./auth.schema.js";

export function createAuthController(service: AuthService, webOrigin: string) {
  const confirmHandler = handler(
    { params: confirmSchema },
    async ({ params, req }, res) => {
      res.json(await service.confirm(params.id, fromNodeHeaders(req.headers)));
    },
  );

  async function sessionHandler(req: Request, res: Response) {
    res.json(await service.getSession(fromNodeHeaders(req.headers)));
  }
  async function logoutHandler(req: Request, res: Response) {
    const result = await service.logout(fromNodeHeaders(req.headers));
    for (const cookie of result.headers.getSetCookie())
      res.append("Set-Cookie", cookie);
    res.json({ message: "Logged out" });
  }

  async function githubSignInHandler(req: Request, res: Response) {
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
  }

  async function githubCallbackHandler(req: Request, res: Response) {
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
      result.status === 403 ? "github_access_denied" : "github_sign_in_failed",
    );
    res.redirect(failureURL.href);
  }

  async function pendingUsersHandler(req: Request, res: Response) {
    res.json(await service.getPendingUsers(fromNodeHeaders(req.headers)));
  }

  async function usersHandler(req: Request, res: Response) {
    res.json(await service.getUsers(fromNodeHeaders(req.headers)));
  }

  const deleteUserHandler = handler(
    { params: confirmSchema },
    async ({ params, req }, res) => {
      res.json(
        await service.deleteUser(params.id, fromNodeHeaders(req.headers)),
      );
    },
  );

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
