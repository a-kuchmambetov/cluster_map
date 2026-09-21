import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useAuth } from "@/features/auth/auth-provider";
import { UserApprovalsScreen } from "./user-approvals-screen";
import * as api from "./api";

vi.mock("./api", () => ({ getPendingUsers: vi.fn(), approveUser: vi.fn() }));
vi.mock("@/features/auth/auth-provider", () => ({ useAuth: vi.fn() }));
const pending = {
  id: "new",
  name: "New user",
  email: "new@example.com",
  createdAt: "2026-09-19T10:00:00Z",
  approvalToken: "token",
};
let root: Root;
let container: HTMLDivElement;
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.mocked(useAuth).mockReturnValue({ user: { role: "admin" } } as ReturnType<
    typeof useAuth
  >);
  vi.mocked(api.getPendingUsers).mockResolvedValue({ users: [pending] });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});
async function render() {
  await act(async () =>
    root.render(
      <MemoryRouter initialEntries={["/admin/users"]}>
        <Routes>
          <Route path="/admin/users" element={<UserApprovalsScreen />} />
          <Route path="/" element={<p>Map</p>} />
        </Routes>
      </MemoryRouter>,
    ),
  );
}
it("redirects non-admins without fetching pending users", async () => {
  vi.mocked(useAuth).mockReturnValue({ user: { role: "user" } } as ReturnType<
    typeof useAuth
  >);
  await render();
  expect(container.textContent).toBe("Map");
  expect(api.getPendingUsers).not.toHaveBeenCalled();
});
it("approves the selected user and removes them only after success", async () => {
  let resolve!: (value: { message: string }) => void;
  vi.mocked(api.approveUser).mockReturnValue(
    new Promise((done) => {
      resolve = done;
    }),
  );
  await render();
  await act(async () =>
    container
      .querySelector<HTMLButtonElement>(
        'button[aria-label="Approve New user"]',
      )!
      .click(),
  );
  expect(api.approveUser).toHaveBeenCalledWith("token");
  expect(container.textContent).toContain(pending.email);
  expect(
    container.querySelector<HTMLButtonElement>(
      'button[aria-label="Approve New user"]',
    )!.disabled,
  ).toBe(true);
  await act(async () => resolve({ message: "Approved" }));
  expect(container.textContent).not.toContain(pending.email);
  expect(container.textContent).toContain("All caught up");
  expect(container.textContent).toContain("New user has been approved");
});
it("keeps failed approvals available for retry", async () => {
  vi.mocked(api.approveUser).mockRejectedValue(new Error("offline"));
  await render();
  await act(async () =>
    container
      .querySelector<HTMLButtonElement>(
        'button[aria-label="Approve New user"]',
      )!
      .click(),
  );
  expect(container.querySelector('[role="alert"]')?.textContent).toContain(
    "Unable to approve",
  );
  expect(container.textContent).toContain(pending.email);
});
it("offers refresh after loading fails", async () => {
  vi.mocked(api.getPendingUsers).mockRejectedValueOnce(new Error("offline"));
  await render();
  expect(container.textContent).toContain("Unable to load");
  await act(async () =>
    Array.from(container.querySelectorAll("button"))
      .find((button) => button.textContent === "Refresh")!
      .click(),
  );
  expect(container.textContent).toContain(pending.email);
});
