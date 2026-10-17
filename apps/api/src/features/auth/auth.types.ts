import type { AuthUser } from "@repo/types";

// Server-side identity, resolved afresh at the HTTP boundary. Never accept this
// object from request parameters, bodies, headers, or OAuth profile fields.
export type Actor = Readonly<Pick<AuthUser, "id" | "role">>;
