import { beforeEach, describe, expect, it, vi } from "vitest";
import { createAuthService } from "./auth.service.js";

const mocks = {
  getSession: vi.fn(),
  signInSocial: vi.fn(),
  callbackOAuth: vi.fn(),
  signOut: vi.fn(),
  findAuthUser: vi.fn(),
  approveUser: vi.fn(),
  listPendingUsers: vi.fn(),
  listUsers: vi.fn(),
  deleteUser: vi.fn(),
};
const {
  getUsers,
  deleteUser,
  confirm,
  getSession,
  getPendingUsers,
  initiateGitHubSignIn,
  handleGitHubCallback,
} = createAuthService({ api: mocks }, mocks);
beforeEach(() => vi.resetAllMocks());
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

describe("GitHub sign-in initiation", () => {
  it("forwards provider, callbackURL, and headers to signInSocial", async () => {
    const stateHeaders = new Headers();
    stateHeaders.append("set-cookie", "better-auth.state=s; HttpOnly");
    const returnValue = {
      headers: stateHeaders,
      response: {
        url: "https://github.com/login/oauth/authorize?state=s",
        redirect: true,
      },
    };
    mocks.signInSocial.mockResolvedValue(returnValue);
    const result = await initiateGitHubSignIn("/dashboard", new Headers());
    expect(mocks.signInSocial).toHaveBeenCalledWith({
      body: { provider: "github", callbackURL: "/dashboard" },
      headers: expect.any(Headers),
      returnHeaders: true,
    });
    expect(result).toBe(returnValue);
  });
});

describe("GitHub OAuth callback", () => {
  it("forwards provider id, query, and headers to callbackOAuth", async () => {
    const callbackResponse = new Response(null, {
      status: 302,
      headers: { Location: "/dashboard" },
    });
    mocks.callbackOAuth.mockResolvedValue(callbackResponse);
    const query = { code: "abc123", state: "xyz" };
    const result = await handleGitHubCallback(query, new Headers());
    expect(mocks.callbackOAuth).toHaveBeenCalledWith({
      params: { id: "github" },
      query,
      headers: expect.any(Headers),
      asResponse: true,
    });
    expect(result).toBe(callbackResponse);
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

describe("admin user management", () => {
  it("requires authentication for listing and deletion", async () => {
    mocks.getSession.mockResolvedValue(null);
    await expect(getUsers(new Headers())).rejects.toMatchObject({
      statusCode: 401,
    });
    await expect(deleteUser("target", new Headers())).rejects.toMatchObject({
      statusCode: 401,
    });
    expect(mocks.listUsers).not.toHaveBeenCalled();
    expect(mocks.deleteUser).not.toHaveBeenCalled();
  });
  it.each([
    { role: "user", approved: true },
    { role: "admin", approved: false },
    undefined,
  ])("rejects unauthorized actors: %j", async (actor) => {
    mocks.getSession.mockResolvedValue({ user: { id: "actor" } });
    mocks.findAuthUser.mockResolvedValue(actor);
    await expect(getUsers(new Headers())).rejects.toMatchObject({
      statusCode: 403,
    });
    await expect(deleteUser("target", new Headers())).rejects.toMatchObject({
      statusCode: 403,
    });
    expect(mocks.listUsers).not.toHaveBeenCalled();
    expect(mocks.deleteUser).not.toHaveBeenCalled();
  });
  it("lists accounts and deletes another user for an approved admin", async () => {
    mocks.getSession.mockResolvedValue({ user: { id: "actor" } });
    mocks.findAuthUser.mockResolvedValue({ role: "admin", approved: true });
    mocks.listUsers.mockResolvedValue([{ id: "target" }]);
    expect(await getUsers(new Headers())).toEqual({
      users: [{ id: "target" }],
    });
    await expect(deleteUser("actor", new Headers())).rejects.toMatchObject({
      statusCode: 403,
    });
    expect(mocks.deleteUser).not.toHaveBeenCalled();
    mocks.deleteUser.mockResolvedValue({ id: "target" });
    expect(await deleteUser("target", new Headers())).toEqual({
      message: "User deleted",
    });
    expect(mocks.deleteUser).toHaveBeenCalledWith("target");
    mocks.deleteUser.mockResolvedValue(undefined);
    await expect(deleteUser("missing", new Headers())).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});
