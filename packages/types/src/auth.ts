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
export type { MessageResponse as AuthMessageResponse } from "./common.js";
