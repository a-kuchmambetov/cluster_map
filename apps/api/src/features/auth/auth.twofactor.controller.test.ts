// Separate file so these tests start with a fresh rate-limiter budget.
// auth.controller.test.ts has a test that deliberately exhausts the shared
// in-memory store; any POST to a rate-limited route coming after it gets 429.
import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { errorMiddleware } from "@middleware/error";
import * as service from "./auth.service";
import { authRouter } from "./auth.routes";

vi.mock("./auth.service", () => ({
  getSession: vi.fn(),
  getPendingUsers: vi.fn(),
  logout: vi.fn(),
  register: vi.fn(),
  confirm: vi.fn(),
  login: vi.fn(),
  initiateGitHubSignIn: vi.fn(),
  handleGitHubCallback: vi.fn(),
  enableTwoFactor: vi.fn(),
  verifyTOTP: vi.fn(),
  disableTwoFactor: vi.fn(),
}));
const app = express()
  .use(express.json())
  .use("/api/auth", authRouter)
  .use(errorMiddleware);

beforeEach(() => vi.clearAllMocks());

describe("2FA routes", () => {
  it("validates the code length before calling verifyTOTP", async () => {
    const result = await request(app)
      .post("/api/auth/two-factor/verify-totp")
      .send({ code: "12345" }); // 5 digits — schema requires exactly 6
    expect(result.status).toBe(422);
    expect(service.verifyTOTP).not.toHaveBeenCalled();
  });

  it("returns the TOTP URI and backup codes on enable", async () => {
    vi.mocked(service.enableTwoFactor).mockResolvedValue({
      method: "totp",
      totpURI:
        "otpauth://totp/Cluster%20Map:test@example.com?secret=S&issuer=Cluster%20Map",
      backupCodes: ["code1", "code2"],
    });
    const result = await request(app)
      .post("/api/auth/two-factor/enable")
      .send({ password: "my-password" });
    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({
      method: "totp",
      backupCodes: ["code1", "code2"],
    });
    // validateRequest fills in the Zod default before the handler runs
    expect(service.enableTwoFactor).toHaveBeenCalledWith(
      { password: "my-password", method: "totp" },
      expect.any(Headers),
    );
  });

  it("sets the session cookie and returns the user after TOTP verification", async () => {
    const sessionHeaders = new Headers();
    sessionHeaders.append(
      "set-cookie",
      "better-auth.session_token=tok; HttpOnly; Path=/",
    );
    vi.mocked(service.verifyTOTP).mockResolvedValue({
      headers: sessionHeaders,
      body: {
        user: {
          id: "1",
          name: "Test",
          email: "test@example.com",
          emailVerified: true,
          image: null,
          role: "user",
        },
      },
    });
    const result = await request(app)
      .post("/api/auth/two-factor/verify-totp")
      .send({ code: "123456" });
    expect(result.status).toBe(200);
    expect(result.body.user.id).toBe("1");
    expect(result.headers["set-cookie"][0]).toContain(
      "better-auth.session_token=tok",
    );
    expect(service.verifyTOTP).toHaveBeenCalledWith(
      { code: "123456" },
      expect.any(Headers),
    );
  });

  it("forwards the updated session cookie after disabling 2FA", async () => {
    const sessionHeaders = new Headers();
    sessionHeaders.append(
      "set-cookie",
      "better-auth.session_token=new; HttpOnly; Path=/",
    );
    vi.mocked(service.disableTwoFactor).mockResolvedValue({
      headers: sessionHeaders,
      response: { status: true },
    });
    const result = await request(app)
      .post("/api/auth/two-factor/disable")
      .send({ password: "my-password" });
    expect(result.status).toBe(200);
    expect(result.body).toEqual({ status: true });
    expect(result.headers["set-cookie"][0]).toContain(
      "better-auth.session_token=new",
    );
  });

  it("returns a 2FA challenge from the login route when the user has 2FA enabled", async () => {
    vi.mocked(service.login).mockResolvedValue({
      headers: new Headers(),
      body: { twoFactorRedirect: true, twoFactorMethods: ["totp"] },
    });
    const result = await request(app)
      .post("/api/auth/login")
      .send({ email: "person@example.com", password: "correct-password" });
    expect(result.status).toBe(200);
    expect(result.body).toEqual({
      twoFactorRedirect: true,
      twoFactorMethods: ["totp"],
    });
  });
});
