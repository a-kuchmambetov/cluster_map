export interface AuthUser {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  role: "user" | "admin";
  image?: string | null;
  twoFactorEnabled?: boolean;
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

export type AuthLoginResponse =
  | AuthSessionResponse
  | {
      twoFactorRedirect: true;
      twoFactorMethods: string[];
    };
export interface TwoFactorSetupResponse {
  totpURI: string;
  backupCodes: string[];
}

export interface AdminUser extends PendingUser {
  role: "user" | "admin";
  approved: boolean;
}
export interface AdminUsersResponse {
  users: AdminUser[];
}
