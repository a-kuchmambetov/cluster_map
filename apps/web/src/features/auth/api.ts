import type {
  AuthSessionResponse,
  AuthMessageResponse,
  AuthLoginResponse,
  TwoFactorSetupResponse,
} from "@repo/types";
import { apiRequest } from "@/lib/http";
const post = (body?: unknown): RequestInit => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body ?? {}),
});
export const getSession = (signal?: AbortSignal) =>
  apiRequest<AuthSessionResponse>("/auth/session", { signal }, false);
export const login = (email: string, password: string) =>
  apiRequest<AuthLoginResponse>(
    "/auth/login",
    post({ email, password }),
    false,
  );
export const register = (name: string, email: string, password: string) =>
  apiRequest<AuthMessageResponse>(
    "/auth/register",
    post({ name, email, password }),
    false,
  );
export const logout = () =>
  apiRequest<AuthMessageResponse>("/auth/logout", post(), false);

export const enableTwoFactor = (password: string) =>
  apiRequest<TwoFactorSetupResponse>(
    "/auth/two-factor/enable",
    post({ password, method: "totp" }),
    false,
  );
export const verifyTOTP = (code: string, trustDevice = false) =>
  apiRequest<AuthSessionResponse>(
    "/auth/two-factor/verify-totp",
    post({ code, trustDevice }),
    false,
  );
export const disableTwoFactor = (password: string) =>
  apiRequest<{ status: boolean }>(
    "/auth/two-factor/disable",
    post({ password }),
    false,
  );
