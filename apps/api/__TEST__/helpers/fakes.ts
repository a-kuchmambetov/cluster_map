import { vi } from "vitest";
import type { AppDependencies } from "../../src/app.js";
import type { AdminService } from "../../src/features/admin/admin.service.js";
import type { AuthService } from "../../src/features/auth/auth.service.js";

export function createTestDependencies() {
  return {
    env: {
      WEB_ORIGIN: "http://localhost:5173",
      TRUST_PROXY_HOPS: 0,
      NODE_ENV: "test",
    },
    authService: {
      getSession: vi.fn<AuthService["getSession"]>(),
      initiateGitHubSignIn: vi.fn<AuthService["initiateGitHubSignIn"]>(),
      handleGitHubCallback: vi.fn<AuthService["handleGitHubCallback"]>(),
      logout: vi.fn<AuthService["logout"]>(),
    },
    adminService: {
      approveUser: vi.fn<AdminService["approveUser"]>(),
      getUsers: vi.fn<AdminService["getUsers"]>(),
      deleteUser: vi.fn<AdminService["deleteUser"]>(),
    },
    checkDb: vi.fn<() => Promise<boolean>>().mockResolvedValue(true),
    checkReady: vi.fn<() => Promise<boolean>>().mockResolvedValue(true),
  } satisfies AppDependencies;
}
