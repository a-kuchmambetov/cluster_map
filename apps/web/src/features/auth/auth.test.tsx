import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Routes, Route } from "react-router";
import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import { AuthProvider, useAuth } from "./auth-provider";
import { RequireAuth } from "./require-auth";
import { safeReturnPath } from "./auth-screen";
import { ApiError, apiRequest } from "@/lib/http";
import * as api from "./api";
vi.mock("./api", () => ({
  getSession: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
}));
const user = {
  id: "1",
  name: "Test",
  email: "test@example.com",
  emailVerified: false,
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
