export interface AuthUser {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  role: "user" | "admin";
  image?: string | null;
}
export interface AuthSessionResponse {
  user: AuthUser;
}
export interface AuthMessageResponse {
  message: string;
}

export interface PendingUser {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  approvalToken: string | null;
}
export interface PendingUsersResponse {
  users: PendingUser[];
}
