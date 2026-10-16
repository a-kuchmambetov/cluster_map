import { vi } from "vitest";
import type { AppDependencies } from "../app.js";
import type { AuthService } from "../features/auth/auth.service.js";

export function createTestDependencies() {
  return {
    env: {
      WEB_ORIGIN: "http://localhost:5173",
      TRUST_PROXY_HOPS: 0,
      NODE_ENV: "test",
    },
    authService: {
      confirm: vi.fn<AuthService["confirm"]>(),
      getSession: vi.fn<AuthService["getSession"]>(),
      initiateGitHubSignIn: vi.fn<AuthService["initiateGitHubSignIn"]>(),
      handleGitHubCallback: vi.fn<AuthService["handleGitHubCallback"]>(),
      logout: vi.fn<AuthService["logout"]>(),
      getPendingUsers: vi.fn<AuthService["getPendingUsers"]>(),
      getUsers: vi.fn<AuthService["getUsers"]>(),
      deleteUser: vi.fn<AuthService["deleteUser"]>(),
    },
    checkDb: vi.fn<() => Promise<boolean>>().mockResolvedValue(true),
    checkReady: vi.fn<() => Promise<boolean>>().mockResolvedValue(true),
  } satisfies AppDependencies;
}
