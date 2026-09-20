import type { AuthMessageResponse, PendingUsersResponse } from "@repo/types";
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
