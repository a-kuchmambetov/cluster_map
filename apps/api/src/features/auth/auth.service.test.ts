import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  confirm,
  register,
  login,
  getSession,
  getPendingUsers,
  initiateGitHubSignIn,
  handleGitHubCallback,
  enableTwoFactor,
  verifyTOTP,
  disableTwoFactor,
} from "./auth.service";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  signUpEmail: vi.fn(),
  signInEmail: vi.fn(),
  signInSocial: vi.fn(),
  callbackOAuth: vi.fn(),
  enableTwoFactor: vi.fn(),
  verifyTOTP: vi.fn(),
  disableTwoFactor: vi.fn(),
  findAuthUser: vi.fn(),
  approveUser: vi.fn(),
  listPendingUsers: vi.fn(),
}));
vi.mock("../../config/auth.js", () => ({
  auth: {
    api: {
      getSession: mocks.getSession,
      signUpEmail: mocks.signUpEmail,
      signInEmail: mocks.signInEmail,
      signInSocial: mocks.signInSocial,
      callbackOAuth: mocks.callbackOAuth,
      enableTwoFactor: mocks.enableTwoFactor,
      verifyTOTP: mocks.verifyTOTP,
      disableTwoFactor: mocks.disableTwoFactor,
    },
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

describe("login with 2FA enabled", () => {
  it("returns the 2FA challenge when the hook intercepts the sign-in", async () => {
    // Better-Auth's twoFactor after-hook fires, deletes the real session,
    // and returns { twoFactorRedirect: true, twoFactorMethods } instead.
    mocks.signInEmail.mockResolvedValue({
      headers: new Headers(),
      response: { twoFactorRedirect: true, twoFactorMethods: ["totp"] },
    });
    const result = await login(
      { email: "person@example.com", password: "correct-password" },
      new Headers(),
    );
    expect(result.body).toEqual({
      twoFactorRedirect: true,
      twoFactorMethods: ["totp"],
    });
    // findAuthUser must not be called — there is no user object in the response
    expect(mocks.findAuthUser).not.toHaveBeenCalled();
  });

  it("returns the user when 2FA is not enabled (no twoFactorRedirect)", async () => {
    mocks.signInEmail.mockResolvedValue({
      headers: new Headers(),
      response: {
        user: { id: "1", name: "Test", email: "test@example.com", emailVerified: false, image: null },
      },
    });
    mocks.findAuthUser.mockResolvedValue({ role: "admin" });
    const result = await login(
      { email: "test@example.com", password: "correct-password" },
      new Headers(),
    );
    expect("user" in result.body).toBe(true);
    expect(mocks.findAuthUser).toHaveBeenCalledWith("1");
  });
});

describe("2FA enable", () => {
  it("passes password and hardcoded totp method to enableTwoFactor", async () => {
    const totpResponse = {
      method: "totp",
      totpURI: "otpauth://totp/Cluster%20Map:test@example.com?secret=SECRET&issuer=Cluster%20Map",
      backupCodes: ["code1", "code2"],
    };
    mocks.enableTwoFactor.mockResolvedValue(totpResponse);
    const result = await enableTwoFactor(
      { password: "my-password", method: "totp" },
      new Headers(),
    );
    expect(mocks.enableTwoFactor).toHaveBeenCalledWith({
      body: { password: "my-password", method: "totp" },
      headers: expect.any(Headers),
    });
    expect(result).toBe(totpResponse);
  });
});

describe("2FA TOTP verification", () => {
  it("returns a user object with role and forwards headers on successful verification", async () => {
    const sessionHeaders = new Headers();
    sessionHeaders.append("set-cookie", "better-auth.session_token=tok; HttpOnly");
    mocks.verifyTOTP.mockResolvedValue({
      headers: sessionHeaders,
      response: {
        token: "tok",
        user: { id: "1", name: "Test", email: "test@example.com", emailVerified: true, image: null },
      },
    });
    mocks.findAuthUser.mockResolvedValue({ role: "user" });
    const result = await verifyTOTP({ code: "123456" }, new Headers());
    expect(mocks.verifyTOTP).toHaveBeenCalledWith({
      body: { code: "123456" },
      headers: expect.any(Headers),
      returnHeaders: true,
    });
    expect(result.body.user).toMatchObject({ id: "1", role: "user" });
    expect(result.headers).toBe(sessionHeaders);
  });
});

describe("2FA disable", () => {
  it("forwards password and returns headers with updated session cookie", async () => {
    const sessionHeaders = new Headers();
    sessionHeaders.append("set-cookie", "better-auth.session_token=new; HttpOnly");
    mocks.disableTwoFactor.mockResolvedValue({
      headers: sessionHeaders,
      response: { status: true },
    });
    const result = await disableTwoFactor({ password: "my-password" }, new Headers());
    expect(mocks.disableTwoFactor).toHaveBeenCalledWith({
      body: { password: "my-password" },
      headers: expect.any(Headers),
      returnHeaders: true,
    });
    expect(result.response).toEqual({ status: true });
    expect(result.headers).toBe(sessionHeaders);
  });
});
