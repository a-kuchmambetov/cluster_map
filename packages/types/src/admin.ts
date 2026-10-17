import type { AuthUser } from "./auth.js";

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  role: AuthUser["role"];
  approved: boolean;
}
export interface AdminUsersResponse {
  users: AdminUser[];
}
