import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { createTestDependencies } from "../helpers/fakes.js";
import { captureLogs } from "../helpers/logs.js";

describe("structured request/error correlation", () => {
  it("correlates 5xx with the client-visible request ID and masks production errors", async () => {
    const { logger, entries } = captureLogs();
    const deps = createTestDependencies();
    const secret =
      "postgres://user:private%2Fpassword@db/app OAuth-code private/password";
    deps.authService.getSession.mockRejectedValue(
      new Error(secret, {
        cause: { params: ["secret-token"], cookie: "secret-cookie" },
      }),
    );
    const response = await request(
      createApp({
        ...deps,
        env: { ...deps.env, NODE_ENV: "production" },
        logger,
      }),
    )
      .get("/api/auth/session?code=secret-code")
      .set("Cookie", "secret-cookie")
      .set("Authorization", "Bearer secret-authorization");
    expect(response.status).toBe(500);
    expect(response.body).toMatchObject({
      error: "Internal server error",
      code: "INTERNAL_SERVER_ERROR",
    });
    const requestId = response.headers["x-request-id"];
    expect(entries).toHaveLength(2);
    expect(entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          event: "request_failed",
          requestId,
          errorCode: "INTERNAL_SERVER_ERROR",
        }),
        expect.objectContaining({
          event: "request_completed",
          requestId,
          statusCode: 500,
          path: "/api/auth/session",
        }),
      ]),
    );
    expect(JSON.stringify(entries)).not.toMatch(
      /private|password|secret|postgres|OAuth|cookie|authorization|params/,
    );
  });
  it("records status and error code on ordinary client errors", async () => {
    const { logger, entries } = captureLogs();
    const response = await request(
      createApp({ ...createTestDependencies(), logger }),
    ).get("/api/clusters/999/layout");
    expect(response.status).toBe(404);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      statusCode: 404,
      errorCode: "CLUSTER_NOT_FOUND",
      outcome: "finished",
    });
  });
});
