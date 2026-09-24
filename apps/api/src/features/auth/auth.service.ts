import { isAPIError } from "better-auth/api";
import { AppError } from "@repo/errors";
import type { LoginInput, RegisterInput } from "./auth.types";

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

// Load lazily so importing the app for health checks/tests does not initialize auth.
export function register(body: RegisterInput, headers: Headers) {
  return callAuth(async () => {
    const { auth } = await import("../../config/auth.js");
    await auth.api.signUpEmail({ body, headers });
    return {
      message:
        "If registration is available, your account is awaiting administrator approval.",
    };
  });
}
export function confirm(token: string, headers: Headers) {
  return callAuth(async () => {
    await requireAdmin(headers);
    const { approveUser } = await import("./auth.repository.js");
    const approved = await approveUser(token);
    if (!approved)
      throw AppError.notFound(
        "Approval token is invalid or has already been used",
      );
    return { message: "Account approved. The user can now log in." };
  });
}
export function login(body: LoginInput, headers: Headers) {
  return callAuth(async () => {
    const { auth } = await import("../../config/auth.js");
    const result = await auth.api.signInEmail({
      body,
      headers,
      returnHeaders: true,
    });
    // twoFactor hook intercepts the credential check when 2FA is enabled:
    // it deletes the session, sets a short-lived 2FA challenge cookie, and
    // returns { twoFactorRedirect: true, twoFactorMethods } instead of a user.
    if (
      "twoFactorRedirect" in result.response &&
      result.response.twoFactorRedirect === true
    ) {
      const challenge = result.response as unknown as {
        twoFactorRedirect: true;
        twoFactorMethods: string[];
      };
      return {
        headers: result.headers,
        body: {
          twoFactorRedirect: true as const,
          twoFactorMethods: challenge.twoFactorMethods,
        },
      };
    }
    const { findAuthUser } = await import("./auth.repository.js");
    const actor = await findAuthUser(result.response.user.id);
    const { id, name, email, emailVerified, image } = result.response.user;
    return {
      headers: result.headers,
      body: {
        user: {
          id,
          name,
          email,
          emailVerified,
          image,
          role: actor?.role ?? "user",
          twoFactorEnabled: result.response.user.twoFactorEnabled ?? false,
        },
      },
    };
  });
}

export function enableTwoFactor(
  body: { password: string; method: "totp" },
  headers: Headers,
) {
  return callAuth(async () => {
    const { auth } = await import("../../config/auth.js");
    return auth.api.enableTwoFactor({ body, headers });
  });
}

export function verifyTOTP(
  body: { code: string; trustDevice?: boolean },
  headers: Headers,
) {
  return callAuth(async () => {
    const { auth } = await import("../../config/auth.js");
    const result = await auth.api.verifyTOTP({
      body,
      headers,
      returnHeaders: true,
    });
    const { findAuthUser } = await import("./auth.repository.js");
    const actor = await findAuthUser(result.response.user.id);
    const { id, name, email, emailVerified, image } = result.response.user;
    return {
      headers: result.headers,
      body: {
        user: {
          id,
          name,
          email,
          emailVerified,
          image,
          role: actor?.role ?? "user",
          twoFactorEnabled: result.response.user.twoFactorEnabled ?? false,
        },
      },
    };
  });
}

export function disableTwoFactor(body: { password: string }, headers: Headers) {
  return callAuth(async () => {
    const { auth } = await import("../../config/auth.js");
    return auth.api.disableTwoFactor({ body, headers, returnHeaders: true });
  });
}

export function getSession(headers: Headers) {
  return callAuth(async () => {
    const { auth } = await import("../../config/auth.js");
    const session = await auth.api.getSession({
      headers,
      query: { disableCookieCache: true },
    });
    if (!session) throw AppError.unauthorized("Authentication required");
    const { findAuthUser } = await import("./auth.repository.js");
    const actor = await findAuthUser(session.user.id);
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
        twoFactorEnabled: session.user.twoFactorEnabled ?? false,
      },
    };
  });
}

export function initiateGitHubSignIn(callbackURL: string, headers: Headers) {
  return callAuth(async () => {
    const { auth } = await import("../../config/auth.js");
    return auth.api.signInSocial({
      body: { provider: "github", callbackURL },
      headers,
      returnHeaders: true,
    });
  });
}

export function handleGitHubCallback(
  query: Record<string, string | undefined>,
  headers: Headers,
) {
  return callAuth(async () => {
    const { auth } = await import("../../config/auth.js");
    return auth.api.callbackOAuth({
      params: { id: "github" },
      query,
      headers,
      asResponse: true,
    });
  });
}

export function logout(headers: Headers) {
  return callAuth(async () => {
    const { auth } = await import("../../config/auth.js");
    return auth.api.signOut({ headers, returnHeaders: true });
  });
}

async function requireAdmin(headers: Headers) {
  const { auth } = await import("../../config/auth.js");
  const session = await auth.api.getSession({ headers });
  if (!session) throw AppError.unauthorized("Authentication required");
  const { findAuthUser } = await import("./auth.repository.js");
  // Read current privileges from the database, never from client input or cached claims.
  const actor = await findAuthUser(session.user.id);
  if (!actor?.approved || actor.role !== "admin")
    throw AppError.forbidden("Administrator access required");
}

export function getPendingUsers(headers: Headers) {
  return callAuth(async () => {
    await requireAdmin(headers);
    const { listPendingUsers } = await import("./auth.repository.js");
    return { users: await listPendingUsers() };
  });
}
