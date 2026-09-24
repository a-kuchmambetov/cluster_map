import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useAuth } from "@/features/auth/auth-provider";
import { UserApprovalsScreen } from "./user-approvals-screen";
import * as api from "./api";

vi.mock("./api", () => ({
  getUsers: vi.fn(),
  approveUser: vi.fn(),
  deleteUser: vi.fn(),
}));
vi.mock("@/features/auth/auth-provider", () => ({ useAuth: vi.fn() }));
const pending = {
  approved: false,
  role: "user" as const,
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
  vi.mocked(useAuth).mockReturnValue({
    user: { id: "actor", role: "admin" },
  } as ReturnType<typeof useAuth>);
  vi.mocked(api.getUsers).mockResolvedValue({ users: [pending] });
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
  expect(api.getUsers).not.toHaveBeenCalled();
});
it("approves the selected user and updates their status after success", async () => {
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
  expect(container.textContent).toContain(pending.email);
  expect(
    container.querySelector('button[aria-label="Approve New user"]'),
  ).toBeNull();
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
  vi.mocked(api.getUsers).mockRejectedValueOnce(new Error("offline"));
  await render();
  expect(container.textContent).toContain("Unable to load");
  await act(async () =>
    Array.from(container.querySelectorAll("button"))
      .find((button) => button.textContent === "Refresh")!
      .click(),
  );
  expect(container.textContent).toContain(pending.email);
});

it.each([
  ["NEW USER", true],
  [" EXAMPLE.COM ", true],
  ["absent", false],
  ["", true],
] as const)("filters by name or email: %s", async (query, visible) => {
  await render();
  const input = container.querySelector("input")!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )!.set!.call(input, query);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  expect(container.textContent?.includes(pending.email)).toBe(visible);
});
it("cancels deletion and removes a user only after successful deletion", async () => {
  const confirm = vi.fn().mockReturnValue(false);
  vi.stubGlobal("confirm", confirm);
  await render();
  const button = container.querySelector<HTMLButtonElement>(
    'button[aria-label="Delete New user"]',
  )!;
  await act(async () => button.click());
  expect(api.deleteUser).not.toHaveBeenCalled();
  confirm.mockReturnValue(true);
  let resolve!: (value: { message: string }) => void;
  vi.mocked(api.deleteUser).mockReturnValue(
    new Promise((done) => {
      resolve = done;
    }),
  );
  await act(async () => button.click());
  expect(api.deleteUser).toHaveBeenCalledWith("new");
  expect(container.textContent).toContain(pending.email);
  expect(button.disabled).toBe(true);
  await act(async () => resolve({ message: "Deleted" }));
  expect(container.textContent).not.toContain(pending.email);
});
it("keeps failed deletions available for retry", async () => {
  vi.stubGlobal("confirm", vi.fn().mockReturnValue(true));
  vi.mocked(api.deleteUser).mockRejectedValue(new Error("offline"));
  await render();
  const button = container.querySelector<HTMLButtonElement>(
    'button[aria-label="Delete New user"]',
  )!;
  await act(async () => button.click());
  expect(container.querySelector('[role="alert"]')?.textContent).toContain(
    "Unable to delete",
  );
  expect(container.textContent).toContain(pending.email);
  expect(button.disabled).toBe(false);
});
it("disables deletion of the current administrator", async () => {
  vi.mocked(api.getUsers).mockResolvedValue({
    users: [{ ...pending, id: "actor" }],
  });
  await render();
  expect(
    container.querySelector<HTMLButtonElement>(
      'button[aria-label="Delete New user"]',
    )!.disabled,
  ).toBe(true);
});
