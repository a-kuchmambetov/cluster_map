import type { AdminUsersResponse, MessageResponse } from "@repo/types";
import { apiRequest } from "@/lib/http";

export const getPendingUsers = (signal?: AbortSignal) =>
  apiRequest<AdminUsersResponse>("/admin/users?status=pending", { signal });

export const approveUser = (id: string) =>
  apiRequest<MessageResponse>(
    `/admin/users/${encodeURIComponent(id)}/approve`,
    {
      method: "POST",
    },
  );

export const getUsers = (signal?: AbortSignal) =>
  apiRequest<AdminUsersResponse>("/admin/users", { signal });

export const deleteUser = (id: string) =>
  apiRequest<MessageResponse>(`/admin/users/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
