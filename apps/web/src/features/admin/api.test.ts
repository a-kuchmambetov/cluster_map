import { beforeEach, expect, it, vi } from "vitest";
import { apiRequest } from "@/lib/http";
import { approveUser, deleteUser, getPendingUsers, getUsers } from "./api";
vi.mock("@/lib/http", () => ({ apiRequest: vi.fn() }));
beforeEach(() => vi.clearAllMocks());

it("uses the canonical admin list and pending filter while retaining cancellation", () => {
  const { signal } = new AbortController();
  getUsers(signal);
  getPendingUsers(signal);
  expect(apiRequest).toHaveBeenNthCalledWith(1, "/admin/users", { signal });
  expect(apiRequest).toHaveBeenNthCalledWith(2, "/admin/users?status=pending", {
    signal,
  });
});
it("approves and deletes by encoded opaque user ID", () => {
  approveUser("opaque/id");
  deleteUser("opaque/id");
  expect(apiRequest).toHaveBeenNthCalledWith(
    1,
    "/admin/users/opaque%2Fid/approve",
    { method: "POST" },
  );
  expect(apiRequest).toHaveBeenNthCalledWith(2, "/admin/users/opaque%2Fid", {
    method: "DELETE",
  });
});
