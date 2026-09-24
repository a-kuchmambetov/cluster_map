import type {
  AdminUsersResponse,
  AuthMessageResponse,
  PendingUsersResponse,
} from "@repo/types";
import { apiRequest } from "@/lib/http";

export const getPendingUsers = (signal?: AbortSignal) =>
  apiRequest<PendingUsersResponse>("/auth/pending-users", { signal });

export const approveUser = (token: string) =>
  apiRequest<AuthMessageResponse>(
    `/auth/confirm/${encodeURIComponent(token)}`,
    {
      method: "POST",
    },
  );

export const getUsers = (signal?: AbortSignal) =>
  apiRequest<AdminUsersResponse>("/auth/users", { signal });

export const deleteUser = (id: string) =>
  apiRequest<AuthMessageResponse>(`/auth/users/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
