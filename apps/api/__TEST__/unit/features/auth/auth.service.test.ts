import { beforeEach, describe, expect, it, vi } from "vitest";
import { createAuthService } from "../../../../src/features/auth/auth.service.js";

const mocks = {
  getSession: vi.fn(),
  signInSocial: vi.fn(),
  callbackOAuth: vi.fn(),
  signOut: vi.fn(),
  findAuthUser: vi.fn(),
};
const { getSession, initiateGitHubSignIn, handleGitHubCallback } =
  createAuthService({ api: mocks }, mocks);
beforeEach(() => vi.resetAllMocks());
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
  it.each([undefined, { approved: true, role: "invalid" }])(
    "rejects deleted/invalid-role accounts: %j",
    async (actor) => {
      mocks.getSession.mockResolvedValue({ user: { id: "1" } });
      mocks.findAuthUser.mockResolvedValue(actor);
      await expect(getSession(new Headers())).rejects.toMatchObject({
        statusCode: 403,
      });
    },
  );
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
    mocks.findAuthUser.mockResolvedValue({ approved: true, role: "user" });
    expect(await getSession(new Headers())).toEqual({
      user: {
        id: "1",
        name: "Test",
        email: "test@example.com",
        emailVerified: false,
        role: "user",
      },
    });
    expect(mocks.findAuthUser).toHaveBeenCalledExactlyOnceWith("1");
    expect(mocks.getSession).toHaveBeenCalledOnce();
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
