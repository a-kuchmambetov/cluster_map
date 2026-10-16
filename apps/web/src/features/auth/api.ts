import type { AuthSessionResponse, AuthMessageResponse } from "@repo/types";
import { apiRequest } from "@/lib/http";
const post = (body?: unknown): RequestInit => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body ?? {}),
});
export const getSession = (signal?: AbortSignal) =>
  apiRequest<AuthSessionResponse>("/auth/session", { signal }, false);
export const logout = () =>
  apiRequest<AuthMessageResponse>("/auth/logout", post(), false);
