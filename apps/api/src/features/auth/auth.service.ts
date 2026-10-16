import type { Auth } from "../../config/auth.js";
import type * as authRepository from "./auth.repository.js";
import { isAPIError } from "better-auth/api";
import { AppError } from "@repo/errors";

async function callAuth<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof AppError) throw error;
    if (isAPIError(error)) {
      const status = error.statusCode;
      const codes = {
        400: "BAD_REQUEST",
        401: "UNAUTHORIZED",
        403: "FORBIDDEN",
        404: "NOT_FOUND",
        409: "CONFLICT",
        422: "VALIDATION_ERROR",
        429: "TOO_MANY_REQUESTS",
      } as const;
      throw new AppError({
        statusCode: status,
        code: codes[status as keyof typeof codes] ?? "INTERNAL_SERVER_ERROR",
        message: status >= 500 ? "Authentication failed" : error.message,
        cause: error,
      });
    }
    throw AppError.internal("Authentication failed", error);
  }
}

// Describe only the calls this service uses, without Better Auth's endpoint metadata.
export type AuthApi = {
  getSession(options: {
    headers: Headers;
    query?: { disableCookieCache: boolean };
  }): Promise<{ user: Auth["$Infer"]["Session"]["user"] } | null>;
  signInSocial(options: {
    body: { provider: "github"; callbackURL: string };
    headers: Headers;
    returnHeaders: true;
  }): Promise<{
    headers: Headers;
    response: { url?: string; redirect: boolean };
  }>;
  callbackOAuth(options: {
    params: { id: "github" };
    query: Record<string, string | undefined>;
    headers: Headers;
    asResponse: true;
  }): Promise<Response>;
  signOut(options: {
    headers: Headers;
    returnHeaders: true;
  }): Promise<{ headers: Headers; response: unknown }>;
};
export type AuthRepository = typeof authRepository;

export function createAuthService(
  auth: { api: AuthApi },
  repository: AuthRepository,
) {
  function confirm(token: string, headers: Headers) {
    return callAuth(async () => {
      await requireAdmin(headers);
      const approved = await repository.approveUser(token);
      if (!approved)
        throw AppError.notFound(
          "Approval token is invalid or has already been used",
        );
      return { message: "Account approved. The user can now log in." };
    });
  }

  function getSession(headers: Headers) {
    return callAuth(async () => {
      const session = await auth.api.getSession({
        headers,
        query: { disableCookieCache: true },
      });
      if (!session) throw AppError.unauthorized("Authentication required");
      const actor = await repository.findAuthUser(session.user.id);
      if (!actor?.approved)
        throw AppError.forbidden("Account access has not been approved");
      const { id, name, email, emailVerified, image } = session.user;
      return {
        user: {
          id,
          name,
          email,
          emailVerified,
          image,
          role: actor.role,
        },
      };
    });
  }

  function initiateGitHubSignIn(callbackURL: string, headers: Headers) {
    return callAuth(async () => {
      return auth.api.signInSocial({
        body: { provider: "github", callbackURL },
        headers,
        returnHeaders: true,
      });
    });
  }

  function handleGitHubCallback(
    query: Record<string, string | undefined>,
    headers: Headers,
  ) {
    return callAuth(async () => {
      return auth.api.callbackOAuth({
        params: { id: "github" },
        query,
        headers,
        asResponse: true,
      });
    });
  }

  function logout(headers: Headers) {
    return callAuth(async () => {
      return auth.api.signOut({ headers, returnHeaders: true });
    });
  }

  async function requireAdmin(headers: Headers) {
    const session = await auth.api.getSession({ headers });
    if (!session) throw AppError.unauthorized("Authentication required");
    // Read current privileges from the database, never from client input or cached claims.
    const actor = await repository.findAuthUser(session.user.id);
    if (!actor?.approved || actor.role !== "admin")
      throw AppError.forbidden("Administrator access required");
    return session.user.id;
  }

  function getPendingUsers(headers: Headers) {
    return callAuth(async () => {
      await requireAdmin(headers);
      return { users: await repository.listPendingUsers() };
    });
  }

  function getUsers(headers: Headers) {
    return callAuth(async () => {
      await requireAdmin(headers);
      return { users: await repository.listUsers() };
    });
  }

  function deleteUser(id: string, headers: Headers) {
    return callAuth(async () => {
      const actorId = await requireAdmin(headers);
      if (actorId === id)
        throw AppError.forbidden("You cannot delete your own account");
      if (!(await repository.deleteUser(id)))
        throw AppError.notFound("User not found");
      return { message: "User deleted" };
    });
  }
  return {
    confirm,
    getSession,
    initiateGitHubSignIn,
    handleGitHubCallback,
    logout,
    getPendingUsers,
    getUsers,
    deleteUser,
  };
}

export type AuthService = ReturnType<typeof createAuthService>;
