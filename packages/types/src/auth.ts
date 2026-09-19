export interface AuthUser {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  image?: string | null;
}
export interface AuthSessionResponse {
  user: AuthUser;
}
export interface AuthMessageResponse {
  message: string;
}
