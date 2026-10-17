import { describe, expect, it } from "vitest";
import { captureLogs } from "../helpers/logs.js";

describe("central logger secret boundary", () => {
  it("drops arbitrary nested objects and message text even if a caller passes them", () => {
    const { logger, entries } = captureLogs();
    const error = new Error("postgres://app:raw%2Fpassword@db/app", {
      cause: Object.assign(new Error("raw/password OAuth-code"), {
        code: "28P01",
        parameters: ["secret-query-value"],
      }),
    });
    logger.error(
      {
        event: "security_test",
        diagnostic: error,
        err: error,
        headers: {
          cookie: "secret-cookie",
          authorization: "Bearer secret-auth",
        },
        parameters: ["secret-query-value"],
        response: { user: { accessToken: "secret-oauth-token" } },
      },
      "OAuth-code raw/password",
    );
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      event: "security_test",
      diagnostic: { type: "Error", code: "28P01" },
    });
    expect(JSON.stringify(entries)).not.toMatch(
      /raw|password|secret|OAuth|parameters|cookie|authorization|postgres/,
    );
  });
});
