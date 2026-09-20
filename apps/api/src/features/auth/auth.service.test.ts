import { beforeEach, describe, expect, it, vi } from "vitest";
import { confirm, register, getSession, getPendingUsers } from "./auth.service";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  signUpEmail: vi.fn(),
  findAuthUser: vi.fn(),
  approveUser: vi.fn(),
  listPendingUsers: vi.fn(),
}));
vi.mock("../../config/auth.js", () => ({
  auth: {
    api: { getSession: mocks.getSession, signUpEmail: mocks.signUpEmail },
  },
}));
vi.mock("./auth.repository.js", () => ({
  findAuthUser: mocks.findAuthUser,
  approveUser: mocks.approveUser,
  listPendingUsers: mocks.listPendingUsers,
}));
beforeEach(() => vi.resetAllMocks());
describe("registration errors", () => {
  it("preserves unexpected failures without exposing them in the public message", async () => {
    const cause = new Error("Internal configuration failure");
    mocks.signUpEmail.mockRejectedValue(cause);
    await expect(
      register(
        { name: "Test", email: "test@example.com", password: "test-password" },
        new Headers(),
      ),
    ).rejects.toMatchObject({
      statusCode: 500,
      message: "Authentication failed",
      cause,
    });
  });
});
describe("administrator approval authorization", () => {
  it("requires a session before accessing approval data", async () => {
    mocks.getSession.mockResolvedValue(null);
    await expect(confirm("private-token", new Headers())).rejects.toMatchObject(
      { statusCode: 401 },
    );
    expect(mocks.findAuthUser).not.toHaveBeenCalled();
    expect(mocks.approveUser).not.toHaveBeenCalled();
  });
  it.each([
    { role: "user", approved: true },
    { role: "admin", approved: false },
    undefined,
  ])(
    "rejects a caller without current approved admin privileges: %j",
    async (actor) => {
      mocks.getSession.mockResolvedValue({
        user: { id: "actor", role: "admin", approved: true },
      });
      mocks.findAuthUser.mockResolvedValue(actor);
      await expect(
        confirm("private-token", new Headers()),
      ).rejects.toMatchObject({ statusCode: 403 });
      expect(mocks.findAuthUser).toHaveBeenCalledWith("actor");
      expect(mocks.approveUser).not.toHaveBeenCalled();
    },
  );
  it("allows an approved admin to consume the token", async () => {
    mocks.getSession.mockResolvedValue({ user: { id: "actor" } });
    mocks.findAuthUser.mockResolvedValue({ role: "admin", approved: true });
    mocks.approveUser.mockResolvedValue({ id: "target" });
    expect(await confirm("private-token", new Headers())).toEqual({
      message: "Account approved. The user can now log in.",
    });
    expect(mocks.approveUser).toHaveBeenCalledWith("private-token");
  });
  it("rejects invalid or previously consumed tokens", async () => {
    mocks.getSession.mockResolvedValue({ user: { id: "actor" } });
    mocks.findAuthUser.mockResolvedValue({ role: "admin", approved: true });
    mocks.approveUser.mockResolvedValue(undefined);
    await expect(
      confirm("consumed-token", new Headers()),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe("session access", () => {
  it("rejects absent sessions", async () => {
    mocks.getSession.mockResolvedValue(null);
    await expect(getSession(new Headers())).rejects.toMatchObject({
      statusCode: 401,
    });
  });
  it("rejects revoked approval despite a valid session", async () => {
    mocks.getSession.mockResolvedValue({ user: { id: "1" } });
    mocks.findAuthUser.mockResolvedValue({ approved: false });
    await expect(getSession(new Headers())).rejects.toMatchObject({
      statusCode: 403,
    });
  });
  it("returns only public user fields and bypasses cookie cache", async () => {
    mocks.getSession.mockResolvedValue({
      user: {
        id: "1",
        name: "Test",
        email: "test@example.com",
        emailVerified: false,
        approvalToken: "secret",
      },
    });
    mocks.findAuthUser.mockResolvedValue({ approved: true });
    expect((await getSession(new Headers())).user).not.toHaveProperty(
      "approvalToken",
    );
    expect(mocks.getSession).toHaveBeenCalledWith(
      expect.objectContaining({ query: { disableCookieCache: true } }),
    );
  });
});

describe("pending users authorization", () => {
  it("requires authentication", async () => {
    mocks.getSession.mockResolvedValue(null);
    await expect(getPendingUsers(new Headers())).rejects.toMatchObject({
      statusCode: 401,
    });
    expect(mocks.listPendingUsers).not.toHaveBeenCalled();
  });
  it.each([
    { role: "user", approved: true },
    { role: "admin", approved: false },
    undefined,
  ])("rejects unauthorized actors: %j", async (actor) => {
    mocks.getSession.mockResolvedValue({ user: { id: "actor" } });
    mocks.findAuthUser.mockResolvedValue(actor);
    await expect(getPendingUsers(new Headers())).rejects.toMatchObject({
      statusCode: 403,
    });
    expect(mocks.listPendingUsers).not.toHaveBeenCalled();
  });
  it("returns pending users to approved admins", async () => {
    mocks.getSession.mockResolvedValue({ user: { id: "actor" } });
    mocks.findAuthUser.mockResolvedValue({ role: "admin", approved: true });
    mocks.listPendingUsers.mockResolvedValue([{ id: "pending" }]);
    expect(await getPendingUsers(new Headers())).toEqual({
      users: [{ id: "pending" }],
    });
  });
});
