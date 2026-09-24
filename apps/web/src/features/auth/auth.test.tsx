import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Routes, Route } from "react-router";
import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import { AuthProvider, useAuth } from "./auth-provider";
import { RequireAuth } from "./require-auth";
import { AuthScreen, safeReturnPath } from "./auth-screen";
import { API_URL } from "@/config/api";
import { ApiError, apiRequest } from "@/lib/http";
import * as api from "./api";
vi.mock("./api", () => ({
  getSession: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
  verifyTOTP: vi.fn(),
}));
const user = {
  id: "1",
  name: "Test",
  email: "test@example.com",
  emailVerified: false,
  role: "user" as const,
};
let root: Root;
let container: HTMLDivElement;
let auth: ReturnType<typeof useAuth>;
const mounted = vi.fn();
function Capture() {
  auth = useAuth();
  return null;
}
function Private() {
  mounted();
  return <p>Private map</p>;
}
async function render() {
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={["/?cluster=2"]}>
        <AuthProvider>
          <Capture />
          <Routes>
            <Route element={<RequireAuth />}>
              <Route path="/" element={<Private />} />
            </Route>
            <Route path="/login" element={<p>Login page</p>} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>,
    );
  });
}
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});
describe("protected routes", () => {
  it("does not mount the map before session resolution, then restores a valid session", async () => {
    let resolve!: (value: { user: typeof user }) => void;
    vi.mocked(api.getSession).mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }),
    );
    await render();
    expect(mounted).not.toHaveBeenCalled();
    expect(container.textContent).toContain("Checking your session");
    await act(async () => resolve({ user }));
    expect(container.textContent).toContain("Private map");
  });
  it("redirects anonymous deep links without mounting the map", async () => {
    vi.mocked(api.getSession).mockRejectedValue(
      new ApiError(401, "Authentication required"),
    );
    await render();
    expect(container.textContent).toBe("Login page");
    expect(mounted).not.toHaveBeenCalled();
  });
  it("offers retry on network failures instead of treating them as logout", async () => {
    vi.mocked(api.getSession).mockRejectedValue(new Error("offline"));
    await render();
    expect(container.textContent).toContain("Unable to check your session");
    expect(mounted).not.toHaveBeenCalled();
    vi.mocked(api.getSession).mockResolvedValue({ user });
    await act(async () => auth.refresh());
    expect(container.textContent).toContain("Private map");
  });
  it("unmounts private content after logout", async () => {
    vi.mocked(api.getSession).mockResolvedValue({ user });
    vi.mocked(api.logout).mockResolvedValue({ message: "Logged out" });
    await render();
    await act(async () => auth.signOut());
    expect(container.textContent).toBe("Login page");
  });
  it("clears private content when a protected request returns 403", async () => {
    vi.mocked(api.getSession).mockResolvedValue({ user });
    await render();
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue({ ok: false, status: 403, json: async () => ({}) }),
    );
    await act(async () => {
      await apiRequest("/clusters").catch(() => undefined);
    });
    expect(container.textContent).toContain("does not have access");
    expect(container.textContent).not.toContain("Private map");
  });
});
it.each([
  "https://evil.example",
  "//evil.example",
  "/\\evil.example",
  "/login",
  "/register?returnTo=/",
])("rejects unsafe or looping return path %s", (value) => {
  expect(safeReturnPath(value)).toBe("/");
});
it("preserves a local return path with query and fragment", () => {
  expect(safeReturnPath("/?cluster=2#map")).toBe("/?cluster=2#map");
});

describe("GitHub sign-in", () => {
  async function renderSignIn(returnTo = "/", errorCode = "") {
    vi.mocked(api.getSession).mockRejectedValue(
      new ApiError(401, "Authentication required"),
    );
    await act(async () => {
      root.render(
        <MemoryRouter
          initialEntries={[
            `/login?returnTo=${encodeURIComponent(returnTo)}&error=${encodeURIComponent(errorCode)}`,
          ]}
        >
          <AuthProvider>
            <Capture />
            <AuthScreen />
          </AuthProvider>
        </MemoryRouter>,
      );
    });
  }

  it.each([
    ["github_access_denied", "Ask an administrator to approve your account"],
    ["github_sign_in_failed", "GitHub sign-in failed. Please try again."],
  ])("explains callback failure %s", async (code, message) => {
    await renderSignIn("/", code);
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      message,
    );
  });

  it.each([
    ["/?cluster=2#map", "/?cluster=2#map"],
    ["https://evil.example", "/"],
    ["//evil.example", "/"],
    ["/login", "/"],
  ])(
    "uses the API redirect with a safe callback for %s",
    async (returnTo, expected) => {
      await renderSignIn(returnTo);
      const link = Array.from(container.querySelectorAll("a")).find((element) =>
        element.textContent?.includes("Sign in with GitHub"),
      );
      expect(link).toBeDefined();
      const url = new URL(link!.href);
      const endpoint = new URL(
        `${API_URL}/auth/sign-in/github`,
        window.location.origin,
      );
      expect(url.origin + url.pathname).toBe(
        endpoint.origin + endpoint.pathname,
      );
      expect(url.searchParams.get("callbackURL")).toBe(
        `${window.location.origin}${expected}`,
      );
    },
  );

  it("hides GitHub sign-in during an email two-factor challenge", async () => {
    await renderSignIn();
    vi.mocked(api.login).mockResolvedValue({
      twoFactorRedirect: true,
      twoFactorMethods: ["totp"],
    });
    await act(async () => auth.signIn("test@example.com", "password"));
    expect(container.textContent).toContain("Two-factor authentication");
    expect(container.textContent).not.toContain("Sign in with GitHub");
  });
});

it("keeps private routes blocked until a 2FA challenge is verified", async () => {
  vi.mocked(api.getSession).mockRejectedValue(
    new ApiError(401, "Authentication required"),
  );
  vi.mocked(api.login).mockResolvedValue({
    twoFactorRedirect: true,
    twoFactorMethods: ["totp"],
  });
  await render();
  await act(async () => auth.signIn("test@example.com", "password"));
  expect(auth.status).toBe("two-factor");
  expect(auth.user).toBeNull();
  expect(mounted).not.toHaveBeenCalled();
  vi.mocked(api.verifyTOTP).mockRejectedValueOnce(
    new ApiError(401, "Invalid code"),
  );
  await act(async () => {
    await expect(auth.verifyTwoFactor("000000", false)).rejects.toThrow(
      "Invalid code",
    );
  });
  expect(auth.status).toBe("two-factor");
  vi.mocked(api.verifyTOTP).mockResolvedValue({ user });
  await act(async () => auth.verifyTwoFactor("123456", true));
  expect(api.verifyTOTP).toHaveBeenLastCalledWith("123456", true);
  expect(auth.status).toBe("authenticated");
  expect(auth.user).toEqual(user);
});
it("ignores verification completing after a challenge is cancelled", async () => {
  vi.mocked(api.getSession).mockRejectedValue(
    new ApiError(401, "Authentication required"),
  );
  vi.mocked(api.login).mockResolvedValue({
    twoFactorRedirect: true,
    twoFactorMethods: ["totp"],
  });
  await render();
  await act(async () => auth.signIn("test@example.com", "password"));
  let resolve!: (value: { user: typeof user }) => void;
  vi.mocked(api.verifyTOTP).mockReturnValue(
    new Promise((done) => {
      resolve = done;
    }),
  );
  await act(async () => {
    const verification = auth.verifyTwoFactor("123456", false);
    auth.cancelTwoFactor();
    resolve({ user });
    await verification;
  });
  expect(auth.status).toBe("anonymous");
});
